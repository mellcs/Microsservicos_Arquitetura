import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import { Order } from "../models/Order.js";
import { Kafka } from "kafkajs";
import cache from "../cache.js";

dotenv.config();

const app = express();
app.use(express.json());

// kafka
const kafka = new Kafka({
  clientId: "orders-service",
  brokers: ["kafka:9092"],
});

const producer = kafka.producer();

async function initKafka() {
  try {
    await producer.connect();
    console.log("Orders conectado ao Kafka (producer)");
  } catch (err) {
    console.error("Erro ao conectar ao Kafka:", err.message);
  }
}
initKafka();

// mongodb
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB (orders_db)"))
  .catch((err) => console.error("MongoDB connection error:", err));

// rotas
app.get("/", (req, res) =>
  res.json({ message: "Orders service running" })
);

app.post("/orders", async (req, res) => {
  try {
    const { userId, productId, quantity: qty } = req.body;

    const productRes = await axios.get(
      `${process.env.PRODUCTS_SERVICE_URL}/products/${productId}`
    );

    const product = productRes.data;
    const totalPrice = product.price * qty;

    const order = await Order.create({
      userId: Number(userId),
      productId: Number(productId),
      quantity: Number(qty),
      totalPrice,
    });

    await producer.send({
      topic: "orders-topic",
      messages: [
        {
          value: JSON.stringify({
            orderId: order._id.toString(),
            userId,
            productId,
            quantity: qty,
            totalPrice,
          }),
        },
      ],
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Erro criando pedido:", err.message);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// buscar por id com cache de 30 dias
app.get("/orders/:id", cache(2592000), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ error: "ID inválido" });

  const order = await Order.findById(id);

  if (!order)
    return res.status(404).json({ error: "Pedido não encontrado" });

  res.json(order);
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err.message);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Orders service running on port ${process.env.PORT || 3000}`)
);

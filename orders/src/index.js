import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import { Order } from "../models/Order.js";
import { Kafka } from "kafkajs";

dotenv.config();

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Erro na requisição:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const app = express();
app.use(express.json());

// ===== KAFKA PRODUCER =====
const kafka = new Kafka({
  clientId: "orders-service",
  brokers: ["kafka:9092"],
});

const producer = kafka.producer();

async function connectKafka() {
  try {
    await producer.connect();
    console.log("Orders conectado ao Kafka (producer)");
  } catch (err) {
    console.error("Erro ao conectar ao Kafka:", err.message);
  }
}

connectKafka();

// ===== MONGO =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB (orders_db)"))
  .catch((err) => console.error("MongoDB connection error:", err));

// health check
app.get("/", (req, res) => res.json({ message: "Orders service running" }));

// endpoint de criar pedido
app.post("/orders", async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || !quantity || quantity <= 0)
      return res.status(400).json({ error: "Campos inválidos" });

    // procura produto
    const productRes = await axios.get(
      `${process.env.PRODUCTS_SERVICE_URL}/products/${productId}`
    );
    const product = productRes.data;
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    // verifica o estoque
    if (product.stock < quantity)
      return res.status(400).json({ error: "Estoque insuficiente" });

    // calcula total
    const totalPrice = product.price * quantity;

    // cria pedido
    const order = await Order.create({
      userId,
      productId,
      quantity,
      totalPrice,
      status: "PENDING",
    });

    // atualiza estoque
    await axios.patch(
      `${process.env.PRODUCTS_SERVICE_URL}/products/${productId}/stock`,
      { amount: -quantity }
    );

    // ========= PUBLICA EVENTO NO KAFKA =========
    await producer.send({
      topic: "orders-topic",
      messages: [
        {
          value: JSON.stringify({
            orderId: order.id,
            userId,
            productId,
            quantity,
            totalPrice,
          }),
        },
      ],
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Error creating order:", err.message);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// listar pedidos
app.get("/orders", async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// buscar por usuário
app.get("/orders/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId });

    if (orders.length === 0)
      return res.status(404).json({ message: "Nenhum pedido encontrado para este usuário." });

    res.json(orders);
  } catch (error) {
    console.error("Erro ao buscar pedidos do usuário:", error.message);
    res.status(500).json({ error: "Erro ao buscar pedidos do usuário" });
  }
});

// buscar por id de pedido
app.get("/orders/:id", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(order);
});

// confirmar pedido
app.patch("/orders/:id/confirm", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  if (order.status !== "PENDING")
    return res.status(400).json({ error: "Apenas pedidos pendentes podem ser confirmados" });

  order.status = "APPROVED";
  await order.save();

  await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
    type: "ORDER",
    recipient: order.userId,
    subject: "Pedido confirmado!",
    message: `O pedido ${order.id} (usuário: ${order.userId}) foi confirmado e está em preparação.`,
  });

  res.json(order);
});

// cancelar pedido
app.patch("/orders/:id/cancel", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

  if (order.status === "CANCELLED")
    return res.status(400).json({ error: "Pedido já cancelado" });

  // devolve estoque se estava pendente
  if (order.status === "PENDING") {
    await axios.patch(
      `${process.env.PRODUCTS_SERVICE_URL}/products/${order.productId}/stock`,
      { amount: order.quantity }
    );
  }

  order.status = "CANCELLED";
  await order.save();

  await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
    type: "ORDER",
    recipient: order.userId,
    subject: "Pedido cancelado!",
    message: `O pedido ${order.id} (usuário: ${order.userId}) foi cancelado.`,
  });

  res.json(order);
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Orders service running on port ${process.env.PORT || 3000}`)
);

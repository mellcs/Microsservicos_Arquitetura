import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
import { Order } from "../models/Order.js";

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

// conecta com o mongo
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB (orders_db)"))
  .catch((err) => console.error("MongoDB connection error:", err));

// health check
app.get("/", (req, res) => res.json({ message: "Orders service running" }));

// endpoint de criar pedido
app.post("/orders", async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0)
      return res.status(400).json({ error: "Campos inválidos" });

    // procura produto
    const productRes = await axios.get(`${process.env.PRODUCTS_SERVICE_URL}/products/${productId}`);
    const product = productRes.data;
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    // verifica o estoque
    if (product.stock < quantity)
      return res.status(400).json({ error: "Estoque insuficiente" });

    // calcula o total
    const totalPrice = product.price * quantity;

    // cria o pedido
    const order = await Order.create({
      productId,
      quantity,
      totalPrice,
      status: "PENDING",
    });

    // atualiza o estoque
    await axios.patch(`${process.env.PRODUCTS_SERVICE_URL}/products/${productId}/stock`, {
      amount: -quantity,
    });

    // notifica que o pedido foi criado
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
      type: "ORDER",
      recipient: "cliente@teste.com",
      subject: "Pedido criado!",
      message: `O pedido ${order.id} foi criado com sucesso. Valor total: R$ ${totalPrice.toFixed(2)}.`,
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Error creating order:", err.message);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

// endpoint de listar pedidos
app.get("/orders", async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// endpoint de buscar pedido por id
app.get("/orders/:id", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(order);
});

// endpoint de confirmar pedido
app.patch("/orders/:id/confirm", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  if (order.status !== "PENDING")
    return res.status(400).json({ error: "Apenas pedidos pendentes podem ser confirmados" });

  order.status = "APPROVED";
  await order.save();

  // notificação de pedido confirmado
  await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
    type: "ORDER",
    recipient: "cliente@teste.com",
    subject: "Pedido confirmado!",
    message: `Seu pedido ${order.id} foi confirmado e está em preparação.`,
  });

  res.json(order);
});

// endpoint de cancelar pedido
app.patch("/orders/:id/cancel", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

  if (order.status === "CANCELLED")
    return res.status(400).json({ error: "Pedido já cancelado" });

  // coloca o produto de volta no estoque
  if (order.status === "PENDING") {
    await axios.patch(`${process.env.PRODUCTS_SERVICE_URL}/products/${order.productId}/stock`, {
      amount: order.quantity,
    });
  }

  order.status = "CANCELLED";
  await order.save();

  // notificação de cancelamento
  await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
    type: "ORDER",
    recipient: "cliente@teste.com",
    subject: "Pedido cancelado!",
    message: `Seu pedido ${order.id} foi cancelado.`,
  });

  res.json(order);
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Orders service running on port ${process.env.PORT || 3000}`)
);

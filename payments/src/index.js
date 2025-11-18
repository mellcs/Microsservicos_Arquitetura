import express from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import amqp from "amqplib";
import { Kafka } from "kafkajs";

dotenv.config();

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

// ===================== RABBITMQ (PRODUCER) =====================
let channel;
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect("amqp://rabbitmq:5672");
    channel = await connection.createChannel();
    await channel.assertQueue("payment_notifications");
    console.log("Connected to RabbitMQ (producer)!");
  } catch (err) {
    console.error("Error connecting to RabbitMQ:", err.message);
  }
}
connectRabbitMQ();

// ===================== KAFKA (CONSUMER) =====================
const kafka = new Kafka({
  clientId: "payments-service",
  brokers: ["kafka:9092"],
});

const consumer = kafka.consumer({ groupId: "payments-group" });

async function connectKafka() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "orders-topic", fromBeginning: false });

    console.log("Payments conectado ao Kafka (consumer)");

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          const { orderId, totalPrice, userId } = data;

          await prisma.payment.create({
            data: {
              orderId,
              amount: totalPrice,
              method: "AUTO",
              status: "PENDING",
            },
          });

          console.log(`Pagamento criado automaticamente para pedido ${orderId}`);
        } catch (err) {
          console.error("Erro ao processar mensagem Kafka:", err.message);
        }
      },
    });
  } catch (err) {
    console.error("Erro ao conectar ao Kafka:", err.message);
  }
}

connectKafka();

// ===================== HEALTH CHECK =====================
app.get("/", (req, res) => res.json({ message: "Payments service running" }));

// ===================== CRIAR PAGAMENTO MANUAL =====================
app.post("/payments", async (req, res) => {
  try {
    const { orderId, method } = req.body;
    if (!orderId || !method)
      return res.status(400).json({ error: "Campos inválidos" });

    const orderRes = await axios.get(
      `${process.env.ORDERS_SERVICE_URL}/orders/${orderId}`
    );
    const order = orderRes.data;

    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (order.status !== "PENDING")
      return res.status(400).json({ error: "Pedido já processado" });

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: order.totalPrice,
        method,
        status: "PENDING",
      },
    });

    res.status(201).json(payment);
  } catch (err) {
    console.error("Error creating payment:", err.message);
    if (err.response?.status === 404)
      return res.status(404).json({ error: "Pedido não encontrado" });
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// ===================== PROCESSAR PAGAMENTO =====================
app.post("/payments/:id/process", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await prisma.payment.findUnique({ where: { id } });

    if (!payment)
      return res.status(404).json({ error: "Pagamento não encontrado" });
    if (payment.status !== "PENDING")
      return res.status(400).json({ error: "Pagamento já processado" });

    const approved = Math.random() < 0.7;
    const newStatus = approved ? "APPROVED" : "DECLINED";

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { status: newStatus },
    });

    if (approved) {
      await axios.patch(
        `${process.env.ORDERS_SERVICE_URL}/orders/${payment.orderId}/confirm`
      );

      const orderRes = await axios.get(
        `${process.env.ORDERS_SERVICE_URL}/orders/${payment.orderId}`
      );
      const order = orderRes.data;

      const message = {
        nomeCliente: order.userName || "Cliente",
        orderId: payment.orderId,
      };

      if (channel) {
        channel.sendToQueue(
          "payment_notifications",
          Buffer.from(JSON.stringify(message))
        );
        console.log("Mensagem enviada para RabbitMQ:", message);
      } else {
        console.warn("Canal RabbitMQ não disponível!");
      }
    } else {
      await axios.patch(
        `${process.env.ORDERS_SERVICE_URL}/orders/${payment.orderId}/cancel`
      );

      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify`, {
        type: "PAYMENT",
        recipient: "financeiro@teste.com",
        subject: "Pagamento recusado!",
        message: `O pagamento do pedido ${payment.orderId} foi recusado. O pedido foi cancelado.`,
      });
    }

    res.json({
      message: approved
        ? "Pagamento aprovado e pedido confirmado!"
        : "Pagamento recusado, pedido cancelado!",
      payment: updatedPayment,
    });
  } catch (err) {
    console.error("Error processing payment:", err.message);
    res.status(500).json({ error: "Erro ao processar pagamento" });
  }
});

// ===================== LISTAR PAGAMENTOS =====================
app.get("/payments", async (req, res) => {
  const payments = await prisma.payment.findMany({ orderBy: { id: "desc" } });
  res.json(payments);
});

// ===================== BUSCAR PAGAMENTO POR ID =====================
app.get("/payments/:id", async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(req.params.id) },
  });
  if (!payment)
    return res.status(404).json({ error: "Pagamento não encontrado" });
  res.json(payment);
});

// ===================== INICIAR SERVIDOR =====================
app.listen(process.env.PORT || 3000, () =>
  console.log(`Payments service running on port ${process.env.PORT || 3000}`)
);

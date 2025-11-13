import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import amqp from "amqplib";

dotenv.config();
const app = express();
app.use(express.json());
const prisma = new PrismaClient();

let channel;

// conexão com RabbitMQ
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect("amqp://rabbitmq:5672");
    channel = await connection.createChannel();
    await channel.assertQueue("payment_notifications");
    console.log("Connected to RabbitMQ (consumer)!");

    // consumidor da fila
    channel.consume("payment_notifications", async (msg) => {
      if (msg !== null) {
        const content = JSON.parse(msg.content.toString());
        console.log(`${content.nomeCliente}, seu pedido ${content.orderId} foi PAGO com sucesso e será despachado em breve.`);
        channel.ack(msg);
      }
    });

  } catch (err) {
    console.error("Error connecting to RabbitMQ:", err.message);
  }
}
connectRabbitMQ();

// config do transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// health check
app.get("/", (req, res) => res.json({ message: "Notification service running" }));

// endpoint de notificação
app.post("/notify", async (req, res) => {
  try {
    const { type, recipient, subject, message } = req.body;

    if (!type || !recipient || !subject || !message)
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });

    // "envia o email"
    console.log(`Enviando notificação para ${recipient}: ${subject}`);

    // simula envio de email
    const notification = await prisma.notification.create({
      data: { type, recipient, subject, message },
    });

    res.status(201).json({
      message: "Notificação enviada com sucesso",
      notification,
    });
  } catch (err) {
    console.error("Erro ao enviar notificação:", err.message);
    res.status(500).json({ error: "Falha ao enviar notificação" });
  }
});

// endpoint do histórico de notificações
app.get("/notifications", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { id: "desc" },
  });
  res.json(notifications);
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Notification service running on port ${process.env.PORT || 3000}`)
);

import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import amqp from "amqplib";
import express from "express";

dotenv.config();
const app = express();
app.use(express.json());

const prisma = new PrismaClient();
let channel;

// rabbitmq
async function connectRabbitMQ() {
  try {
    console.log("[RABBITMQ] Tentando conectar em", process.env.RABBITMQ_URL);

    const connection = await amqp.connect(process.env.RABBITMQ_URL);

    connection.on("close", () => {
      console.error("[RABBITMQ] Conexão fechada. Tentando reconectar...");
      setTimeout(connectRabbitMQ, 3000);
    });

    connection.on("error", (err) => {
      console.error("[RABBITMQ] Erro na conexão:", err.message);
    });

    channel = await connection.createChannel();
    await channel.assertQueue("notifications", { durable: true });

    console.log("[RABBITMQ] Conectado e fila 'notifications' pronta!");

    // consumer
    channel.consume("notifications", async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          console.log(
            `${content.nomeCliente}, seu pedido ${content.orderId} foi PAGO com sucesso e será despachado em breve.`
          );
        } catch (err) {
          console.error("[RABBITMQ] Erro ao processar mensagem:", err.message);
        }

        channel.ack(msg);
      }
    });
  } catch (err) {
    console.error("[RABBITMQ] Falha ao conectar:", err.message);
    setTimeout(connectRabbitMQ, 5000); // se der ruim, reconecta
  }
}

// garantia de que vai esperar o rabbitmq
setTimeout(connectRabbitMQ, 4000);

// nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// rotas
app.get("/", (req, res) =>
  res.json({ message: "Notification service running <3 " })
);

app.post("/notify", async (req, res) => {
  try {
    const { type, recipient, subject, message } = req.body;

    if (!type || !recipient || !subject || !message)
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });

    console.log(`Enviando notificação para ${recipient}: ${subject}`);

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

app.get("/notifications", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { id: "desc" },
  });
  res.json(notifications);
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Notification service running on port ${process.env.PORT || 3000}`)
);

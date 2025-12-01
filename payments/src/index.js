import express from "express";
import { PrismaClient, PaymentStatus } from "@prisma/client";
import amqp from "amqplib";
import { Kafka } from "kafkajs";
import axios from "axios";
import cache from "../cache.js";

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// rabbitmq
let channel;

async function initRabbitMQ() {
  try {
    const connection = await amqp.connect("amqp://rabbitmq");

    connection.on("close", () => {
      console.error("[RABBITMQ] conexão fechada — tentando reconectar...");
      setTimeout(initRabbitMQ, 3000);
    });

    channel = await connection.createChannel();
    await channel.assertQueue("notifications", { durable: true });

    console.log("[RABBITMQ] Conectado e fila pronta");
  } catch (err) {
    console.error("[RABBITMQ] Erro ao conectar — tentando novamente...");
    setTimeout(initRabbitMQ, 3000);
  }
}

// kafka
const kafka = new Kafka({
  clientId: "payment-service",
  brokers: ["kafka:9092"],
  retry: { retries: 10 },
});

const consumer = kafka.consumer({
  groupId: "payment-service-group",
});

async function initKafkaConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "orders-topic", fromBeginning: false });

    console.log("[KAFKA] Conectado ao tópico orders-topic");

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log("[KAFKA] Mensagem recebida:", payload);

          const orderId = String(payload.orderId);
          if (!orderId) return;

          let userName = "Cliente";
          try {
            const userResponse = await axios.get(
              `http://users:3000/users/${payload.userId}`
            );
            userName = userResponse.data.name;
          } catch (err) {
            console.error("[PAYMENTS] Falha ao buscar usuário:", err.message);
          }

          const saved = await prisma.payment.create({
            data: {
              orderId,
              amount: Number(payload.totalPrice),
              method: "AUTO",
              status: PaymentStatus.PENDING,
            },
          });

          console.log(`[KAFKA] Pagamento criado (PENDING) orderId=${orderId}`);

          // envia evento pro rabbitmq
          if (channel) {
            channel.sendToQueue(
              "notifications",
              Buffer.from(
                JSON.stringify({
                  orderId,
                  nomeCliente: userName, 
                })
              ),
              { persistent: true }
            );

            console.log(
              `[RABBITMQ] Evento enviado para notifications: { orderId: ${orderId}, nomeCliente: ${userName} }`
            );
          }
        } catch (err) {
          console.error("[KAFKA] Erro processando mensagem:", err.message);
        }
      },
    });
  } catch (err) {
    console.error("[KAFKA] Falha ao iniciar consumer:", err.message);
  }
}

// rotas
app.get("/", (req, res) => {
  res.json({ message: "Payments service running <3" });
});

app.post("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/payments", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { id: "desc" },
    });
    res.json(payments);
  } catch {
    res.status(500).json({ error: "Erro ao buscar pagamentos" });
  }
});

// get types com cache infinito
app.get("/payments/types", cache(315360000), (req, res) => {
  res.json(["CREDIT_CARD", "PIX", "BOLETO"]);
});

app.get("/payments/:id", async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!payment)
      return res.status(404).json({ error: "Pagamento não encontrado" });

    res.json(payment);
  } catch {
    res.status(500).json({ error: "Erro ao buscar pagamento" });
  }
});

app.listen(PORT, async () => {
  console.log(`Payment-service rodando na porta ${PORT}`);
  await initRabbitMQ();
  await initKafkaConsumer();
});

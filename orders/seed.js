import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./models/Order.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://mongo-orders:27017/orders_db";

async function runSeed() {
  try {
    console.log("[orders-seed] Conectando ao MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("[orders-seed] Verificando se já existem pedidos...");
    const count = await Order.countDocuments();

    if (count > 0) {
      console.log("[orders-seed] Dados já existem, nenhum seed necessário.");
      process.exit(0);
    }

    console.log("[orders-seed] Criando pedidos iniciais...");

    await Order.insertMany([
      {
        userId: 1,
        productId: 1,
        quantity: 2,
        totalPrice: 100,
        status: "APPROVED",
      },
      {
        userId: 2,
        productId: 2,
        quantity: 1,
        totalPrice: 55,
        status: "PENDING",
      },
      {
        userId: 3,
        productId: 3,
        quantity: 4,
        totalPrice: 240,
        status: "CANCELLED",
      },
    ]);

    console.log("[orders-seed] Seed concluído com sucesso!");

  } catch (err) {
    console.error("[orders-seed] Erro ao rodar seed:", err.message);
  } finally {
    process.exit(0);
  }
}

runSeed();

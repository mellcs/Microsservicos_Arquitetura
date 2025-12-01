import express from "express";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import cache from "../cache.js";

dotenv.config();

const app = express();
app.use(express.json());
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

// rotas
app.get("/", (req, res) =>
  res.json({ message: "Products service running <3" })
);

app.post("/", (req, res) => {
  res.status(200).send("OK");
});

// listar todos com cache 4h
app.get("/products", cache(14400), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (err) {
    console.error("Erro ao listar produtos:", err.message);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!product)
      return res.status(404).json({ error: "Produto não encontrado" });

    res.json(product);
  } catch (err) {
    console.error("Erro ao buscar produto:", err.message);
    res.status(500).json({ error: "Erro ao buscar produto" });
  }
});

app.post("/products", async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;

    const existing = await prisma.product.findUnique({ where: { name } });

    if (existing)
      return res.status(409).json({ error: "Já existe um produto com esse nome" });

    const product = await prisma.product.create({
      data: { name, description, price, stock },
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Erro ao criar produto:", err.message);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
});

app.patch("/products/:id/stock", async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { quantity } = req.body;

    if (!quantity || quantity <= 0)
      return res.status(400).json({ error: "Quantidade inválida" });

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product)
      return res.status(404).json({ error: "Produto não encontrado" });

    if (product.stock < quantity)
      return res
        .status(400)
        .json({ error: "Estoque insuficiente" });

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stock: product.stock - quantity },
    });

    res.json({ message: "Estoque atualizado com sucesso", product: updated });
  } catch (err) {
    console.error("Erro ao atualizar estoque:", err.message);
    res.status(500).json({ error: "Erro ao atualizar estoque" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!product)
      return res.status(404).json({ error: "Produto não encontrado" });

    await prisma.product.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ message: `Produto ${product.name} deletado com sucesso.` });
  } catch (err) {
    console.error("Erro ao deletar produto:", err.message);
    res.status(500).json({ error: "Erro ao deletar produto" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Products service running on port ${process.env.PORT || 3000}`)
);

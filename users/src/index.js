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
  res.json({ message: "Users service running <3" })
);

app.post("/", (req, res) => {
  res.status(200).send("OK");
});

app.post("/register", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email)
      return res.status(400).json({ error: "Preencha todos os campos" });

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser)
      return res.status(409).json({ error: "E-mail já cadastrado" });

    const user = await prisma.user.create({
      data: { name, email },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("Erro ao registrar usuário:", err.message);
    res.status(500).json({ error: "Erro ao registrar usuário" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (err) {
    console.error("Erro ao listar usuários:", err.message);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

// buscar user por id com cache de 1 dia
app.get("/users/:id", cache(86400), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    res.json(user);
  } catch (err) {
    console.error("Erro ao buscar usuário:", err.message);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    await prisma.user.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ message: `Usuário ${user.name} deletado com sucesso.` });
  } catch (err) {
    console.error("Erro ao deletar usuário:", err.message);
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Users service running on port ${process.env.PORT || 3000}`)
);

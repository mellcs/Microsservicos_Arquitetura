import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

// health check
app.get("/", (req, res) =>
  res.json({ message: "🚀 Users service running" })
);

// endpoint de registrar user
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Preencha todos os campos" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(409).json({ error: "E-mail já cadastrado" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashed },
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

// endpoint de login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(401).json({ error: "Credenciais inválidas" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Credenciais inválidas" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.TOKEN_EXPIRATION }
    );

    res.json({
      message: "Login bem-sucedido",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err.message);
    res.status(500).json({ error: "Erro no login" });
  }
});

// middleware de autenticação
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "Token ausente" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// endpoint protegido
app.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    res.json(user);
  } catch (err) {
    console.error("Erro ao buscar usuário:", err.message);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Users service running on port ${process.env.PORT || 3000}`)
);

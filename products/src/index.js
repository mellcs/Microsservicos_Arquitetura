import express from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

// middleware de erros
const errorHandler = (err, req, res, next) => {
  console.error("Erro:", err.message);
  res.status(500).json({ error: "Erro interno no servidor" });
};

// healthcheck
app.get("/", (req, res) => {
  res.json({ message: "Service is running" });
});

// endpoint de listar todos
app.get("/products", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { id: "asc" } });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// endpoint de buscar produto por id
app.get("/products/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// endpoint de criar produto
app.post("/products", async (req, res, next) => {
  try {
    const { name, description, price, stock } = req.body;

    // validações
    if (!name || typeof name !== "string" || name.trim() === "")
      return res.status(400).json({ error: "Nome do produto é obrigatório" });

    if (price == null || isNaN(price) || price <= 0)
      return res.status(400).json({ error: "Preço deve ser maior que 0" });

    if (stock != null && (isNaN(stock) || stock < 0))
      return res.status(400).json({ error: "Estoque não pode ser negativo" });

    // verifica duplicidade do nome
    const existing = await prisma.product.findUnique({ where: { name } });
    if (existing)
      return res.status(409).json({ error: "Já existe um produto com esse nome" });

    const product = await prisma.product.create({
      data: { name, description, price: parseFloat(price), stock: stock || 0 },
    });

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// endpoint de atualizar produto
app.put("/products/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, price, stock } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    // validações
    if (price != null && (isNaN(price) || price <= 0))
      return res.status(400).json({ error: "Preço deve ser maior que 0" });

    if (stock != null && (isNaN(stock) || stock < 0))
      return res.status(400).json({ error: "Estoque não pode ser negativo" });

    if (name) {
      const existing = await prisma.product.findUnique({ where: { name } });
      if (existing && existing.id !== id)
        return res.status(409).json({ error: "Nome já usado por outro produto" });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        stock: stock ?? undefined,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// endpoint de atualizar estoque
app.patch("/products/:id/stock", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { amount } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    if (amount == null || isNaN(amount))
      return res.status(400).json({ error: "Quantidade inválida" });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    const newStock = product.stock + amount;

    if (newStock < 0)
      return res.status(400).json({ error: "Estoque insuficiente para essa operação" });

    const updated = await prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// endpoint de deletar produto
app.delete("/products/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    await prisma.product.delete({ where: { id } });
    res.json({ message: "Produto removido com sucesso" });
  } catch (err) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Produto não encontrado" });
    next(err);
  }
});

// erro global
app.use(errorHandler);

app.listen(process.env.PORT || 3000, () =>
  console.log(`Products service running on port ${process.env.PORT || 3000}`)
);

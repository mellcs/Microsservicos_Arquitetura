import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  const seedProducts = [
    { name: "Teclado Mecânico", description: "Switch Blue", price: 350.0, stock: 10 },
    { name: "Mouse Gamer", description: "RGB 16000 DPI", price: 220.0, stock: 25 },
    { name: "Monitor 27'' 144Hz", description: "IPS", price: 1899.9, stock: 8 }
  ];

  for (const p of seedProducts) {
    const exists = await prisma.product.findUnique({ where: { name: p.name } });

    if (!exists) {
      await prisma.product.create({ data: p });
      console.log(`Produto criado: ${p.name}`);
    } else {
      console.log(`Produto já existia: ${p.name}`);
    }
  }
}

main()
  .then(() => {
    console.log("Seed PRODUCTS finalizado.");
  })
  .catch((e) => {
    console.error("Erro no seed PRODUCTS:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

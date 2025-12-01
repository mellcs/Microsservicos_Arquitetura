import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  const seedUsers = [
    { name: "Carlos Martins", email: "carlos@example.com" },
    { name: "Brayan dos Santos", email: "brayan@example.com" },
    { name: "Bruno Carneiro", email: "bruno@example.com" }
  ];

  for (const u of seedUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });

    if (!exists) {
      await prisma.user.create({ data: u });
      console.log(`Usuário criado: ${u.email}`);
    } else {
      console.log(`Usuário já existia: ${u.email}`);
    }
  }
}

main()
  .then(() => {
    console.log("Seed USERS finalizado.");
  })
  .catch((e) => {
    console.error("Erro no seed USERS:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

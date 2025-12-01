import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[payments-seed] Verificando se existem pagamentos...");

  const count = await prisma.payment.count();

  if (count > 0) {
    console.log("[payments-seed] Já existem pagamentos. Nenhum seed aplicado.");
    return;
  }

  console.log("[payments-seed] Criando pagamentos iniciais...");

  await prisma.payment.createMany({
    data: [
      {
        orderId: "1",
        amount: 120.50,
        method: "credit_card",
        status: "APPROVED",
      },
      {
        orderId: "2",
        amount: 55.00,
        method: "pix",
        status: "PENDING",
      },
      {
        orderId: "3",
        amount: 240.00,
        method: "debit",
        status: "DECLINED",
      }
    ],
  });

  console.log("[payments-seed] Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("[payments-seed] Erro:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

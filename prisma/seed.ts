import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  { key: "kat1", label: "Bier / Spezi / Radler", color: "#f59e0b", sortOrder: 1, freetext: false },
  { key: "kat2", label: "Mische", color: "#a855f7", sortOrder: 2, freetext: false },
  { key: "kat3", label: "Cola / Sprite / Fanta", color: "#0ea5e9", sortOrder: 3, freetext: false },
  { key: "kat4", label: "Shot", color: "#ef4444", sortOrder: 4, freetext: false },
  { key: "kat5", label: "Sonstiges", color: "#10b981", sortOrder: 5, freetext: true },
];

async function main() {
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { key: cat.key },
      update: {
        label: cat.label,
        color: cat.color,
        sortOrder: cat.sortOrder,
        freetext: cat.freetext,
      },
      create: cat,
    });
  }

  const adminPin = process.env.ADMIN_PIN ?? "0000";
  const pinHash = await bcrypt.hash(adminPin, 10);

  await prisma.user.upsert({
    where: { name: "Admin" },
    update: { role: "admin", active: true },
    create: { name: "Admin", role: "admin", pinHash },
  });

  console.log("Seed fertig. Admin-PIN:", adminPin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

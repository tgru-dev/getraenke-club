import { prisma } from "@/lib/db";
import { KioskBoard } from "./KioskBoard";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  // Tresenmodus läuft bewusst ohne Account am Gerät.
  // Schutz pro Buchung: PIN des Mitglieds + Rate-Limit serverseitig.
  const [users, categories] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <KioskBoard
      users={users}
      categories={categories.map((c) => ({
        id: c.id,
        key: c.key,
        label: c.label,
        color: c.color,
        freetext: c.freetext,
      }))}
    />
  );
}

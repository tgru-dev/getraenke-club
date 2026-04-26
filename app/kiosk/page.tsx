import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { KioskBoard } from "./KioskBoard";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.role !== "admin") redirect("/m");

  const [users, categories] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
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
      }))}
    />
  );
}

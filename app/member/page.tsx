import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MemberBoard } from "./MemberBoard";

export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [categories, todayCounts] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tally.groupBy({
      by: ["categoryId"],
      where: {
        userId: session.userId,
        createdAt: { gte: startOfDay },
        deletedAt: null,
      },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const c of todayCounts) counts[c.categoryId] = c._count._all;

  return (
    <MemberBoard
      name={session.name ?? ""}
      isAdmin={session.role === "admin"}
      categories={categories.map((c) => ({
        id: c.id,
        key: c.key,
        label: c.label,
        color: c.color,
        freetext: c.freetext,
      }))}
      initialCounts={counts}
    />
  );
}

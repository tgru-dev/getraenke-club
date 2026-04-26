import { prisma } from "@/lib/db";
import { TalliesClient } from "./TalliesClient";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string; userId?: string };

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

export default async function TalliesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);

  const defaultTo = new Date();
  defaultTo.setHours(23, 59, 59, 999);

  const from = parseDate(params.from, defaultFrom);
  const to = parseDate(params.to, defaultTo);

  const [users, categories, perUser, recent] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tally.groupBy({
      by: ["userId", "categoryId"],
      where: {
        createdAt: { gte: from, lte: to },
        deletedAt: null,
        ...(params.userId ? { userId: params.userId } : {}),
      },
      _count: { _all: true },
    }),
    prisma.tally.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(params.userId ? { userId: params.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true } },
        category: { select: { label: true, color: true } },
      },
    }),
  ]);

  // Namen der Personen, die rückgängig gemacht haben, in einem Schwung holen
  const undoerIds = Array.from(
    new Set(recent.flatMap((t) => (t.deletedBy ? [t.deletedBy] : []))),
  );
  const undoerMap = Object.fromEntries(
    (
      await prisma.user.findMany({
        where: { id: { in: undoerIds } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name]),
  );

  const matrix: Record<string, Record<string, number>> = {};
  for (const row of perUser) {
    if (!matrix[row.userId]) matrix[row.userId] = {};
    matrix[row.userId][row.categoryId] = row._count._all;
  }

  return (
    <TalliesClient
      from={from.toISOString().slice(0, 10)}
      to={to.toISOString().slice(0, 10)}
      userId={params.userId ?? ""}
      users={users}
      categories={categories.map((c) => ({ id: c.id, label: c.label, color: c.color }))}
      matrix={matrix}
      recent={recent.map((t) => ({
        id: t.id,
        userName: t.user.name,
        categoryLabel: t.category.label,
        categoryColor: t.category.color,
        source: t.source,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        deletedAt: t.deletedAt?.toISOString() ?? null,
        deletedByName: t.deletedBy ? undoerMap[t.deletedBy] ?? null : null,
      }))}
    />
  );
}

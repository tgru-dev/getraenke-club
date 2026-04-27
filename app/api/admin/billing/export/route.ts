import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rangeFromKey, isRangeKey, type RangeKey } from "@/lib/range";

function csvEscape(v: string) {
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("range");
  const rangeKey: RangeKey = isRangeKey(raw) ? raw : "month";
  const { from, to } = rangeFromKey(rangeKey);

  const [users, categories, perUserCat] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tally.groupBy({
      by: ["userId", "categoryId"],
      where: { createdAt: { gte: from, lte: to }, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const matrix: Record<string, Record<string, number>> = {};
  for (const r of perUserCat) {
    matrix[r.userId] ??= {};
    matrix[r.userId][r.categoryId] = r._count._all;
  }

  const header = [
    "mitglied",
    "aktiv",
    ...categories.map((c) => c.label),
    "striche_gesamt",
    "offen_eur",
  ];
  const lines = [header.map(csvEscape).join(";")];

  for (const u of users) {
    const counts = matrix[u.id] ?? {};
    const totalCents = categories.reduce(
      (sum, c) => sum + (counts[c.id] ?? 0) * c.priceCents,
      0,
    );
    const totalStriche = Object.values(counts).reduce((a, b) => a + b, 0);
    const row = [
      csvEscape(u.name),
      u.active ? "1" : "0",
      ...categories.map((c) => String(counts[c.id] ?? 0)),
      String(totalStriche),
      (totalCents / 100).toFixed(2).replace(".", ","),
    ];
    lines.push(row.join(";"));
  }

  const filename = `abrechnung_${rangeKey}_${from
    .toISOString()
    .slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

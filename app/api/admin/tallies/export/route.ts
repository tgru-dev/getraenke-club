import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

function csvEscape(value: string) {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const userId = url.searchParams.get("userId");

  const from = fromStr ? new Date(fromStr) : new Date(0);
  const to = toStr ? new Date(toStr) : new Date();
  to.setHours(23, 59, 59, 999);

  const tallies = await prisma.tally.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true } },
      category: { select: { label: true, key: true } },
    },
  });

  const lines = ["zeit;mitglied;kategorie_key;kategorie;quelle"];
  for (const t of tallies) {
    lines.push(
      [
        t.createdAt.toISOString(),
        csvEscape(t.user.name),
        t.category.key,
        csvEscape(t.category.label),
        t.source,
      ].join(";"),
    );
  }

  const filename = `strichliste_${from.toISOString().slice(0, 10)}_${to
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

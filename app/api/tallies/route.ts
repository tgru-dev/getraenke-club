import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Body = z.object({
  categoryId: z.string().min(1),
  source: z.enum(["tap", "scan", "kiosk"]).default("tap"),
  productId: z.string().min(1).optional(),
});

const lastTallyAt = new Map<string, number>();
const RATE_LIMIT_MS = 400;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const now = Date.now();
  const last = lastTallyAt.get(session.userId) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "too_fast" }, { status: 429 });
  }
  lastTallyAt.set(session.userId, now);

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category) {
    return NextResponse.json({ error: "unknown_category" }, { status: 404 });
  }

  const tally = await prisma.tally.create({
    data: {
      userId: session.userId,
      categoryId: category.id,
      productId: parsed.data.productId,
      source: parsed.data.source,
    },
  });

  return NextResponse.json({ id: tally.id, createdAt: tally.createdAt });
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const todayCounts = await prisma.tally.groupBy({
    by: ["categoryId"],
    where: { userId: session.userId, createdAt: { gte: start } },
    _count: { _all: true },
  });

  return NextResponse.json({
    today: todayCounts.map((t) => ({
      categoryId: t.categoryId,
      count: t._count._all,
    })),
  });
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(64),
  pin: z.string().regex(/^\d{4}$/),
  categoryId: z.string().min(1),
  note: z.string().trim().max(120).optional(),
});

const lastTallyAt = new Map<string, number>();
const RATE_LIMIT_MS = 400;

export async function POST(req: Request) {
  // Kiosk-Endpoint ist bewusst öffentlich (kein Account am Tablet).
  // Schutz: 4-stellige PIN + Rate-Limit pro Mitglied.
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { name: parsed.data.name } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await bcrypt.compare(parsed.data.pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const last = lastTallyAt.get(user.id) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "too_fast" }, { status: 429 });
  }
  lastTallyAt.set(user.id, now);

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category) {
    return NextResponse.json({ error: "unknown_category" }, { status: 404 });
  }

  const tally = await prisma.tally.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      source: "kiosk",
      note: parsed.data.note?.trim() || null,
    },
  });

  return NextResponse.json({ id: tally.id });
}

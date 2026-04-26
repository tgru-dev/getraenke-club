import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(64),
  pin: z.string().regex(/^\d{4}$/),
});

const lastVerifyAt = new Map<string, number>();
const RATE_LIMIT_MS = 400;

export async function POST(req: Request) {
  // Bewusst öffentlich: kein Account am Tablet, Schutz nur durch PIN.
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { name: parsed.data.name } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const last = lastVerifyAt.get(user.id) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "too_fast" }, { status: 429 });
  }
  lastVerifyAt.set(user.id, now);

  const ok = await bcrypt.compare(parsed.data.pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

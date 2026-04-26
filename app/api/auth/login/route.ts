import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Body = z.object({
  name: z.string().trim().min(1).max(64),
  pin: z.string().regex(/^\d{4}$/),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { name, pin } = parsed.data;
  const user = await prisma.user.findUnique({ where: { name } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.role = user.role === "admin" ? "admin" : "member";
  await session.save();

  return NextResponse.json({
    id: user.id,
    name: user.name,
    role: session.role,
  });
}

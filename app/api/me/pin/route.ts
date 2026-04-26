import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Body = z.object({
  currentPin: z.string().regex(/^\d{4}$/),
  newPin: z.string().regex(/^\d{4}$/),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (parsed.data.currentPin === parsed.data.newPin) {
    return NextResponse.json({ error: "same_pin" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await bcrypt.compare(parsed.data.currentPin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: "wrong_pin" }, { status: 401 });
  }

  const pinHash = await bcrypt.hash(parsed.data.newPin, 10);
  await prisma.user.update({ where: { id: user.id }, data: { pinHash } });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "self_pin_change",
      targetTable: "User",
      targetId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}

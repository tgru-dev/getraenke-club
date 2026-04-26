import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Patch = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  role: z.enum(["member", "admin"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Schutz: ein Admin darf sich nicht selbst entrechten oder deaktivieren,
  // wenn er der einzige Admin ist.
  if (
    id === session.userId &&
    (parsed.data.role === "member" || parsed.data.active === false)
  ) {
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", active: true, id: { not: id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "last_admin" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.pin) data.pinHash = await bcrypt.hash(parsed.data.pin, 10);
  if (parsed.data.role) data.role = parsed.data.role;
  if (typeof parsed.data.active === "boolean") data.active = parsed.data.active;

  const after = await prisma.user.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "update_user",
      targetTable: "User",
      targetId: id,
      before: JSON.stringify({
        name: before.name,
        role: before.role,
        active: before.active,
      }),
      after: JSON.stringify({
        name: after.name,
        role: after.role,
        active: after.active,
        pinChanged: Boolean(parsed.data.pin),
      }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { tallies: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Selbstlöschung verhindern, sonst hängt sich der Admin selbst aus.
  if (id === session.userId) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }
  // Letzten Admin schützen.
  if (user.role === "admin") {
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", active: true, id: { not: id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "last_admin" }, { status: 400 });
    }
  }

  // Cascade: alle Striche dieses Mitglieds gehen mit weg.
  await prisma.tally.deleteMany({ where: { userId: id } });
  // AuditLog-Einträge des Actors müssen auch weg, sonst FK-Verletzung.
  await prisma.auditLog.deleteMany({ where: { actorUserId: id } });
  await prisma.user.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "delete_user",
      targetTable: "User",
      targetId: id,
      before: JSON.stringify({
        name: user.name,
        role: user.role,
        tallies: user._count.tallies,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}

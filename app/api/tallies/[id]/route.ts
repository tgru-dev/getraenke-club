import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const tally = await prisma.tally.findUnique({ where: { id } });
  if (!tally) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner = tally.userId === session.userId;
  const isAdmin = session.role === "admin";

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Eigene Mitglieder dürfen nur die letzten 60 Sekunden zurückrufen.
  if (isOwner && !isAdmin) {
    const ageMs = Date.now() - tally.createdAt.getTime();
    if (ageMs > 60_000) {
      return NextResponse.json({ error: "too_old" }, { status: 400 });
    }
  }

  await prisma.tally.delete({ where: { id } });

  if (isAdmin && !isOwner) {
    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "delete_tally",
        targetTable: "Tally",
        targetId: id,
        before: JSON.stringify(tally),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

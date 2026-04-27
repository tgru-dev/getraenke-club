import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Patch = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  freetext: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  priceCents: z.number().int().min(0).max(100000).optional(),
});

async function ensureAdmin() {
  const session = await getSession();
  if (!session.userId) return { error: "unauthorized" as const, status: 401 };
  if (session.role !== "admin") return { error: "forbidden" as const, status: 403 };
  return { session };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const after = await prisma.category.update({ where: { id }, data: parsed.data });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "update_category",
      targetTable: "Category",
      targetId: id,
      before: JSON.stringify({
        label: before.label,
        color: before.color,
        freetext: before.freetext,
        sortOrder: before.sortOrder,
      }),
      after: JSON.stringify({
        label: after.label,
        color: after.color,
        freetext: after.freetext,
        sortOrder: after.sortOrder,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await ctx.params;

  const before = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { tallies: true } } },
  });
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Cascade: alle Striche dieser Kategorie + Produkt-Mappings (falls noch da)
  await prisma.tally.deleteMany({ where: { categoryId: id } });
  await prisma.product.deleteMany({ where: { categoryId: id } });
  await prisma.category.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "delete_category",
      targetTable: "Category",
      targetId: id,
      before: JSON.stringify({
        key: before.key,
        label: before.label,
        tallies: before._count.tallies,
      }),
    },
  });

  return NextResponse.json({ ok: true });
}

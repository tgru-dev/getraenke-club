import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Patch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().min(1).optional(),
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

  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const after = await prisma.product.update({
    where: { id },
    data: parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "update_product",
      targetTable: "Product",
      targetId: id,
      before: JSON.stringify({ name: before.name, categoryId: before.categoryId }),
      after: JSON.stringify({ name: after.name, categoryId: after.categoryId }),
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
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Striche aufheben, aber productId entkoppeln (Mengen sollen erhalten bleiben).
  await prisma.tally.updateMany({
    where: { productId: id },
    data: { productId: null },
  });
  await prisma.product.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.session.userId!,
      action: "delete_product",
      targetTable: "Product",
      targetId: id,
      before: JSON.stringify(before),
    },
  });

  return NextResponse.json({ ok: true });
}

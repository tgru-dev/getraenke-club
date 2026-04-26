import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const Body = z.object({
  ean: z.string().regex(/^\d{8}$|^\d{12,14}$/),
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().min(1),
  source: z.enum(["opengtin", "manual"]).default("manual"),
});

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

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category) {
    return NextResponse.json({ error: "unknown_category" }, { status: 404 });
  }

  const product = await prisma.product.upsert({
    where: { ean: parsed.data.ean },
    update: {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      source: parsed.data.source,
    },
    create: parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "upsert_product",
      targetTable: "Product",
      targetId: product.id,
      after: JSON.stringify({
        ean: product.ean,
        name: product.name,
        categoryId: product.categoryId,
      }),
    },
  });

  return NextResponse.json({
    id: product.id,
    ean: product.ean,
    name: product.name,
    categoryId: product.categoryId,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      category: { select: { label: true, color: true } },
      _count: { select: { tallies: true } },
    },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      ean: p.ean,
      name: p.name,
      categoryId: p.categoryId,
      categoryLabel: p.category.label,
      categoryColor: p.category.color,
      source: p.source,
      tallyCount: p._count.tallies,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

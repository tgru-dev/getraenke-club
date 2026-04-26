import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { lookupOpenGtin } from "@/lib/opengtin";

const EAN_RX = /^\d{8}$|^\d{12,14}$/;

export async function GET(_req: Request, ctx: { params: Promise<{ ean: string }> }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { ean } = await ctx.params;
  if (!EAN_RX.test(ean)) {
    return NextResponse.json({ error: "invalid_ean" }, { status: 400 });
  }

  // 1) bekanntes Produkt? -> sofort zurück
  const product = await prisma.product.findUnique({
    where: { ean },
    include: { category: true },
  });
  if (product) {
    return NextResponse.json({
      ean,
      product: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        categoryLabel: product.category.label,
        categoryColor: product.category.color,
      },
      lookup: null,
    });
  }

  // 2) OpenGTIN befragen (mit Cache)
  const lookup = await lookupOpenGtin(ean);

  return NextResponse.json({
    ean,
    product: null,
    lookup: lookup.found
      ? { name: lookup.name, vendor: lookup.vendor }
      : { error: lookup.error ?? "not_found" },
  });
}

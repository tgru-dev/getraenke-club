import { prisma } from "@/lib/db";
import { ProductsClient } from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { select: { label: true, color: true } },
        _count: { select: { tallies: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <ProductsClient
      products={products.map((p) => ({
        id: p.id,
        ean: p.ean,
        name: p.name,
        categoryId: p.categoryId,
        categoryLabel: p.category.label,
        categoryColor: p.category.color,
        source: p.source,
        tallyCount: p._count.tallies,
      }))}
      categories={categories.map((c) => ({
        id: c.id,
        label: c.label,
        color: c.color,
      }))}
    />
  );
}

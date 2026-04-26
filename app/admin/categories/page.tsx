import { prisma } from "@/lib/db";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const cats = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { tallies: { where: { deletedAt: null } } } } },
  });

  return (
    <CategoriesClient
      categories={cats.map((c) => ({
        id: c.id,
        key: c.key,
        label: c.label,
        color: c.color,
        sortOrder: c.sortOrder,
        freetext: c.freetext,
        tallyCount: c._count.tallies,
      }))}
    />
  );
}

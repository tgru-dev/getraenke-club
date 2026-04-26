import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Scanner } from "./Scanner";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <Scanner
      categories={categories.map((c) => ({
        id: c.id,
        label: c.label,
        color: c.color,
      }))}
    />
  );
}

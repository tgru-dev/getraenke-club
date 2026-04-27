import { prisma } from "@/lib/db";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { tallies: { where: { deletedAt: null } } } },
    },
  });

  return (
    <UsersClient
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role as "member" | "admin",
        active: u.active,
        createdAt: u.createdAt.toISOString(),
        tallyCount: u._count.tallies,
      }))}
    />
  );
}

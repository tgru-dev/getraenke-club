import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.role === "admin" ? "/admin" : "/m");
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center p-6">
      <h1 className="mb-2 text-3xl font-bold">Strichliste</h1>
      <p className="mb-8 text-sm text-neutral-400">Mit PIN anmelden</p>
      <LoginForm names={users.map((u) => u.name)} />
    </main>
  );
}

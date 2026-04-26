import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session.userId) {
    redirect("/member");
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-10 pt-8">
      <header className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/branding/logo"
          alt=""
          className="mb-3 h-20 w-20 rounded-2xl object-contain"
        />
        <h1 className="text-3xl font-bold">Strichliste</h1>
        <p className="mt-1 text-sm text-neutral-400">Mit PIN anmelden</p>
      </header>
      <LoginForm names={users.map((u) => u.name)} />
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminSidebarFooter } from "./AdminSidebarFooter";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.role !== "admin") redirect("/m");

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-neutral-800 bg-neutral-950 p-4 md:flex">
        <h1 className="mb-4 text-lg font-bold">Strichliste · Admin</h1>
        <NavLink href="/admin">Übersicht</NavLink>
        <NavLink href="/admin/users">Mitglieder</NavLink>
        <NavLink href="/admin/tallies">Strichliste</NavLink>
        <NavLink href="/admin/products">Produkte</NavLink>
        <NavLink href="/kiosk">Tresenmodus →</NavLink>
        <AdminSidebarFooter name={session.name ?? ""} />
      </aside>
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
    >
      {children}
    </Link>
  );
}

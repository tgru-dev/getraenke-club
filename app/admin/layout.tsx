import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminShell } from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.role !== "admin") redirect("/m");

  return <AdminShell name={session.name ?? ""}>{children}</AdminShell>;
}

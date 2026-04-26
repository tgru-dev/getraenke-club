import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Index() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.role === "admin") redirect("/admin");
  redirect("/m");
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Index() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  // Vorstand & Mitglied landen beide auf der Strichliste-Seite.
  // Vorstand erreicht das Admin-Panel über den "Admin"-Button im Header.
  redirect("/member");
}

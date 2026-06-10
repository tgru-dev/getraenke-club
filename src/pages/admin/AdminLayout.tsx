import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Avatar } from "../../components/Avatar";

const nav = [
  { to: "/admin", label: "Strichliste", end: true },
  { to: "/admin/log", label: "Getränke-Log" },
  { to: "/admin/abrechnung", label: "Abrechnung" },
  { to: "/admin/stats", label: "Statistiken" },
  { to: "/admin/mitglieder", label: "Mitglieder" },
  { to: "/admin/kategorien", label: "Kategorien" },
  // Audit-Log bewusst nicht verlinkt — nur direkt per URL /admin/audit erreichbar
  { to: "/admin/einstellungen", label: "Einstellungen" },
];

export function AdminLayout() {
  const { member } = useAuth();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface/60 max-md:w-16">
        <Link to="/" className="flex items-center gap-2 px-4 py-5">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="font-display font-extrabold max-md:hidden">Admin</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium transition-colors max-md:px-2 max-md:text-center ${
                  isActive ? "bg-amber/15 text-amber" : "text-muted hover:bg-raised hover:text-ink"
                }`
              }
            >
              <span className="max-md:hidden">{n.label}</span>
              <span className="md:hidden">{n.label[0]}</span>
            </NavLink>
          ))}
        </nav>
        {member && (
          <Link to="/" className="flex items-center gap-2 border-t border-line px-4 py-4">
            <Avatar name={member.name} color={member.color} size={32} />
            <span className="truncate text-sm max-md:hidden">{member.name}</span>
          </Link>
        )}
      </aside>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}

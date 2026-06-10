import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { onQueueChange, pendingCount } from "../lib/offline";

const tabs = [
  { to: "/", label: "Striche", icon: "𝍤" },
  { to: "/verlauf", label: "Verlauf", icon: "◷" },
  { to: "/profil", label: "Profil", icon: "◉" },
];

export function MemberShell() {
  const { member } = useAuth();
  const [pending, setPending] = useState(pendingCount());

  useEffect(() => onQueueChange(setPending), []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {pending > 0 && (
        <div className="bg-amber/15 border-b border-amber/30 px-4 py-2 text-center text-sm text-amber">
          {pending} Buchung{pending > 1 ? "en" : ""} wartet auf Verbindung – wird automatisch nachgereicht
        </div>
      )}
      <main className="flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
                  isActive ? "text-amber" : "text-muted"
                }`
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
          {member?.role === "vorstand" && (
            <NavLink
              to="/admin"
              className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium text-muted"
            >
              <span className="text-lg leading-none">⚙</span>
              Admin
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}

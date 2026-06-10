import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { onQueueChange, pendingCount } from "../lib/offline";

const icon = {
  // Mini-Strichliste (4 Striche + Diagonale) — passend zum Markenzeichen der App
  striche: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="5" x2="6" y2="19" />
      <line x1="10.5" y1="5" x2="10.5" y2="19" />
      <line x1="15" y1="5" x2="15" y2="19" />
      <line x1="19.5" y1="5" x2="19.5" y2="19" />
      <line x1="3" y1="17" x2="22" y2="7" />
    </svg>
  ),
  verlauf: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14.5" />
    </svg>
  ),
  // Klassisches Personen-Icon (Kopf + Schultern)
  profil: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  ),
  admin: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const tabs = [
  { to: "/", label: "Striche", icon: icon.striche },
  { to: "/verlauf", label: "Verlauf", icon: icon.verlauf },
  { to: "/profil", label: "Profil", icon: icon.profil },
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
              aria-label={t.label}
              title={t.label}
              className={({ isActive }) =>
                `flex flex-1 items-center justify-center py-3.5 transition-colors ${
                  isActive ? "text-amber" : "text-muted"
                }`
              }
            >
              {t.icon}
            </NavLink>
          ))}
          {member?.role === "vorstand" && (
            <NavLink
              to="/admin"
              aria-label="Admin"
              title="Admin"
              className="flex flex-1 items-center justify-center py-3.5 text-muted"
            >
              {icon.admin}
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  );
}

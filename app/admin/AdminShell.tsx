"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PinChangeDialog } from "@/components/PinChangeDialog";

const NAV = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/users", label: "Mitglieder" },
  { href: "/admin/tallies", label: "Strichliste" },
  { href: "/admin/categories", label: "Kategorien" },
  { href: "/admin/branding", label: "Logo" },
  { href: "/m", label: "Meine Striche →" },
] as const;

export function AdminShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Drawer beim Routenwechsel automatisch schließen
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Mobile Topbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 md:hidden">
        <Link href="/admin" className="flex items-center gap-2 font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/branding/logo" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-base">Strichliste · Admin</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menü öffnen"
          className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
        >
          ☰ Menü
        </button>
      </header>

      {/* Desktop-Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-neutral-800 bg-neutral-950 p-4 md:flex">
        <Link href="/admin" className="mb-4 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/branding/logo" alt="" className="h-9 w-9 rounded-lg object-contain" />
          <span className="text-base font-bold leading-tight">
            Strichliste
            <span className="block text-xs font-normal text-neutral-400">
              Admin
            </span>
          </span>
        </Link>
        <Nav pathname={pathname} />
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <p className="text-xs text-neutral-500">{name}</p>
          <button
            onClick={() => setShowPin(true)}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700"
          >
            PIN ändern
          </button>
          <button
            onClick={logout}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* Mobile-Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-1 bg-neutral-950 p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Menü</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Menü schließen"
                className="rounded-lg bg-neutral-800 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>
            <Nav pathname={pathname} />
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <p className="text-xs text-neutral-500">{name}</p>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  setShowPin(true);
                }}
                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200"
              >
                PIN ändern
              </button>
              <button
                onClick={logout}
                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-auto p-4 md:p-6">{children}</main>

      {showPin && <PinChangeDialog onClose={() => setShowPin(false)} />}
    </div>
  );
}

function Nav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-neutral-800 text-white"
                : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

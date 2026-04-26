"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PinChangeDialog } from "@/components/PinChangeDialog";

type Category = {
  id: string;
  key: string;
  label: string;
  color: string;
};

type LastAction = { tallyId: string; categoryId: string; expiresAt: number } | null;

export function MemberBoard({
  name,
  isAdmin,
  categories,
  initialCounts,
}: {
  name: string;
  isAdmin: boolean;
  categories: Category[];
  initialCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [last, setLast] = useState<LastAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinChange, setShowPinChange] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLast = useCallback(() => {
    setLast(null);
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }, []);

  async function tap(category: Category) {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }
    try {
      const res = await fetch("/api/tallies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: category.id, source: "tap" }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 429) {
          setError("Zu schnell – kurz warten.");
          return;
        }
        setError("Konnte nicht gespeichert werden.");
        return;
      }
      const data = (await res.json()) as { id: string };
      setCounts((c) => ({ ...c, [category.id]: (c[category.id] ?? 0) + 1 }));
      setLast({
        tallyId: data.id,
        categoryId: category.id,
        expiresAt: Date.now() + 6000,
      });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLast(null), 6000);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!last) return;
    const target = last;
    clearLast();
    const res = await fetch(`/api/tallies/${target.tallyId}`, { method: "DELETE" });
    if (res.ok) {
      setCounts((c) => ({
        ...c,
        [target.categoryId]: Math.max(0, (c[target.categoryId] ?? 1) - 1),
      }));
    } else {
      setError("Rückgängig fehlgeschlagen.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Eingeloggt als</p>
          <h1 className="text-xl font-semibold">{name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
            >
              Admin
            </Link>
          )}
          <button
            onClick={() => setShowPinChange(true)}
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          >
            PIN
          </button>
          <button
            onClick={logout}
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
          >
            Abmelden
          </button>
        </div>
      </header>

      <p className="mb-2 text-sm text-neutral-400">Heute</p>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => tap(c)}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-between rounded-3xl p-4 text-left shadow-lg transition active:scale-[0.97] disabled:opacity-60"
            style={{
              backgroundColor: c.color,
              color: "#0b0d12",
            }}
          >
            <span className="text-base font-bold leading-tight">{c.label}</span>
            <div className="flex w-full items-end justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                heute
              </span>
              <span className="text-5xl font-black leading-none">
                {counts[c.id] ?? 0}
              </span>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {last && (
        <div className="fixed inset-x-4 bottom-6 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-neutral-900 p-4 shadow-xl ring-1 ring-neutral-800">
          <span className="text-sm">Strich gebucht.</span>
          <button
            onClick={undo}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
          >
            Rückgängig
          </button>
        </div>
      )}

      {showPinChange && <PinChangeDialog onClose={() => setShowPinChange(false)} />}
    </main>
  );
}

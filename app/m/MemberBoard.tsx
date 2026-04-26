"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PinChangeDialog } from "@/components/PinChangeDialog";
import { SonstigesDialog } from "@/components/SonstigesDialog";
import {
  enqueue,
  flushQueue,
  getQueueFor,
  newId,
  removeById,
  type QueuedTally,
} from "@/lib/offlineQueue";

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
  const [sonstigesFor, setSonstigesFor] = useState<Category | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPending = useCallback(() => {
    setPendingCount(getQueueFor(name).length);
  }, [name]);

  const flush = useCallback(async () => {
    const result = await flushQueue(name);
    refreshPending();
    if (result.authError) {
      router.replace("/login");
      return;
    }
    if (result.sent > 0) {
      router.refresh();
    }
  }, [name, refreshPending, router]);

  // Online-/Offline-Status verfolgen + Queue-Replay
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    refreshPending();

    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void flush();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    // erster Replay-Versuch direkt nach Mount
    void flush();

    // periodisch versuchen, solange Einträge offen sind
    const t = setInterval(() => {
      if (getQueueFor(name).length > 0) void flush();
    }, 30_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(t);
    };
  }, [flush, name, refreshPending]);

  const clearLast = useCallback(() => {
    setLast(null);
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
  }, []);

  function bumpCount(categoryId: string, delta: number) {
    setCounts((c) => ({
      ...c,
      [categoryId]: Math.max(0, (c[categoryId] ?? 0) + delta),
    }));
  }

  function tap(category: Category) {
    if (busy) return;
    if (category.key === "kat5") {
      setSonstigesFor(category);
      return;
    }
    void book(category, undefined);
  }

  async function book(category: Category, note?: string) {
    setBusy(true);
    setError(null);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }

    // Optimistisch zählen
    bumpCount(category.id, +1);
    const queued: QueuedTally = {
      id: newId(),
      userName: name,
      categoryId: category.id,
      source: "tap",
      note,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/tallies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: category.id,
          source: "tap",
          ...(note ? { note } : {}),
        }),
      });

      if (res.status === 401) {
        bumpCount(category.id, -1);
        router.replace("/login");
        return;
      }
      if (res.status === 429) {
        bumpCount(category.id, -1);
        setError("Zu schnell – kurz warten.");
        return;
      }
      if (!res.ok) {
        // Server hat geantwortet aber abgelehnt -> nicht in die Offline-Queue
        bumpCount(category.id, -1);
        setError("Konnte nicht gespeichert werden.");
        return;
      }

      const data = (await res.json()) as { id: string };
      setLast({
        tallyId: data.id,
        categoryId: category.id,
        expiresAt: Date.now() + 6000,
      });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLast(null), 6000);
    } catch {
      // Netzwerk weg -> in Offline-Queue legen, optimistic count behalten
      enqueue(queued);
      refreshPending();
      setError("Offline – wird automatisch nachgereicht.");
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
      bumpCount(target.categoryId, -1);
    } else {
      setError("Rückgängig fehlgeschlagen.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function dropPending() {
    if (!window.confirm(`${pendingCount} ausstehende Buchung(en) verwerfen?`)) return;
    for (const item of getQueueFor(name)) removeById(item.id);
    refreshPending();
    router.refresh();
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isAdmin && (
            <>
              <Link
                href="/admin"
                className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
              >
                Admin
              </Link>
              <button
                onClick={async () => {
                  // Account erst abmelden, dann ins Kiosk
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.replace("/kiosk");
                }}
                className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
              >
                Tresen
              </button>
            </>
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

      {(!online || pendingCount > 0) && (
        <div
          className={`mb-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${
            online
              ? "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30"
              : "bg-red-500/10 text-red-300 ring-1 ring-red-500/30"
          }`}
        >
          <span>
            {online
              ? `${pendingCount} Buchung(en) werden nachgereicht …`
              : `Offline · ${pendingCount} ausstehend`}
          </span>
          {pendingCount > 0 && (
            <button onClick={dropPending} className="underline">
              verwerfen
            </button>
          )}
        </div>
      )}

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
                {c.key === "kat5" ? "text…" : "heute"}
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

      {sonstigesFor && (
        <SonstigesDialog
          color={sonstigesFor.color}
          busy={busy}
          onCancel={() => setSonstigesFor(null)}
          onConfirm={(note) => {
            const cat = sonstigesFor;
            setSonstigesFor(null);
            void book(cat, note);
          }}
        />
      )}
    </main>
  );
}

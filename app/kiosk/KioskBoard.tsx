"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Numpad } from "@/components/Numpad";
import { UserAvatar } from "@/components/UserAvatar";
import { SonstigesDialog } from "@/components/SonstigesDialog";

type User = { id: string; name: string };
type Category = { id: string; key: string; label: string; color: string };
type Step = "pick" | "pin" | "category" | "confirm";

const IDLE_TIMEOUT_MS = 15_000;

export function KioskBoard({
  users,
  categories,
}: {
  users: User[];
  categories: Category[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastBooking, setLastBooking] = useState<{
    user: string;
    category: string;
    color: string;
  } | null>(null);
  const [sonstigesFor, setSonstigesFor] = useState<Category | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setStep("pick");
    setSelected(null);
    setPin("");
    setError(null);
    setSonstigesFor(null);
  }, []);

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(reset, IDLE_TIMEOUT_MS);
  }, [reset]);

  useEffect(() => {
    if (step === "pick") {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    armIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [step, armIdle]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  function pickUser(user: User) {
    setSelected(user);
    setPin("");
    setError(null);
    setStep("pin");
  }

  function handleKey(k: string) {
    armIdle();
    if (busy) return;
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      // Sofort zur Kategorie-Auswahl, PIN bleibt im Speicher und wird mit gesendet.
      setTimeout(() => setStep("category"), 80);
    }
  }

  function pickCategory(category: Category) {
    armIdle();
    if (busy) return;
    if (category.key === "kat5") {
      setSonstigesFor(category);
      return;
    }
    void bookCategory(category, undefined);
  }

  async function bookCategory(category: Category, note?: string) {
    if (!selected) return;
    armIdle();
    setBusy(true);
    setError(null);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(30);
    }
    try {
      const res = await fetch("/api/kiosk/tally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selected.name,
          pin,
          categoryId: category.id,
          ...(note ? { note } : {}),
        }),
      });
      if (res.status === 401) {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        setError("PIN falsch.");
        setStep("pin");
        setPin("");
        setSonstigesFor(null);
        return;
      }
      if (!res.ok) {
        setError("Buchung fehlgeschlagen.");
        setStep("pick");
        setSonstigesFor(null);
        return;
      }
      setLastBooking({
        user: selected.name,
        category: category.label,
        color: category.color,
      });
      setSonstigesFor(null);
      setStep("confirm");
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(reset, 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      onPointerDown={armIdle}
      className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col p-6"
    >
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">Tresenmodus</p>
          <h1 className="text-2xl font-bold">Strichliste</h1>
        </div>
        <div className="flex items-center gap-2">
          {step !== "pick" && (
            <button
              onClick={reset}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
            >
              Zurück
            </button>
          )}
          {step === "pick" && (
            <button
              onClick={() => router.replace("/login")}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
            >
              Beenden
            </button>
          )}
        </div>
      </header>

      {step === "pick" && (
        <>
          <p className="mb-4 text-sm text-neutral-400">Wer trinkt?</p>
          {users.length === 0 ? (
            <p className="rounded-2xl bg-neutral-900 p-6 text-neutral-400">
              Noch keine Mitglieder angelegt.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pickUser(u)}
                  className="flex flex-col items-center gap-2 rounded-2xl p-3 transition active:scale-95 hover:bg-white/5"
                >
                  <UserAvatar name={u.name} size={88} />
                  <span className="line-clamp-1 text-sm font-medium text-neutral-100">
                    {u.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === "pin" && selected && (
        <div className="flex flex-col items-center gap-6">
          <UserAvatar name={selected.name} size={96} highlighted />
          <div className="text-center">
            <p className="text-sm text-neutral-400">Hallo,</p>
            <p className="text-2xl font-semibold">{selected.name}</p>
            <p className="mt-2 text-sm text-neutral-400">PIN eingeben</p>
          </div>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full ${
                  pin.length > i ? "bg-white" : "bg-neutral-700"
                }`}
              />
            ))}
          </div>
          <div className="w-full max-w-xs">
            <Numpad onKey={handleKey} disabled={busy} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {step === "category" && selected && (
        <div className="flex flex-col items-center gap-6">
          <UserAvatar name={selected.name} size={72} highlighted />
          <p className="text-xl font-semibold">{selected.name} – was wird's?</p>
          <div className="grid w-full max-w-2xl grid-cols-2 gap-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => pickCategory(c)}
                disabled={busy}
                className="flex aspect-square flex-col items-center justify-between rounded-3xl p-5 text-left shadow-lg transition active:scale-[0.97] disabled:opacity-60"
                style={{ backgroundColor: c.color, color: "#0b0d12" }}
              >
                <span className="text-lg font-bold leading-tight">{c.label}</span>
                <span className="self-end text-xs font-semibold uppercase opacity-70">
                  {c.key === "kat5" ? "Text…" : "+1"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sonstigesFor && selected && (
        <SonstigesDialog
          color={sonstigesFor.color}
          busy={busy}
          onCancel={() => setSonstigesFor(null)}
          onConfirm={(note) => {
            const cat = sonstigesFor;
            void bookCategory(cat, note);
          }}
        />
      )}

      {step === "confirm" && lastBooking && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full text-5xl"
            style={{ backgroundColor: lastBooking.color, color: "#0b0d12" }}
          >
            ✓
          </div>
          <p className="text-lg text-neutral-400">Gebucht für</p>
          <p className="text-3xl font-bold">{lastBooking.user}</p>
          <p className="text-base text-neutral-300">{lastBooking.category}</p>
        </div>
      )}
    </main>
  );
}

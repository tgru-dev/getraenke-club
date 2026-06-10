import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, NetworkError } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { PinPad } from "../components/PinPad";
import type { Category, ClubSettings, PublicMember } from "../../shared/types";

const INACTIVITY_MS = 15_000;
// Nach der Buchung kurz bestaetigen, dann sofort "ausloggen" (zurueck zur Mitgliederliste)
const CONFIRM_MS = 1_000;

type Step =
  | { name: "members" }
  | { name: "pin"; member: PublicMember }
  | { name: "categories"; member: PublicMember; pin: string }
  | { name: "note"; member: PublicMember; pin: string; category: Category }
  | { name: "done"; member: PublicMember; category: Category };

export function Tresen() {
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [step, setStep] = useState<Step>({ name: "members" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [note, setNote] = useState("");
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadData = useCallback(() => {
    api<PublicMember[]>("/members/public")
      .then((m) => { setMembers(m); setOffline(false); })
      .catch((e) => { if (e instanceof NetworkError) setOffline(true); });
    api<Category[]>("/categories").then(setCategories).catch(() => {});
    api<ClubSettings>("/settings").then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60_000); // Mitgliederliste aktuell halten
    const onOnline = () => { setOffline(false); loadData(); };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadData]);

  const reset = useCallback(() => {
    setStep({ name: "members" });
    setError(null);
    setNote("");
    clearTimeout(confirmTimer.current);
  }, []);

  // Inaktivitaet: nach 15 s immer zurueck zur Mitgliederliste — nie ein "offener" Account
  const touch = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(reset, INACTIVITY_MS);
  }, [reset]);

  useEffect(() => {
    if (step.name === "members") {
      clearTimeout(inactivityTimer.current);
    } else if (step.name !== "done") {
      touch();
    }
    return () => clearTimeout(inactivityTimer.current);
  }, [step, touch]);

  const submitPin = async (pin: string) => {
    if (step.name !== "pin") return;
    setBusy(true);
    setError(null);
    try {
      // PIN sofort pruefen (Login-Endpoint), Token wird verworfen
      await api("/auth/login", { method: "POST", body: { memberId: step.member.id, pin } });
      setStep({ name: "categories", member: step.member, pin });
    } catch (e) {
      if (e instanceof NetworkError) { setOffline(true); setError("Keine Verbindung"); }
      else setError(e instanceof ApiError ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const book = async (member: PublicMember, pin: string, category: Category, noteText: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await api("/tresen/book", {
        method: "POST",
        body: { memberId: member.id, pin, categoryId: category.id, note: noteText },
      });
      clearTimeout(inactivityTimer.current);
      setStep({ name: "done", member, category });
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(reset, CONFIRM_MS);
    } catch (e) {
      if (e instanceof NetworkError) { setOffline(true); setError("Keine Verbindung – Buchung nicht möglich"); }
      else setError(e instanceof ApiError ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-4xl flex-col px-6 py-6"
      onPointerDown={step.name !== "members" && step.name !== "done" ? touch : undefined}
    >
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {settings?.logo ? (
            <img src={settings.logo} alt="" className="h-10 object-contain" />
          ) : (
            <img src="/icon.svg" alt="" className="h-10 w-10" />
          )}
          <h1 className="font-display text-xl font-extrabold">{settings?.clubName ?? "Jugendclub"} · Tresen</h1>
        </div>
        {step.name !== "members" && (
          <button onClick={reset} className="rounded-xl border border-line px-4 py-2 text-muted">
            ✕ Abbrechen
          </button>
        )}
      </header>

      {offline && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-center text-danger">
          ⚠ Kein Netz – Buchungen am Tresen sind gerade nicht möglich
        </div>
      )}

      {step.name === "members" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => { setError(null); setStep({ name: "pin", member: m }); }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4
                         transition-transform active:scale-95"
            >
              <Avatar name={m.name} color={m.color} size={56} />
              <span className="w-full truncate text-center text-sm font-medium">{m.name}</span>
            </button>
          ))}
          {members.length === 0 && !offline && (
            <p className="col-span-full text-center text-muted">Lade Mitglieder …</p>
          )}
        </div>
      )}

      {step.name === "pin" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 animate-pop">
          <div className="flex items-center gap-3">
            <Avatar name={step.member.name} color={step.member.color} size={56} />
            <p className="font-display text-2xl font-bold">{step.member.name}</p>
          </div>
          <PinPad onSubmit={(pin) => void submitPin(pin)} busy={busy} error={error} />
        </div>
      )}

      {step.name === "categories" && (
        <div className="flex flex-1 flex-col animate-pop">
          <p className="mb-4 text-center text-lg text-muted">
            <strong className="text-ink">{step.member.name}</strong> – was darf's sein?
          </p>
          {error && <p className="mb-3 text-center text-danger">{error}</p>}
          <div className="grid flex-1 grid-cols-2 content-start gap-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                disabled={busy}
                onClick={() =>
                  cat.freeText
                    ? (setNote(""), setStep({ name: "note", member: step.member, pin: step.pin, category: cat }))
                    : void book(step.member, step.pin, cat, null)
                }
                className="flex min-h-32 flex-col items-start justify-between rounded-3xl border border-line
                           bg-surface p-5 transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: cat.color, boxShadow: `0 0 12px ${cat.color}99` }} />
                <span className="font-display text-2xl font-bold" style={{ color: cat.color }}>
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step.name === "note" && (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 animate-pop">
          <h2 className="font-display text-2xl font-bold">{step.category.name}</h2>
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Was war's?"
            className="rounded-xl border border-line bg-surface px-4 py-4 text-lg outline-none focus:border-amber/60"
          />
          {error && <p className="text-danger">{error}</p>}
          <button
            disabled={busy || !note.trim()}
            onClick={() => void book(step.member, step.pin, step.category, note.trim())}
            className="rounded-xl bg-amber py-4 font-display text-lg font-bold text-bg disabled:opacity-40"
          >
            +1 buchen
          </button>
        </div>
      )}

      {step.name === "done" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 animate-pop">
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
            style={{ background: `${step.category.color}26`, border: `2px solid ${step.category.color}` }}
          >
            ✓
          </span>
          <p className="font-display text-3xl font-extrabold text-center">
            {step.category.name} +1
          </p>
          <p className="text-lg text-muted">für {step.member.name} – Prost! 🍻</p>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dayKey } from "../lib/format";
import { bookDrink, removeQueued } from "../lib/offline";
import { Tally } from "../components/Tally";
import type { Category, Drink, MeSummary } from "../../shared/types";

const UNDO_WINDOW_MS = 60_000;

interface LastAction {
  kind: "online" | "queued";
  ref: number | string; // drinkId bzw. clientId
  categoryId: number;
  label: string;
  expiresAt: number;
}

export function Dashboard() {
  const { member } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [todayCounts, setTodayCounts] = useState<Map<number, number>>(new Map());
  const [monthCounts, setMonthCounts] = useState<Map<number, number>>(new Map());
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<Category | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const loadedDay = useRef(dayKey(Date.now()));

  const loadSummary = useCallback(() => {
    loadedDay.current = dayKey(Date.now());
    api<MeSummary>("/me/summary")
      .then((s) => {
        const today = new Map<number, number>();
        for (const d of s.today as Drink[]) today.set(d.categoryId, (today.get(d.categoryId) ?? 0) + 1);
        setTodayCounts(today);
        setMonthCounts(new Map(s.monthCounts.map((m) => [m.categoryId, m.count])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<Category[]>("/categories").then(setCategories).catch(() => {});
    loadSummary();

    // Tageswechsel: Striche auf den Kacheln gehoeren immer nur zum aktuellen Tag.
    // Bleibt die App ueber Mitternacht offen (PWA!), wird hier zurueckgesetzt.
    const checkDay = () => {
      if (dayKey(Date.now()) !== loadedDay.current) loadSummary();
    };
    const interval = setInterval(checkDay, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkDay();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(undoTimer.current);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadSummary]);

  const bump = (categoryId: number, delta: number) => {
    setTodayCounts((m) => new Map(m).set(categoryId, Math.max(0, (m.get(categoryId) ?? 0) + delta)));
    setMonthCounts((m) => new Map(m).set(categoryId, Math.max(0, (m.get(categoryId) ?? 0) + delta)));
  };

  const book = async (cat: Category, noteText: string | null) => {
    setError(null);
    setFlashId(cat.id);
    setTimeout(() => setFlashId(null), 500);
    bump(cat.id, 1); // optimistisch

    try {
      const result = await bookDrink(cat.id, noteText);
      const action: LastAction = {
        kind: result.status === "ok" ? "online" : "queued",
        ref: result.status === "ok" ? result.drinkId : result.clientId,
        categoryId: cat.id,
        label: noteText ? `${cat.name}: ${noteText}` : cat.name,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      };
      setLastAction(action);
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLastAction(null), UNDO_WINDOW_MS);
    } catch (e) {
      bump(cat.id, -1);
      setError(e instanceof ApiError ? e.message : "Buchung fehlgeschlagen");
    }
  };

  const tap = (cat: Category) => {
    if (cat.freeText) {
      setNote("");
      setNoteFor(cat);
    } else {
      void book(cat, null);
    }
  };

  const undo = async () => {
    if (!lastAction) return;
    const action = lastAction;
    setLastAction(null);
    clearTimeout(undoTimer.current);
    try {
      if (action.kind === "queued") {
        removeQueued(action.ref as string);
      } else {
        await api(`/drinks/${action.ref}`, { method: "DELETE" });
      }
      bump(action.categoryId, -1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Undo fehlgeschlagen");
    }
  };

  const firstName = member?.name.split(" ")[0] ?? "";
  const todayTotal = [...todayCounts.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="animate-rise">
        <p className="text-muted">Moin {firstName} 👋</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {todayTotal === 0 ? "Noch nüchtern?" : `Heute: ${todayTotal} Strich${todayTotal > 1 ? "e" : ""}`}
        </h1>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Kategorie-Kacheln: Daumenzone, 2 Spalten, 1 Tap = +1 */}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => tap(cat)}
            style={{ "--flash-color": `${cat.color}8c` } as React.CSSProperties}
            className={`flex aspect-square flex-col justify-between rounded-3xl border border-line bg-surface
                        p-4 text-left transition-transform active:scale-[0.97] ${flashId === cat.id ? "tile-flash" : ""}`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: cat.color, boxShadow: `0 0 12px ${cat.color}99` }}
            />
            <div>
              <p className="font-display text-lg font-bold leading-tight" style={{ color: cat.color }}>
                {cat.name}
              </p>
              <div className="mt-2 min-h-6">
                <Tally count={todayCounts.get(cat.id) ?? 0} color={cat.color} />
              </div>
            </div>
          </button>
        ))}
      </div>
      {/* Monatsstand */}
      <section className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
          Dein Monat
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                {cat.name}
              </span>
              <span className="font-mono text-base font-bold" style={{ color: cat.color }}>
                {monthCounts.get(cat.id) ?? 0}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Freitext-Dialog fuer "Sonstiges" */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
             onClick={() => setNoteFor(null)}>
          <div className="animate-pop w-full max-w-sm rounded-3xl border border-line bg-raised p-5"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold">{noteFor.name}</h3>
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Was war's? (z. B. Wasser)"
              className="mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-amber/60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) {
                  void book(noteFor, note.trim());
                  setNoteFor(null);
                }
              }}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setNoteFor(null)}
                      className="flex-1 rounded-xl border border-line py-2.5 text-muted">
                Abbrechen
              </button>
              <button
                disabled={!note.trim()}
                onClick={() => { void book(noteFor, note.trim()); setNoteFor(null); }}
                className="flex-1 rounded-xl bg-amber py-2.5 font-bold text-bg disabled:opacity-40"
              >
                +1 buchen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo-Snackbar (60 s) */}
      {lastAction && (
        <div className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between
                        rounded-2xl border border-line bg-raised px-4 py-3 shadow-xl animate-pop">
          <span className="text-sm">
            <strong className="text-amber">{lastAction.label}</strong> +1
            {lastAction.kind === "queued" && <span className="text-muted"> (offline gepuffert)</span>}
          </span>
          <button onClick={() => void undo()} className="font-display font-bold text-amber">
            Rückgängig
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { dayKey, formatDay, formatTime } from "../lib/format";
import type { Drink } from "../../shared/types";

export function History() {
  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<Drink[]>("/me/history").then(setDrinks).catch(() => setError(true));
  }, []);

  const groups = new Map<string, Drink[]>();
  for (const d of drinks ?? []) {
    const key = dayKey(d.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold animate-rise">Dein Verlauf</h1>
      {error && <p className="text-danger">Verlauf konnte nicht geladen werden (offline?).</p>}
      {drinks?.length === 0 && <p className="text-muted">Noch keine Striche. Zeit, das zu ändern? 🍻</p>}
      {[...groups.entries()].map(([key, list]) => (
        <section key={key} className="animate-rise">
          <h2 className="mb-2 flex items-baseline justify-between font-display text-sm font-bold uppercase tracking-wider text-muted">
            {formatDay(list[0].createdAt)}
            <span className="font-mono text-xs">{list.length}×</span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((d, i) => (
              <div
                key={d.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line/60" : ""}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: d.categoryColor }} />
                <span className="flex-1 truncate">
                  {d.categoryName}
                  {d.note && <span className="text-muted"> · {d.note}</span>}
                </span>
                {d.source !== "mitglied" && (
                  <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] uppercase text-muted">
                    {d.source}
                  </span>
                )}
                <span className="font-mono text-sm text-muted">{formatTime(d.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

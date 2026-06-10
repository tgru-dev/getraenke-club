import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import type { Category } from "../../../shared/types";

export function Kategorien() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const load = useCallback(() => {
    api<Category[]>("/admin/categories")
      .then(setCategories)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Fehler beim Laden"));
  }, []);

  useEffect(load, [load]);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setError(null);
    try {
      await api(`/admin/categories/${id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen");
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    // Reihenfolge beider Kategorien tauschen
    void patch(categories[index].id, { sortOrder: target });
    void patch(categories[target].id, { sortOrder: index });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api("/admin/categories", {
        method: "POST",
        body: { name: newName.trim(), sortOrder: categories.length },
      });
      setNewName("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen");
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Kategorien</h1>
      {error && <p className="text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        {categories.map((c, i) => (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 ${
              !c.active ? "opacity-50" : ""
            }`}
          >
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted disabled:opacity-20">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === categories.length - 1} className="text-muted disabled:opacity-20">▼</button>
            </div>
            <input
              type="color"
              value={c.color}
              onChange={(e) => void patch(c.id, { color: e.target.value })}
              className="h-9 w-9 cursor-pointer rounded-lg border border-line bg-transparent"
              title="Farbe"
            />
            <input
              defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() !== c.name && void patch(c.id, { name: e.target.value.trim() })}
              className="min-w-40 flex-1 rounded-xl border border-line bg-raised px-3 py-2"
            />
            <label className="flex items-center gap-1 text-sm text-muted" title="Preis für die Abrechnung (leer = ohne Preis)">
              <input
                key={`price-${c.id}-${c.price ?? "none"}`}
                defaultValue={typeof c.price === "number" ? (c.price / 100).toFixed(2).replace(".", ",") : ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim().replace(",", ".");
                  const parsed = raw === "" ? null : Math.round(parseFloat(raw) * 100);
                  if (parsed !== null && !Number.isFinite(parsed)) return;
                  if (parsed !== (c.price ?? null)) void patch(c.id, { price: parsed });
                }}
                placeholder="–,––"
                inputMode="decimal"
                className="w-20 rounded-xl border border-line bg-raised px-2 py-2 text-right font-mono"
              />
              €
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted" title="Beim Buchen wird ein Textfeld abgefragt">
              <input
                type="checkbox"
                checked={c.freeText}
                onChange={(e) => void patch(c.id, { freeText: e.target.checked })}
                className="accent-(--color-amber)"
              />
              Textfeld
            </label>
            <button
              onClick={() => void patch(c.id, { active: !c.active })}
              className={`text-sm ${c.active ? "text-danger" : "text-ok"} hover:underline`}
            >
              {c.active ? "deaktivieren" : "aktivieren"}
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Neue Kategorie …"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5"
        />
        <button disabled={!newName.trim()} className="rounded-xl bg-amber px-5 py-2.5 font-bold text-bg disabled:opacity-40">
          + Anlegen
        </button>
      </form>
      <p className="text-sm text-muted">
        Deaktivierte Kategorien verschwinden aus den Buchungs-Ansichten, historische Striche bleiben erhalten.
        Der Preis wird nur für die Abrechnung verwendet — Mitglieder sehen keine Beträge.
      </p>
    </div>
  );
}

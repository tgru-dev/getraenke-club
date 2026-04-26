"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Cat = {
  id: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  freetext: boolean;
  tallyCount: number;
};

const DEFAULT_COLORS = [
  "#f59e0b",
  "#a855f7",
  "#0ea5e9",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

export function CategoriesClient({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[5]);
  const [newFreetext, setNewFreetext] = useState(false);

  async function create() {
    setError(null);
    if (!newLabel.trim()) {
      setError("Name fehlt.");
      return;
    }
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newLabel.trim(),
        color: newColor,
        freetext: newFreetext,
      }),
    });
    if (!res.ok) {
      setError("Anlegen fehlgeschlagen.");
      return;
    }
    setNewLabel("");
    setNewColor(DEFAULT_COLORS[5]);
    setNewFreetext(false);
    startTransition(() => router.refresh());
  }

  async function patch(id: string, data: Partial<Cat>) {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) alert("Speichern fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  async function remove(c: Cat) {
    const msg =
      c.tallyCount > 0
        ? `„${c.label}" wirklich löschen? ${c.tallyCount} Strich(e) gehen mit weg.`
        : `„${c.label}" wirklich löschen?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) alert("Löschen fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Kategorien</h1>

      <section className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">Neue Kategorie</h2>
        <div className="grid gap-3 md:grid-cols-[2fr_auto_auto_auto]">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Name (z.B. Wein)"
            maxLength={60}
            className="rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-10 w-20 cursor-pointer rounded bg-neutral-800"
            title="Farbe wählen"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={newFreetext}
              onChange={(e) => setNewFreetext(e.target.checked)}
            />
            Texteingabe
          </label>
          <button
            onClick={create}
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-neutral-900 disabled:opacity-50"
          >
            Anlegen
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <p className="mt-3 text-xs text-neutral-500">
          „Texteingabe": beim Tippen erscheint ein Eingabefeld statt
          direkt zu zählen (z.B. für Sonstiges).
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl ring-1 ring-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Farbe</th>
              <th className="px-4 py-3 text-left">Texteingabe</th>
              <th className="px-4 py-3 text-right">Striche gesamt</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t border-neutral-800">
                <td className="px-4 py-3 tabular-nums">
                  <input
                    type="number"
                    defaultValue={c.sortOrder}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n) && n !== c.sortOrder) {
                        patch(c.id, { sortOrder: n });
                      }
                    }}
                    className="w-16 rounded bg-neutral-800 px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    defaultValue={c.label}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== c.label) patch(c.id, { label: v });
                    }}
                    className="w-full rounded bg-neutral-800 px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={c.color}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v && v !== c.color) patch(c.id, { color: v });
                      }}
                      className="h-8 w-12 cursor-pointer rounded bg-neutral-800"
                    />
                    <span
                      className="inline-block h-5 w-5 rounded"
                      style={{ backgroundColor: c.color }}
                      title={c.color}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    defaultChecked={c.freetext}
                    onChange={(e) => patch(c.id, { freetext: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.tallyCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(c)}
                    className="rounded bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

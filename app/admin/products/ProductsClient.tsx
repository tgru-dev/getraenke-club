"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; label: string; color: string };
type Product = {
  id: string;
  ean: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
  source: string;
  tallyCount: number;
};

export function ProductsClient({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");

  async function setCategory(id: string, categoryId: string) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    if (!res.ok) alert("Fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  async function rename(id: string, current: string) {
    const next = window.prompt("Neuer Name:", current);
    if (!next || next.trim() === current) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next.trim() }),
    });
    if (!res.ok) alert("Fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`„${name}" wirklich löschen? Bestehende Striche bleiben erhalten.`))
      return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  const filtered = products.filter((p) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.ean.includes(q);
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Produkte / Barcodes</h1>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Suche nach Name oder EAN…"
        className="rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
      />

      <section className="overflow-hidden rounded-2xl ring-1 ring-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">EAN</th>
              <th className="px-4 py-3 text-left">Kategorie</th>
              <th className="px-4 py-3 text-left">Quelle</th>
              <th className="px-4 py-3 text-right">Striche</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-neutral-500"
                >
                  Noch keine Produkte gespeichert.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-t border-neutral-800">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                    {p.ean}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.categoryId}
                      onChange={(e) => setCategory(p.id, e.target.value)}
                      disabled={pending}
                      className="rounded bg-neutral-800 px-2 py-1"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{p.source}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.tallyCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => rename(p.id, p.name)}
                        className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                      >
                        Umbenennen
                      </button>
                      <button
                        onClick={() => remove(p.id, p.name)}
                        className="rounded bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getToken } from "../../lib/api";
import { RangeFilter, type Range } from "../../components/RangeFilter";
import { rangeFor, formatDateTime } from "../../lib/format";
import type { Category, Drink, OverviewRow } from "../../../shared/types";

export function Strichliste() {
  const [range, setRange] = useState<Range>(() => rangeFor("monat"));
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<OverviewRow | null>(null);
  const [drinks, setDrinks] = useState<Drink[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formular "Strich nachtragen"
  const [newCat, setNewCat] = useState<number | "">("");
  const [newWhen, setNewWhen] = useState("");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    api<Category[]>("/admin/categories").then(setCategories).catch(() => {});
  }, []);

  const loadOverview = useCallback(() => {
    api<OverviewRow[]>(`/admin/overview?from=${range.from}&to=${range.to}`)
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Fehler beim Laden"));
  }, [range]);

  const loadDrilldown = useCallback(
    (memberId: number) => {
      api<Drink[]>(`/admin/members/${memberId}/drinks?from=${range.from}&to=${range.to}`)
        .then(setDrinks)
        .catch(() => setDrinks([]));
    },
    [range]
  );

  useEffect(loadOverview, [loadOverview]);
  useEffect(() => {
    if (selected) loadDrilldown(selected.memberId);
  }, [selected, loadDrilldown]);

  const reload = () => {
    loadOverview();
    if (selected) loadDrilldown(selected.memberId);
  };

  const deleteDrink = async (id: number) => {
    if (!confirm("Diesen Strich wirklich löschen? (wird im Audit-Log vermerkt)")) return;
    try {
      await api(`/admin/drinks/${id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Löschen fehlgeschlagen");
    }
  };

  const addDrink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !newCat) return;
    try {
      await api("/admin/drinks", {
        method: "POST",
        body: {
          memberId: selected.memberId,
          categoryId: newCat,
          note: newNote || undefined,
          createdAt: newWhen ? new Date(newWhen).getTime() : undefined,
        },
      });
      setNewNote("");
      setNewWhen("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nachtragen fehlgeschlagen");
    }
  };

  const activeCats = categories.filter((c) => c.active);
  const exportUrl = `/api/admin/export.csv?from=${range.from}&to=${range.to}&token=${getToken()}`;
  const grandTotal = rows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Strichliste</h1>
        <a
          href={exportUrl}
          download
          className="rounded-xl border border-amber/50 bg-amber/10 px-4 py-2 text-sm font-bold text-amber"
        >
          ⬇ CSV-Export
        </a>
      </header>
      <RangeFilter value={range} onChange={setRange} />
      {error && <p className="text-danger">{error}</p>}

      <div className="overflow-auto rounded-2xl border border-line bg-surface" style={{ maxHeight: "55vh" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-raised">
            <tr className="text-left text-muted">
              <th className="px-4 py-3 font-medium">Mitglied</th>
              {activeCats.map((c) => (
                <th key={c.id} className="px-3 py-3 text-right font-medium whitespace-nowrap">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Σ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.memberId}
                onClick={() => setSelected(selected?.memberId === r.memberId ? null : r)}
                className={`cursor-pointer border-t border-line/60 transition-colors hover:bg-raised/60 ${
                  selected?.memberId === r.memberId ? "bg-amber/10" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-medium">
                  {r.memberName}
                  {!r.active && <span className="ml-2 text-xs text-muted">(inaktiv)</span>}
                </td>
                {activeCats.map((c) => (
                  <td key={c.id} className="px-3 py-2.5 text-right font-mono">
                    {r.counts[c.id] ?? ""}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-mono font-bold text-amber">{r.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-raised">
            <tr className="border-t border-line font-bold">
              <td className="px-4 py-2.5">Gesamt</td>
              {activeCats.map((c) => (
                <td key={c.id} className="px-3 py-2.5 text-right font-mono">
                  {rows.reduce((a, r) => a + (r.counts[c.id] ?? 0), 0) || ""}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-mono text-amber">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selected && (
        <section className="animate-rise rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">
            Einzelbuchungen · {selected.memberName}
          </h2>

          <form onSubmit={addDrink} className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={newCat}
              onChange={(e) => setNewCat(Number(e.target.value) || "")}
              className="rounded-xl border border-line bg-raised px-3 py-2 text-sm"
              required
            >
              <option value="">Kategorie …</option>
              {activeCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={newWhen}
              onChange={(e) => setNewWhen(e.target.value)}
              className="rounded-xl border border-line bg-raised px-3 py-2 text-sm"
            />
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Notiz (optional)"
              className="rounded-xl border border-line bg-raised px-3 py-2 text-sm"
            />
            <button className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-bg">
              + Strich nachtragen
            </button>
          </form>

          <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-line/60">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-raised text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Zeitpunkt</th>
                  <th className="px-3 py-2 font-medium">Kategorie</th>
                  <th className="px-3 py-2 font-medium">Notiz</th>
                  <th className="px-3 py-2 font-medium">Quelle</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {drinks?.map((d) => (
                  <tr key={d.id} className="border-t border-line/40">
                    <td className="px-3 py-2 font-mono">{formatDateTime(d.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: d.categoryColor }} />
                      {d.categoryName}
                    </td>
                    <td className="px-3 py-2 text-muted">{d.note}</td>
                    <td className="px-3 py-2 text-muted">{d.source}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => void deleteDrink(d.id)} className="text-danger hover:underline">
                        löschen
                      </button>
                    </td>
                  </tr>
                ))}
                {drinks?.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">Keine Buchungen im Zeitraum</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

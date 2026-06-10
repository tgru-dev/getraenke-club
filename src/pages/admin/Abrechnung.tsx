import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { BillingResponse } from "../../../shared/types";

const euro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Jahresgrenzen in lokaler Zeit */
function yearRange(year: number): { from: number; to: number } {
  return {
    from: new Date(year, 0, 1).getTime(),
    to: new Date(year + 1, 0, 1).getTime(),
  };
}

export function Abrechnung() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<BillingResponse | null>(null);

  useEffect(() => {
    const { from, to } = yearRange(year);
    api<BillingResponse>(`/admin/billing?from=${from}&to=${to}`)
      .then(setData)
      .catch(() => {});
  }, [year]);

  const years = useMemo(
    () => Array.from({ length: 4 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const cats = data?.categories ?? [];
  const rows = data?.rows ?? [];
  const hasPrices = cats.some((c) => typeof c.price === "number");
  const grandTotal = rows.reduce((a, r) => a + r.total, 0);
  const grandAmount = rows.reduce((a, r) => a + r.amountCents, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Abrechnung {year}</h1>
        <div className="flex gap-2 print:hidden">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-medium ${
                year === y
                  ? "border-amber/60 bg-amber/15 text-amber"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {y}
            </button>
          ))}
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-muted hover:text-ink"
          >
            🖨 Drucken
          </button>
        </div>
      </header>

      {!hasPrices && (
        <p className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber print:hidden">
          Es sind noch keine Preise hinterlegt — Beträge bleiben leer. Preise pflegst du
          unter <Link to="/admin/kategorien" className="underline">Kategorien</Link>.
        </p>
      )}

      <div className="overflow-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-raised text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Mitglied</th>
              {cats.map((c) => (
                <th key={c.id} className="px-3 py-3 text-right font-medium whitespace-nowrap">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  {typeof c.price === "number" && (
                    <span className="block text-[11px] font-normal">à {euro(c.price)}</span>
                  )}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">Σ Striche</th>
              <th className="px-4 py-3 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId} className="border-t border-line/60">
                <td className="px-4 py-2.5 font-medium">
                  {r.memberName}
                  {r.memberDeleted && <span className="ml-2 text-xs text-muted">(gelöscht)</span>}
                </td>
                {cats.map((c) => (
                  <td key={c.id} className="px-3 py-2.5 text-right font-mono">
                    {r.counts[c.id] ?? ""}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right font-mono">{r.total}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-amber">
                  {r.amountCents > 0 ? euro(r.amountCents) : "–"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cats.length + 3} className="px-4 py-8 text-center text-muted">
                  Keine Buchungen in {year}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-raised font-bold">
            <tr className="border-t border-line">
              <td className="px-4 py-2.5">Gesamt</td>
              {cats.map((c) => (
                <td key={c.id} className="px-3 py-2.5 text-right font-mono">
                  {rows.reduce((a, r) => a + (r.counts[c.id] ?? 0), 0) || ""}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-mono">{grandTotal}</td>
              <td className="px-4 py-2.5 text-right font-mono text-amber">
                {grandAmount > 0 ? euro(grandAmount) : "–"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-muted print:hidden">
        Beträge = Striche × Kategoriepreis. Kategorien ohne Preis zählen nur in der
        Strich-Summe. Stornierte Buchungen sind nicht enthalten.
      </p>
    </div>
  );
}

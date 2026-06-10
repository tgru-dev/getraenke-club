import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { RangeFilter, type Range } from "../../components/RangeFilter";
import { formatDateTime, rangeFor } from "../../lib/format";
import type { LogEntry } from "../../../shared/types";

const SOURCE_LABELS: Record<string, string> = {
  mitglied: "App",
  tresen: "Tresen",
  admin: "Admin",
};

export function GetraenkeLog() {
  const [range, setRange] = useState<Range>(() => rangeFor("woche"));
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<LogEntry[]>(`/admin/log?from=${range.from}&to=${range.to}`)
      .then(setEntries)
      .catch(() => {});
  }, [range]);

  useEffect(load, [load]);

  const storno = async (e: LogEntry) => {
    if (!confirm(`Strich von ${e.memberName} (${e.categoryName}) stornieren?`)) return;
    setError(null);
    try {
      await api(`/admin/drinks/${e.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Stornieren fehlgeschlagen");
    }
  };

  const restore = async (e: LogEntry) => {
    setError(null);
    try {
      await api(`/admin/drinks/${e.id}/restore`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Wiederherstellen fehlgeschlagen");
    }
  };

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (showDeleted || !e.deletedAt) &&
          (!memberFilter || e.memberName?.toLowerCase().includes(memberFilter.toLowerCase()))
      ),
    [entries, memberFilter, showDeleted]
  );

  const stornoCount = entries.filter((e) => e.deletedAt).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Getränke-Log</h1>
        <span className="font-mono text-sm text-muted">
          {entries.length} Buchungen · {stornoCount} storniert
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <RangeFilter value={range} onChange={setRange} />
        <span className="mx-1 text-muted">·</span>
        <input
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          placeholder="Mitglied filtern …"
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="accent-(--color-amber)"
          />
          Stornierte zeigen
        </label>
      </div>

      {error && <p className="text-danger">{error}</p>}

      <div className="overflow-auto rounded-2xl border border-line bg-surface" style={{ maxHeight: "70vh" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-raised text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Zeitpunkt</th>
              <th className="px-4 py-3 font-medium">Mitglied</th>
              <th className="px-4 py-3 font-medium">Kategorie</th>
              <th className="px-4 py-3 font-medium">Notiz</th>
              <th className="px-4 py-3 font-medium">Quelle</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.id}
                className={`border-t border-line/60 ${e.deletedAt ? "text-muted" : ""}`}
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-mono">{formatDateTime(e.createdAt)}</td>
                <td className={`px-4 py-2.5 font-medium ${e.deletedAt ? "line-through" : ""}`}>
                  {e.memberName}
                </td>
                <td className={`px-4 py-2.5 ${e.deletedAt ? "line-through" : ""}`}>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: e.categoryColor }} />
                  {e.categoryName}
                </td>
                <td className="px-4 py-2.5 text-muted">{e.note}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-md bg-raised px-1.5 py-0.5 text-xs text-muted">
                    {SOURCE_LABELS[e.source] ?? e.source}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {e.deletedAt ? (
                    <span
                      className="rounded-lg bg-danger/15 px-2 py-0.5 text-xs text-danger"
                      title={`storniert am ${formatDateTime(e.deletedAt)}`}
                    >
                      storniert · {formatDateTime(e.deletedAt)}
                      {e.deletedByName && e.deletedByName !== e.memberName
                        ? ` von ${e.deletedByName}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-ok">✓</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {e.deletedAt ? (
                    <button onClick={() => void restore(e)} className="text-ok hover:underline">
                      wiederherstellen
                    </button>
                  ) : (
                    <button
                      onClick={() => void storno(e)}
                      title="Strich stornieren"
                      aria-label="Strich stornieren"
                      className="h-7 w-7 rounded-lg border border-line text-danger leading-none
                                 hover:border-danger/60 hover:bg-danger/10"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Keine Buchungen im Zeitraum
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        Jeder Strich erscheint hier dauerhaft – auch nach Undo oder Stornierung (als „storniert" markiert).
        Stornieren und Wiederherstellen ist jederzeit möglich und wird im Audit-Log festgehalten.
      </p>
    </div>
  );
}

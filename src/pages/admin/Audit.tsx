import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { AuditEntry } from "../../../shared/types";

const ACTION_LABELS: Record<string, string> = {
  setup: "Erst-Einrichtung",
  mitglied_angelegt: "Mitglied angelegt",
  mitglied_registriert: "Selbst registriert",
  mitglied_geaendert: "Mitglied geändert",
  kategorie_angelegt: "Kategorie angelegt",
  kategorie_geaendert: "Kategorie geändert",
  strich_nachgetragen: "Strich nachgetragen",
  strich_geloescht: "Strich storniert",
  strich_wiederhergestellt: "Strich wiederhergestellt",
  einstellungen_geaendert: "Einstellungen geändert",
};

export function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api<AuditEntry[]>("/admin/audit").then(setEntries).catch(() => {});
  }, []);

  const formatDetails = (details: string | null) => {
    if (!details) return "";
    try {
      const obj = JSON.parse(details) as Record<string, unknown>;
      return Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join(" · ");
    } catch {
      return details;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Audit-Log</h1>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-raised text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Zeitpunkt</th>
              <th className="px-4 py-3 font-medium">Wer</th>
              <th className="px-4 py-3 font-medium">Aktion</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-line/60 align-top">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono">{formatDateTime(e.createdAt)}</td>
                <td className="px-4 py-2.5">{e.actorName ?? "–"}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="rounded-lg bg-amber/15 px-2 py-0.5 text-amber">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{formatDetails(e.details)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Noch keine Einträge</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

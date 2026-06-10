import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Avatar } from "../../components/Avatar";
import { AVATAR_COLORS as COLORS } from "../../lib/format";
import type { AdminMember } from "../../../shared/types";

export function Mitglieder() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", pin: "", role: "mitglied", color: COLORS[0] });

  const load = useCallback(() => {
    api<AdminMember[]>("/admin/members")
      .then(setMembers)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Fehler beim Laden"));
  }, []);

  useEffect(load, [load]);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setError(null);
    try {
      await api(`/admin/members/${id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Speichern fehlgeschlagen");
    }
  };

  const finalDelete = async (m: AdminMember) => {
    if (
      !confirm(
        `"${m.name}" endgültig löschen?\n\nDas Konto verschwindet überall (Login, Tresen, Verwaltung). ` +
          `Die Buchungen bleiben im Getränke-Log und in der Abrechnung erhalten.\n\nDas kann nicht rückgängig gemacht werden.`
      )
    )
      return;
    setError(null);
    try {
      await api(`/admin/members/${m.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Löschen fehlgeschlagen");
    }
  };

  const resetPin = (m: AdminMember) => {
    const pin = prompt(`Neue 4-stellige PIN für ${m.name}:`);
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin)) return setError("PIN muss genau 4 Ziffern haben");
    void patch(m.id, { pin });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/admin/members", { method: "POST", body: form });
      setForm({ name: "", pin: "", role: "mitglied", color: COLORS[Math.floor(Math.random() * COLORS.length)] });
      setShowNew(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">Mitglieder</h1>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-xl bg-amber px-4 py-2 font-bold text-bg"
        >
          + Neues Mitglied
        </button>
      </header>
      {error && <p className="text-danger">{error}</p>}

      {showNew && (
        <form onSubmit={create} className="animate-pop flex flex-wrap items-center gap-3 rounded-2xl border border-amber/40 bg-surface p-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            required
            className="rounded-xl border border-line bg-raised px-3 py-2"
          />
          <input
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="PIN (4 Ziffern)"
            required
            inputMode="numeric"
            className="w-36 rounded-xl border border-line bg-raised px-3 py-2 font-mono"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-xl border border-line bg-raised px-3 py-2"
          >
            <option value="mitglied">Mitglied</option>
            <option value="vorstand">Vorstand</option>
          </select>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className={`h-7 w-7 rounded-full ${form.color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            disabled={form.pin.length !== 4 || !form.name.trim()}
            className="rounded-xl bg-amber px-4 py-2 font-bold text-bg disabled:opacity-40"
          >
            Anlegen
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-raised text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={`border-t border-line/60 ${!m.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} color={m.color} size={32} />
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={m.role}
                    onChange={(e) => void patch(m.id, { role: e.target.value })}
                    className="rounded-lg border border-line bg-raised px-2 py-1"
                  >
                    <option value="mitglied">Mitglied</option>
                    <option value="vorstand">Vorstand</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  {m.active ? <span className="text-ok">aktiv</span> : <span className="text-muted">deaktiviert</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => resetPin(m)} className="text-amber hover:underline">
                      PIN zurücksetzen
                    </button>
                    <button
                      onClick={() => void patch(m.id, { active: !m.active })}
                      className={m.active ? "text-danger hover:underline" : "text-ok hover:underline"}
                    >
                      {m.active ? "deaktivieren" : "aktivieren"}
                    </button>
                    {!m.active && (
                      <button
                        onClick={() => void finalDelete(m)}
                        title="Endgültig löschen – Buchungen bleiben im Getränke-Log"
                        className="font-medium text-danger hover:underline"
                      >
                        🗑 löschen
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        Erst deaktivieren, dann optional endgültig löschen. Auch beim endgültigen Löschen bleiben
        alle Buchungen im Getränke-Log und in der Abrechnung nachvollziehbar.
      </p>
    </div>
  );
}

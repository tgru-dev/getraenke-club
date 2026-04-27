"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string;
  role: "member" | "admin";
  active: boolean;
  createdAt: string;
  tallyCount: number;
};

export function UsersClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");

  async function createUser() {
    setError(null);
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN muss 4 Ziffern haben.");
      return;
    }
    if (!newName.trim()) {
      setError("Name fehlt.");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), pin: newPin, role: newRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Anlegen fehlgeschlagen.");
      return;
    }
    setNewName("");
    setNewPin("");
    setNewRole("member");
    startTransition(() => router.refresh());
  }

  async function setPin(id: string) {
    const pin = window.prompt("Neue 4-stellige PIN:");
    if (!pin) return;
    if (!/^\d{4}$/.test(pin)) {
      alert("PIN muss 4 Ziffern haben.");
      return;
    }
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) alert("Fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  async function rename(id: string, current: string) {
    const next = window.prompt("Neuer Name:", current);
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === current) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const map: Record<string, string> = {
        name_taken: "Name ist bereits vergeben.",
      };
      alert(map[data?.error] ?? "Umbenennen fehlgeschlagen.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (!res.ok) alert("Fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  async function setRole(id: string, role: "member" | "admin") {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) alert("Fehlgeschlagen.");
    startTransition(() => router.refresh());
  }

  async function remove(id: string, name: string, tallyCount: number) {
    const msg =
      tallyCount > 0
        ? `„${name}" löschen? Das Mitglied wird ausgeblendet, ${tallyCount} bestehende Striche bleiben in der Historie erhalten.`
        : `„${name}" löschen?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const map: Record<string, string> = {
        cannot_delete_self: "Du kannst dich nicht selbst löschen.",
        last_admin: "Du bist der letzte Vorstand – nicht löschbar.",
      };
      alert(map[data?.error] ?? "Löschen fehlgeschlagen.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Mitglieder</h1>

      <section className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">Neues Mitglied</h2>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="PIN (4 Ziffern)"
            inputMode="numeric"
            className="rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "member" | "admin")}
            className="rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <option value="member">Mitglied</option>
            <option value="admin">Vorstand</option>
          </select>
          <button
            onClick={createUser}
            disabled={pending}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-neutral-900 disabled:opacity-50"
          >
            Anlegen
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl ring-1 ring-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Rolle</th>
              <th className="px-4 py-3 text-left">Aktiv</th>
              <th className="px-4 py-3 text-left">Striche gesamt</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-800">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      setRole(u.id, e.target.value as "member" | "admin")
                    }
                    className="rounded bg-neutral-800 px-2 py-1"
                  >
                    <option value="member">Mitglied</option>
                    <option value="admin">Vorstand</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(u.id, u.active)}
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      u.active
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-neutral-700 text-neutral-300"
                    }`}
                  >
                    {u.active ? "aktiv" : "inaktiv"}
                  </button>
                </td>
                <td className="px-4 py-3 tabular-nums">{u.tallyCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => rename(u.id, u.name)}
                      className="rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
                    >
                      Umbenennen
                    </button>
                    <button
                      onClick={() => setPin(u.id)}
                      className="rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
                    >
                      PIN ändern
                    </button>
                    <button
                      onClick={() => remove(u.id, u.name, u.tallyCount)}
                      className="rounded bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

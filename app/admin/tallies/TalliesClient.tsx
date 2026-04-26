"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Category = { id: string; label: string; color: string };
type UserRef = { id: string; name: string };
type RecentRow = {
  id: string;
  userName: string;
  categoryLabel: string;
  categoryColor: string;
  source: string;
  note: string | null;
  createdAt: string;
  deletedAt: string | null;
  deletedByName: string | null;
};

export function TalliesClient({
  from,
  to,
  userId,
  users,
  categories,
  matrix,
  recent,
}: {
  from: string;
  to: string;
  userId: string;
  users: UserRef[];
  categories: Category[];
  matrix: Record<string, Record<string, number>>;
  recent: RecentRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const [localUser, setLocalUser] = useState(userId);

  function applyFilters() {
    const params = new URLSearchParams(searchParams);
    params.set("from", localFrom);
    params.set("to", localTo);
    if (localUser) params.set("userId", localUser);
    else params.delete("userId");
    startTransition(() => router.push(`/admin/tallies?${params.toString()}`));
  }

  async function deleteTally(id: string) {
    if (!window.confirm("Diesen Strich wirklich löschen?")) return;
    const res = await fetch(`/api/tallies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Löschen fehlgeschlagen.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const totalsPerUser = Object.entries(matrix).map(([uid, perCat]) => ({
    uid,
    name: users.find((u) => u.id === uid)?.name ?? "?",
    perCat,
    total: Object.values(perCat).reduce((a, b) => a + b, 0),
  }));
  totalsPerUser.sort((a, b) => b.total - a.total);

  const exportHref = `/api/admin/tallies/export?from=${localFrom}&to=${localTo}${
    localUser ? `&userId=${localUser}` : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Strichliste</h1>
        <a
          href={exportHref}
          className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
        >
          CSV exportieren
        </a>
      </div>

      <section className="flex flex-wrap items-end gap-3 rounded-2xl bg-neutral-900 p-4 ring-1 ring-neutral-800">
        <Field label="Von">
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="rounded-lg bg-neutral-800 px-3 py-2"
          />
        </Field>
        <Field label="Bis">
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="rounded-lg bg-neutral-800 px-3 py-2"
          />
        </Field>
        <Field label="Mitglied">
          <select
            value={localUser}
            onChange={(e) => setLocalUser(e.target.value)}
            className="rounded-lg bg-neutral-800 px-3 py-2"
          >
            <option value="">Alle</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          onClick={applyFilters}
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 font-semibold text-neutral-900"
        >
          Filtern
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl ring-1 ring-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-left">Mitglied</th>
              {categories.map((c) => (
                <th key={c.id} className="px-4 py-3 text-right">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Summe</th>
            </tr>
          </thead>
          <tbody>
            {totalsPerUser.length === 0 ? (
              <tr>
                <td
                  colSpan={categories.length + 2}
                  className="px-4 py-6 text-center text-neutral-500"
                >
                  Keine Striche im gewählten Zeitraum.
                </td>
              </tr>
            ) : (
              totalsPerUser.map((row) => (
                <tr key={row.uid} className="border-t border-neutral-800">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  {categories.map((c) => (
                    <td key={c.id} className="px-4 py-3 text-right tabular-nums">
                      {row.perCat[c.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {row.total}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Letzte Buchungen</h2>
        <div className="overflow-hidden rounded-2xl ring-1 ring-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-4 py-3 text-left">Zeit</th>
                <th className="px-4 py-3 text-left">Mitglied</th>
                <th className="px-4 py-3 text-left">Kategorie</th>
                <th className="px-4 py-3 text-left">Quelle</th>
                <th className="px-4 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    —
                  </td>
                </tr>
              ) : (
                recent.map((t) => {
                  const undone = Boolean(t.deletedAt);
                  return (
                    <tr
                      key={t.id}
                      className={`border-t border-neutral-800 ${
                        undone ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-neutral-400">
                        {new Date(t.createdAt).toLocaleString("de-DE")}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          undone ? "text-neutral-500 line-through" : ""
                        }`}
                      >
                        {t.userName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            undone ? "opacity-50 line-through" : ""
                          }`}
                          style={{
                            backgroundColor: t.categoryColor,
                            color: "#0b0d12",
                          }}
                        >
                          {t.categoryLabel}
                        </span>
                        {t.note && (
                          <span
                            className={`ml-2 text-xs ${
                              undone
                                ? "text-neutral-500 line-through"
                                : "text-neutral-300"
                            }`}
                          >
                            „{t.note}"
                          </span>
                        )}
                        {undone && (
                          <span className="ml-2 text-xs text-red-300">
                            rückgängig
                            {t.deletedByName ? ` (${t.deletedByName})` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-400">{t.source}</td>
                      <td className="px-4 py-3 text-right">
                        {!undone && (
                          <button
                            onClick={() => deleteTally(t.id)}
                            className="rounded bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30"
                          >
                            löschen
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

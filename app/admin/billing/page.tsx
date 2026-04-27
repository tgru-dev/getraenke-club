import { prisma } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { RangePicker } from "@/components/RangePicker";
import { rangeFromKey, isRangeKey, type RangeKey } from "@/lib/range";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rangeKey: RangeKey = isRangeKey(params.range) ? params.range : "month";
  const { from, to, label } = rangeFromKey(rangeKey);

  const [users, categories, perUserCat] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true, deletedAt: true },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tally.groupBy({
      by: ["userId", "categoryId"],
      where: { createdAt: { gte: from, lte: to }, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const matrix: Record<string, Record<string, number>> = {};
  for (const r of perUserCat) {
    matrix[r.userId] ??= {};
    matrix[r.userId][r.categoryId] = r._count._all;
  }

  const priceById = new Map(categories.map((c) => [c.id, c.priceCents]));

  const rows = users
    .map((u) => {
      const counts = matrix[u.id] ?? {};
      const totalCents = Object.entries(counts).reduce(
        (sum, [catId, cnt]) => sum + cnt * (priceById.get(catId) ?? 0),
        0,
      );
      const totalStriche = Object.values(counts).reduce((a, b) => a + b, 0);
      return { user: u, counts, totalCents, totalStriche };
    })
    // Inaktive ans Ende, sonst nach Schuldenhöhe
    .sort((a, b) => {
      if (a.user.active !== b.user.active) return a.user.active ? -1 : 1;
      return b.totalCents - a.totalCents;
    });

  const grandTotalCents = rows.reduce((s, r) => s + r.totalCents, 0);
  const grandTotalStriche = rows.reduce((s, r) => s + r.totalStriche, 0);

  const csvHref = `/api/admin/billing/export?range=${rangeKey}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Abrechnung</h1>
        <div className="flex items-center gap-3">
          <RangePicker active={rangeKey} basePath="/admin/billing" />
          <a
            href={csvHref}
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={`Offene Summe · ${label}`} value={formatEur(grandTotalCents)} />
        <Stat label="Striche" value={String(grandTotalStriche)} />
        <Stat
          label="Aktive Mitglieder"
          value={String(users.filter((u) => u.active).length)}
        />
      </div>

      <section className="overflow-x-auto rounded-2xl ring-1 ring-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-3 text-left">Mitglied</th>
              {categories.map((c) => (
                <th key={c.id} className="px-3 py-3 text-right">
                  <div className="flex flex-col items-end leading-tight">
                    <span>{c.label}</span>
                    <span className="text-[10px] font-normal text-neutral-500">
                      {formatEur(c.priceCents)}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right">Striche</th>
              <th className="px-4 py-3 text-right">Offen</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={categories.length + 3}
                  className="px-4 py-6 text-center text-neutral-500"
                >
                  Keine Mitglieder.
                </td>
              </tr>
            )}
            {rows.map(({ user, counts, totalCents, totalStriche }) => (
              <tr
                key={user.id}
                className={`border-t border-neutral-800 ${
                  user.active ? "" : "opacity-50"
                }`}
              >
                <td className="px-4 py-3 font-medium">
                  {user.name}
                  {user.deletedAt ? (
                    <span className="ml-2 text-xs text-red-400">gelöscht</span>
                  ) : !user.active ? (
                    <span className="ml-2 text-xs text-neutral-500">inaktiv</span>
                  ) : null}
                </td>
                {categories.map((c) => (
                  <td
                    key={c.id}
                    className="px-3 py-3 text-right tabular-nums text-neutral-300"
                  >
                    {counts[c.id] ?? 0}
                  </td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                  {totalStriche}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatEur(totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-neutral-900/60 font-semibold">
            <tr className="border-t border-neutral-800">
              <td className="px-4 py-3">Summe</td>
              {categories.map((c) => {
                const sumCnt = rows.reduce(
                  (s, r) => s + (r.counts[c.id] ?? 0),
                  0,
                );
                return (
                  <td
                    key={c.id}
                    className="px-3 py-3 text-right tabular-nums text-neutral-300"
                  >
                    {sumCnt}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                {grandTotalStriche}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatEur(grandTotalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="text-xs text-neutral-500">
        Beträge berechnen sich aus dem aktuellen Kategorie-Preis × Anzahl der
        Striche im gewählten Zeitraum. Rückgängig gemachte Striche zählen
        nicht. Geldbeträge sind ausschließlich im Admin-Panel sichtbar – im
        Mitglieder- und Tresenmodus erscheinen weiterhin nur Mengen.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

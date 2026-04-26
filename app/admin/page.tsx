import { prisma } from "@/lib/db";
import { StackedBarChart } from "@/components/StackedBarChart";

export default async function AdminOverview() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - 29);
  trendStart.setHours(0, 0, 0, 0);

  const [categories, todayCounts, monthCounts, users, totalTallies, trendRaw] =
    await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.tally.groupBy({
        by: ["categoryId"],
        where: { createdAt: { gte: startOfDay } },
        _count: { _all: true },
      }),
      prisma.tally.groupBy({
        by: ["categoryId"],
        where: { createdAt: { gte: startOfMonth } },
        _count: { _all: true },
      }),
      prisma.user.count({ where: { active: true } }),
      prisma.tally.count(),
      prisma.tally.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { categoryId: true, createdAt: true },
      }),
    ]);

  const todayMap = Object.fromEntries(todayCounts.map((c) => [c.categoryId, c._count._all]));
  const monthMap = Object.fromEntries(monthCounts.map((c) => [c.categoryId, c._count._all]));

  // Tagesweise Aggregation für die letzten 30 Tage
  const dayBuckets: { date: string; counts: Record<string, number> }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    dayBuckets.push({ date: d.toISOString().slice(0, 10), counts: {} });
  }
  for (const t of trendRaw) {
    const key = t.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.find((b) => b.date === key);
    if (!bucket) continue;
    bucket.counts[t.categoryId] = (bucket.counts[t.categoryId] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Übersicht</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Aktive Mitglieder" value={users} />
        <Stat
          label="Striche heute"
          value={Object.values(todayMap).reduce((a, b) => a + (b as number), 0)}
        />
        <Stat label="Striche gesamt" value={totalTallies} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Heute pro Kategorie</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {categories.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl p-4"
              style={{ backgroundColor: c.color, color: "#0b0d12" }}
            >
              <p className="text-xs font-semibold uppercase opacity-70">{c.label}</p>
              <p className="mt-2 text-3xl font-black">{todayMap[c.id] ?? 0}</p>
              <p className="mt-1 text-xs opacity-70">
                Monat: {monthMap[c.id] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">Letzte 30 Tage</h2>
        <StackedBarChart
          series={categories.map((c) => ({ id: c.id, label: c.label, color: c.color }))}
          days={dayBuckets}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

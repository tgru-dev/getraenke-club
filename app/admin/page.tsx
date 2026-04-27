import { prisma } from "@/lib/db";
import { StackedBarChart } from "@/components/StackedBarChart";
import { DonutChart } from "@/components/DonutChart";
import { HorizontalBarList } from "@/components/HorizontalBarList";
import { HourBars } from "@/components/HourBars";
import { RangePicker, rangeFromKey, type RangeKey } from "@/components/RangePicker";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export const dynamic = "force-dynamic";

type SearchParams = { range?: string };

function isRangeKey(v: string | undefined): v is RangeKey {
  return v === "today" || v === "week" || v === "month" || v === "year" || v === "all";
}

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rangeKey: RangeKey = isRangeKey(params.range) ? params.range : "month";
  const { from, to, label } = rangeFromKey(rangeKey);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const baseWhere = { createdAt: { gte: from, lte: to }, deletedAt: null };

  const [
    categories,
    todayCounts,
    rangePerCategory,
    rangePerUser,
    activeUsers,
    rangeCount,
    rangeTallies,
  ] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.tally.groupBy({
      by: ["categoryId"],
      where: { createdAt: { gte: startOfDay }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.tally.groupBy({
      by: ["categoryId"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.tally.groupBy({
      by: ["userId"],
      where: baseWhere,
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    }),
    prisma.user.count({ where: { active: true } }),
    prisma.tally.count({ where: baseWhere }),
    prisma.tally.findMany({
      where: baseWhere,
      select: { categoryId: true, createdAt: true },
    }),
  ]);

  const todayMap = Object.fromEntries(
    todayCounts.map((c) => [c.categoryId, c._count._all]),
  );
  const rangePerCatMap = Object.fromEntries(
    rangePerCategory.map((c) => [c.categoryId, c._count._all]),
  );

  const userIds = rangePerUser.map((u) => u.userId);
  const userNames = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userNameById = Object.fromEntries(userNames.map((u) => [u.id, u.name]));

  // Verteilung über Wochentage (Mo=0..So=6) und Stunden
  const weekdayCounts = Array(7).fill(0) as number[];
  const hourCounts = Array(24).fill(0) as number[];
  for (const t of rangeTallies) {
    const d = t.createdAt;
    // getDay: 0=So..6=Sa → wir wollen Mo=0..So=6
    const wd = (d.getDay() + 6) % 7;
    weekdayCounts[wd] += 1;
    hourCounts[d.getHours()] += 1;
  }

  // Tagesbuckets für den Trend (max 90 Tage angezeigt)
  const trendDays = Math.min(
    90,
    Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1),
  );
  const trendStart = new Date(to);
  trendStart.setDate(trendStart.getDate() - (trendDays - 1));
  trendStart.setHours(0, 0, 0, 0);
  const dayBuckets: { date: string; counts: Record<string, number> }[] = [];
  for (let i = 0; i < trendDays; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    dayBuckets.push({ date: d.toISOString().slice(0, 10), counts: {} });
  }
  for (const t of rangeTallies) {
    const key = t.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.find((b) => b.date === key);
    if (!bucket) continue;
    bucket.counts[t.categoryId] = (bucket.counts[t.categoryId] ?? 0) + 1;
  }

  const todayTotal = Object.values(todayMap).reduce(
    (a, b) => a + (b as number),
    0,
  );
  const topCategoryEntry = Object.entries(rangePerCatMap).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topCategory = topCategoryEntry
    ? categories.find((c) => c.id === topCategoryEntry[0])
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Übersicht</h1>
        <RangePicker active={rangeKey} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Striche heute" value={todayTotal} />
        <Stat label={`Striche · ${label}`} value={rangeCount} />
        <Stat label="Aktive Mitglieder" value={activeUsers} />
        <Stat
          label="Top-Kategorie"
          valueText={topCategory?.label ?? "—"}
          color={topCategory?.color}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={`Verteilung · ${label}`}>
          <DonutChart
            slices={categories.map((c) => ({
              id: c.id,
              label: c.label,
              color: c.color,
              value: rangePerCatMap[c.id] ?? 0,
            }))}
          />
        </Card>

        <Card title={`Top 10 Mitglieder · ${label}`}>
          <HorizontalBarList
            items={rangePerUser.map((u) => ({
              label: userNameById[u.userId] ?? "?",
              value: u._count._all,
            }))}
            emptyHint="Im Zeitraum noch keine Striche."
          />
        </Card>

        <Card title={`Wochentage · ${label}`}>
          <HorizontalBarList
            items={weekdayCounts.map((v, i) => ({
              label: WEEKDAYS[i],
              value: v,
              color: "#a855f7",
            }))}
          />
        </Card>

        <Card title={`Tageszeit · ${label}`}>
          <HourBars hours={hourCounts} />
        </Card>
      </div>

      <Card title={`Trend (${trendDays} Tage)`}>
        <StackedBarChart
          series={categories.map((c) => ({
            id: c.id,
            label: c.label,
            color: c.color,
          }))}
          days={dayBuckets}
        />
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Heute pro Kategorie</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {categories.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl p-4"
              style={{ backgroundColor: c.color, color: "#0b0d12" }}
            >
              <p className="text-xs font-semibold uppercase opacity-70">
                {c.label}
              </p>
              <p className="mt-2 text-3xl font-black">{todayMap[c.id] ?? 0}</p>
              <p className="mt-1 text-xs opacity-70">
                {label}: {rangePerCatMap[c.id] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  valueText,
  color,
}: {
  label: string;
  value?: number;
  valueText?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className="mt-2 truncate text-2xl font-bold"
        style={color ? { color } : undefined}
      >
        {value !== undefined ? value : (valueText ?? "—")}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
      <h2 className="mb-3 text-base font-semibold text-neutral-200">{title}</h2>
      {children}
    </section>
  );
}

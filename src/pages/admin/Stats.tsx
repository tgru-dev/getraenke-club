import { Fragment, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { RangeFilter, type Range } from "../../components/RangeFilter";
import { rangeFor } from "../../lib/format";
import type { Category, StatsResponse } from "../../../shared/types";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MEDALS = ["🥇", "🥈", "🥉"];

const tooltipStyle = {
  background: "var(--color-raised)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  color: "var(--color-ink)",
};

function formatDateShort(iso: string): string {
  return `${iso.slice(8)}.${iso.slice(5, 7)}.`;
}

export function Stats() {
  const [range, setRange] = useState<Range>(() => rangeFor("monat"));
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api<Category[]>("/admin/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api<StatsResponse>(`/admin/stats?from=${range.from}&to=${range.to}`)
      .then(setStats)
      .catch(() => {});
  }, [range]);

  const perDay = stats?.perDay ?? [];
  const total = stats?.total ?? 0;

  // KPIs
  const dayCount = Math.max(1, Math.round((range.to - range.from) / 86_400_000));
  const avgPerDay = total / dayCount;
  const peakDay = perDay.reduce<{ date: string; sum: number } | null>((best, d) => {
    const sum = Object.values(d.counts).reduce((a, b) => a + b, 0);
    return !best || sum > best.sum ? { date: d.date, sum } : best;
  }, null);
  const topDrinker = stats?.topDrinkers[0] ?? null;

  // Kategorie-Verteilung ueber den Zeitraum
  const catTotals = categories
    .map((c) => ({
      ...c,
      count: perDay.reduce((a, d) => a + (d.counts[c.id] ?? 0), 0),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const chartData = perDay.map((d) => ({
    date: formatDateShort(d.date),
    ...Object.fromEntries(categories.map((c) => [c.name, d.counts[c.id] ?? 0])),
  }));

  const heatMax = Math.max(1, ...(stats?.heatmap.flat() ?? [1]));
  const maxTop = Math.max(1, ...(stats?.topDrinkers.map((t) => t.count) ?? [1]));

  const kpis = [
    { label: "Striche gesamt", value: String(total) },
    { label: "Ø pro Tag", value: avgPerDay >= 10 ? avgPerDay.toFixed(0) : avgPerDay.toFixed(1) },
    {
      label: "Stärkster Tag",
      value: peakDay ? `${peakDay.sum}` : "–",
      hint: peakDay ? formatDateShort(peakDay.date) : undefined,
    },
    {
      label: "Durstigste:r",
      value: topDrinker ? topDrinker.memberName : "–",
      hint: topDrinker ? `${topDrinker.count} Striche` : undefined,
      small: true,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Statistiken</h1>
        <RangeFilter value={range} onChange={setRange} />
      </header>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{k.label}</p>
            <p className={`mt-1 truncate font-display font-extrabold text-amber ${k.small ? "text-xl" : "text-3xl"}`}>
              {k.value}
            </p>
            {k.hint && <p className="text-sm text-muted">{k.hint}</p>}
          </div>
        ))}
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center text-muted">
          Keine Striche im gewählten Zeitraum. 🌵
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          {/* Konsum pro Tag, gestapelt nach Kategorie */}
          <section className="rounded-2xl border border-line bg-surface p-5 xl:col-span-2">
            <h2 className="mb-4 font-display font-bold">Konsum pro Tag</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--color-muted)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  {/* Eintraege erben die Balkenfarbe (= Kategoriefarbe) */}
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(245,165,36,0.08)" }} />
                  {categories.map((c) => (
                    <Bar key={c.id} dataKey={c.name} stackId="a" fill={c.color} radius={[3, 3, 0, 0]} maxBarSize={42} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Kategorie-Verteilung */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display font-bold">Nach Kategorie</h2>
            <div className="relative mx-auto h-44 w-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    // fill im Datenobjekt -> Tooltip-Text erscheint in der Kategoriefarbe
                    data={catTotals.map((c) => ({ ...c, fill: c.color }))}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {catTotals.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-extrabold">{total}</span>
                <span className="text-xs text-muted">Striche</span>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {catTotals.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono">{c.count}</span>
                  <span className="w-11 text-right font-mono text-muted">
                    {((c.count / total) * 100).toFixed(0)} %
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Top-Trinker */}
          <section className="rounded-2xl border border-line bg-surface p-5 xl:col-span-2">
            <h2 className="mb-4 font-display font-bold">Top im Zeitraum</h2>
            <div className="flex flex-col gap-2.5">
              {stats?.topDrinkers.map((t, i) => (
                <div key={t.memberId} className="flex items-center gap-3">
                  <span className="w-7 text-center font-mono text-sm text-muted">
                    {MEDALS[i] ?? `${i + 1}.`}
                  </span>
                  <span className="w-32 truncate text-sm">{t.memberName}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-amber transition-[width] duration-500"
                      style={{ width: `${(t.count / maxTop) * 100}%`, opacity: 1 - i * 0.05 }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-sm">{t.count}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Heatmap Wochentag x Stunde */}
          <section className="rounded-2xl border border-line bg-surface p-5 xl:col-span-3">
            <h2 className="mb-1 font-display font-bold">Wann wird getrunken?</h2>
            <p className="mb-4 text-sm text-muted">Wochentag × Uhrzeit – je heller, desto mehr Striche</p>
            <div className="overflow-x-auto">
              <div className="grid w-max grid-cols-[2.5rem_repeat(24,1.4rem)_3rem] gap-1">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center font-mono text-[10px] text-muted">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
                <div className="text-right font-mono text-[10px] leading-4 text-muted">Σ</div>
                {WEEKDAYS.map((wd, day) => {
                  const rowSum = stats?.heatmap[day]?.reduce((a, b) => a + b, 0) ?? 0;
                  return (
                    <Fragment key={day}>
                      <div className="pr-1 text-right font-mono text-xs leading-[1.4rem] text-muted">
                        {wd}
                      </div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const v = stats?.heatmap[day]?.[h] ?? 0;
                        return (
                          <div
                            key={h}
                            title={`${wd} ${h}:00 – ${v} Strich${v === 1 ? "" : "e"}`}
                            className="h-[1.4rem] rounded-[5px] border border-line/40"
                            style={{
                              background: v > 0
                                ? `rgba(245,165,36,${0.15 + 0.85 * (v / heatMax)})`
                                : "var(--color-raised)",
                            }}
                          />
                        );
                      })}
                      <div className="text-right font-mono text-xs leading-[1.4rem] text-muted">{rowSum || ""}</div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type Series = { id: string; label: string; color: string };
type Day = { date: string; counts: Record<string, number> };

export function StackedBarChart({
  series,
  days,
  height = 180,
}: {
  series: Series[];
  days: Day[];
  height?: number;
}) {
  const max = Math.max(
    1,
    ...days.map((d) => series.reduce((sum, s) => sum + (d.counts[s.id] ?? 0), 0)),
  );
  const barGap = 2;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid items-end"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          height,
          gap: barGap,
        }}
      >
        {days.map((d) => {
          const total = series.reduce((sum, s) => sum + (d.counts[s.id] ?? 0), 0);
          return (
            <div
              key={d.date}
              className="group flex h-full flex-col-reverse overflow-hidden rounded-md bg-neutral-800/40"
              title={`${formatDate(d.date)}: ${total}`}
            >
              {series.map((s) => {
                const v = d.counts[s.id] ?? 0;
                if (v === 0) return null;
                const pct = (v / max) * 100;
                return (
                  <div
                    key={s.id}
                    style={{ height: `${pct}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${v}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-neutral-300">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-neutral-500">
          max/Tag: {max} · {days.length} Tage
        </span>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

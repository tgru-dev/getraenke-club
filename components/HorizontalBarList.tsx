export function HorizontalBarList({
  items,
  emptyHint = "Keine Daten",
}: {
  items: { label: string; value: number; color?: string }[];
  emptyHint?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyHint}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, idx) => (
        <div key={`${it.label}-${idx}`} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-neutral-200">
            {it.label}
          </span>
          <div className="relative h-6 flex-1 overflow-hidden rounded bg-neutral-800">
            <div
              className="h-full rounded transition-[width]"
              style={{
                width: `${(it.value / max) * 100}%`,
                backgroundColor: it.color ?? "#0ea5e9",
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-neutral-300">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

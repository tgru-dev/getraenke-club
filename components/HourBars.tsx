export function HourBars({
  hours,
  height = 140,
  color = "#0ea5e9",
}: {
  hours: number[]; // exakt 24 Werte (0..23 Uhr)
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...hours);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid items-end gap-px"
        style={{
          gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
          height,
        }}
      >
        {hours.map((v, i) => {
          const pct = (v / max) * 100;
          return (
            <div
              key={i}
              className="relative h-full rounded-t bg-neutral-800/40"
              title={`${i.toString().padStart(2, "0")}:00–${(i + 1)
                .toString()
                .padStart(2, "0")}:00 · ${v} Striche`}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t"
                style={{
                  height: `${pct}%`,
                  backgroundColor: color,
                  opacity: v === 0 ? 0 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="grid text-[10px] text-neutral-500"
        style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="text-center">
            {i % 3 === 0 ? i : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

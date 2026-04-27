type Slice = { id: string; label: string; color: string; value: number };

export function DonutChart({
  slices,
  size = 180,
  thickness = 26,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-label="Verteilung nach Kategorie"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1f2937"
            strokeWidth={thickness}
          />
          {total > 0 &&
            slices.map((s) => {
              const length = (s.value / total) * circumference;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={s.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${length} ${circumference}`}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tabular-nums">{total}</span>
          <span className="text-xs text-neutral-400">Striche</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 text-sm">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 truncate text-neutral-200">{s.label}</span>
              <span className="tabular-nums text-neutral-400">
                {s.value}
                <span className="ml-1 text-xs text-neutral-500">
                  {pct.toFixed(0)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

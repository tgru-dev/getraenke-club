// Zaehler als echte Strichlisten-Striche: Gruppen aus 4 senkrechten Strichen
// mit diagonalem Querstrich als fuenftem. Das visuelle Herzstueck der App.

export function Tally({ count, color = "var(--color-amber)" }: { count: number; color?: string }) {
  if (count <= 0) return <span className="text-muted text-sm">–</span>;

  const groups: number[] = [];
  let rest = count;
  while (rest > 0) {
    groups.push(Math.min(rest, 5));
    rest -= 5;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={`${count}`}>
      {groups.map((n, gi) => (
        <svg key={gi} width={n === 5 ? 26 : n * 6 + 4} height="22" viewBox={`0 0 ${n === 5 ? 26 : n * 6 + 4} 22`}>
          {Array.from({ length: Math.min(n, 4) }, (_, i) => (
            <line
              key={i}
              className={gi === groups.length - 1 ? "tally-stroke" : undefined}
              x1={4 + i * 6}
              y1="3"
              x2={4 + i * 6}
              y2="19"
              stroke={color}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          ))}
          {n === 5 && (
            <line
              className="tally-stroke"
              x1="0"
              y1="17"
              x2="26"
              y2="5"
              stroke={color}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}
        </svg>
      ))}
    </span>
  );
}

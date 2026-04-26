const PALETTE = [
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#0ea5e9",
  "#10b981",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#eab308",
];

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  size = 64,
  highlighted = false,
}: {
  name: string;
  size?: number;
  highlighted?: boolean;
}) {
  const color = PALETTE[hashCode(name) % PALETTE.length];
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full font-bold leading-none text-neutral-900 transition ${
        highlighted ? "shadow-lg" : ""
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initials(name)}
    </span>
  );
}

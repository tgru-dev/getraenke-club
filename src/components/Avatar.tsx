import { initials } from "../lib/format";

export function Avatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl font-display font-bold shrink-0"
      style={{
        width: size,
        height: size,
        background: `${color}26`,
        color,
        border: `1.5px solid ${color}59`,
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </div>
  );
}

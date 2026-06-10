export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export function formatDateTime(ms: number): string {
  return `${new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}, ${formatTime(ms)}`;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type RangePreset = "heute" | "woche" | "monat";

/** Zeitraum-Grenzen in lokaler Zeit (Geraete stehen im Club / in DE). */
export function rangeFor(preset: RangePreset): { from: number; to: number } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "heute") return { from: startOfDay.getTime(), to: Date.now() + 60_000 };
  if (preset === "woche") {
    const day = (startOfDay.getDay() + 6) % 7; // Mo = 0
    return { from: startOfDay.getTime() - day * 86_400_000, to: Date.now() + 60_000 };
  }
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    to: Date.now() + 60_000,
  };
}

export const AVATAR_COLORS = [
  "#f5a524", "#34d399", "#38bdf8", "#f87171", "#c084fc", "#fb923c", "#a3e635", "#22d3ee",
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

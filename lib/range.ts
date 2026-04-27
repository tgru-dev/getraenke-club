export type RangeKey = "today" | "week" | "month" | "year" | "all";

export function isRangeKey(v: string | null | undefined): v is RangeKey {
  return v === "today" || v === "week" || v === "month" || v === "year" || v === "all";
}

export function rangeFromKey(key: RangeKey): {
  from: Date;
  to: Date;
  label: string;
} {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);

  switch (key) {
    case "today":
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "heute" };
    case "week":
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "letzte 7 Tage" };
    case "year":
      from.setDate(from.getDate() - 364);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "letzte 365 Tage" };
    case "all":
      return { from: new Date(0), to, label: "alle Zeiten" };
    case "month":
    default:
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: "letzte 30 Tage" };
  }
}

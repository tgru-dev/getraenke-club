import Link from "next/link";

export type RangeKey = "today" | "week" | "month" | "year" | "all";

const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "week", label: "7 Tage" },
  { key: "month", label: "30 Tage" },
  { key: "year", label: "Jahr" },
  { key: "all", label: "Alles" },
];

export function RangePicker({
  active,
  basePath = "/admin",
}: {
  active: RangeKey;
  basePath?: string;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-neutral-900 p-1 ring-1 ring-neutral-800">
      {OPTIONS.map((o) => {
        const isActive = o.key === active;
        return (
          <Link
            key={o.key}
            href={`${basePath}?range=${o.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              isActive
                ? "bg-white text-neutral-900"
                : "text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function rangeFromKey(key: RangeKey): { from: Date; to: Date; label: string } {
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

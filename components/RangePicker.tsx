import Link from "next/link";
import type { RangeKey } from "@/lib/range";

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

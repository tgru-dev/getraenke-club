import { useState } from "react";
import { rangeFor, type RangePreset } from "../lib/format";

export interface Range {
  from: number;
  to: number;
}

const presets: { key: RangePreset; label: string }[] = [
  { key: "heute", label: "Heute" },
  { key: "woche", label: "Woche" },
  { key: "monat", label: "Monat" },
];

export function RangeFilter({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [preset, setPreset] = useState<RangePreset | "custom">("monat");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const applyCustom = (fromStr: string, toStr: string) => {
    setPreset("custom");
    setCustomFrom(fromStr);
    setCustomTo(toStr);
    if (!fromStr || !toStr) return;
    const from = new Date(fromStr + "T00:00:00").getTime();
    const to = new Date(toStr + "T00:00:00").getTime() + 86_400_000; // Ende exklusiv
    if (from < to) onChange({ from, to });
  };

  void value;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.key}
          onClick={() => { setPreset(p.key); onChange(rangeFor(p.key)); }}
          className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
            preset === p.key
              ? "border-amber/60 bg-amber/15 text-amber"
              : "border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          {p.label}
        </button>
      ))}
      <span className="mx-1 text-muted">·</span>
      <input
        type="date"
        value={customFrom}
        onChange={(e) => applyCustom(e.target.value, customTo)}
        className={`rounded-xl border bg-surface px-3 py-1.5 text-sm ${preset === "custom" ? "border-amber/60" : "border-line"}`}
      />
      <span className="text-muted">bis</span>
      <input
        type="date"
        value={customTo}
        onChange={(e) => applyCustom(customFrom, e.target.value)}
        className={`rounded-xl border bg-surface px-3 py-1.5 text-sm ${preset === "custom" ? "border-amber/60" : "border-line"}`}
      />
    </div>
  );
}

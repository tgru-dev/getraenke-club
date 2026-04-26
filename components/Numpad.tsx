"use client";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function Numpad({
  onKey,
  disabled,
}: {
  onKey: (k: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {KEYS.map((k, i) => {
        if (k === "") return <span key={i} />;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onKey(k)}
            className="h-16 rounded-2xl bg-neutral-800 text-2xl font-semibold text-white transition active:scale-95 active:bg-neutral-700 disabled:opacity-40"
          >
            {k === "del" ? "⌫" : k}
          </button>
        );
      })}
    </div>
  );
}

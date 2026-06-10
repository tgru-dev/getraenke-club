import { useState } from "react";

export function PinPad({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [pin, setPin] = useState("");

  const press = (digit: string) => {
    if (busy) return;
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      onSubmit(next);
      setPin("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-colors ${
              i < pin.length ? "bg-amber border-amber" : "border-line"
            }`}
          />
        ))}
      </div>
      <p className={`h-5 text-sm ${error ? "text-danger" : "text-muted"}`}>
        {error ?? (busy ? "Prüfe …" : "PIN eingeben")}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) =>
          key === "" ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (key === "⌫" ? setPin(pin.slice(0, -1)) : press(key))}
              className="h-16 w-16 rounded-2xl bg-raised border border-line text-2xl font-display font-semibold
                         active:scale-95 active:bg-line transition-transform select-none"
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Numpad } from "./Numpad";

type Step = "current" | "new" | "confirm";

export function PinChangeDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const active =
    step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const setActive =
    step === "current" ? setCurrentPin : step === "new" ? setNewPin : setConfirmPin;

  const title =
    step === "current"
      ? "Aktuelle PIN"
      : step === "new"
        ? "Neue PIN wählen"
        : "Neue PIN bestätigen";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === "wrong_pin") setError("Aktuelle PIN ist falsch.");
        else if (data?.error === "same_pin") setError("Neue PIN muss anders sein.");
        else setError("Änderung fehlgeschlagen.");
        setStep("current");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  function handleKey(k: string) {
    if (busy || done) return;
    if (k === "del") {
      setActive(active.slice(0, -1));
      return;
    }
    if (active.length >= 4) return;
    const next = active + k;
    setActive(next);
    if (next.length === 4) {
      // Auto-Schritt nach 4 Ziffern
      setTimeout(() => {
        if (step === "current") {
          setStep("new");
        } else if (step === "new") {
          setStep("confirm");
        } else {
          if (next !== newPin) {
            setError("Bestätigung stimmt nicht überein.");
            setStep("new");
            setNewPin("");
            setConfirmPin("");
          } else {
            submit();
          }
        }
      }, 80);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-neutral-900 p-6 shadow-2xl ring-1 ring-neutral-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">PIN ändern</h2>
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-2 py-1 text-sm text-neutral-300"
          >
            Schließen
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-2xl">✅</div>
            <p className="text-center text-sm text-neutral-300">
              PIN erfolgreich geändert.
            </p>
            <button
              onClick={onClose}
              className="rounded-xl bg-white px-4 py-2 font-semibold text-neutral-900"
            >
              Fertig
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-neutral-400">{title}</p>
            <div className="mb-4 flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${
                    active.length > i ? "bg-white" : "bg-neutral-700"
                  }`}
                />
              ))}
            </div>
            <Numpad onKey={handleKey} disabled={busy} />
            {error && (
              <p className="mt-3 text-center text-sm text-red-400">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

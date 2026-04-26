"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Numpad } from "@/components/Numpad";
import { UserAvatar } from "@/components/UserAvatar";

const LAST_USER_KEY = "drinks:lastUser";

export function LoginForm({ names }: { names: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem(LAST_USER_KEY);
    if (last && names.includes(last)) {
      setSelected(last);
    }
  }, [names]);

  async function submit(currentSelected: string, p: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentSelected, pin: p }),
      });
      if (!res.ok) {
        setError("Falsche PIN.");
        setPin("");
        return;
      }
      const data = await res.json();
      try {
        window.localStorage.setItem(LAST_USER_KEY, currentSelected);
      } catch {
        // ignore (Privacy-Mode etc.)
      }
      router.replace(data.role === "admin" ? "/admin" : "/m");
    } catch {
      setError("Verbindung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  function pickUser(name: string) {
    setSelected(name);
    setPin("");
    setError(null);
  }

  function handleKey(k: string) {
    if (!selected) {
      setError("Bitte erst Mitglied wählen.");
      return;
    }
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      submit(selected, next);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="mb-3 text-sm text-neutral-400">Mitglied wählen</p>
        {names.length === 0 ? (
          <p className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-400">
            Noch keine Mitglieder angelegt. Bitte zuerst über das Admin-Panel
            Konten erstellen.
          </p>
        ) : (
          <div className="grid max-h-[40vh] grid-cols-3 gap-3 overflow-y-auto pb-1 sm:grid-cols-4">
            {names.map((n) => {
              const isSelected = n === selected;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickUser(n)}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-2 transition active:scale-95 ${
                    isSelected ? "bg-white/10 ring-2 ring-white" : "bg-transparent"
                  }`}
                >
                  <UserAvatar name={n} size={64} highlighted={isSelected} />
                  <span className="line-clamp-1 text-xs font-medium text-neutral-200">
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-neutral-300">
            PIN für <span className="font-semibold text-white">{selected}</span>
          </span>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full ${
                  pin.length > i ? "bg-white" : "bg-neutral-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <Numpad onKey={handleKey} disabled={loading || !selected} />

      {error && (
        <p className="text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

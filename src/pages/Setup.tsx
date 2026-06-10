import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PublicMember } from "../../shared/types";

export function Setup() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; member: PublicMember }>("/setup", {
        method: "POST",
        body: { name, pin },
      });
      setSession(res.token, res.member);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Keine Verbindung");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="font-display text-3xl font-extrabold">Erste Einrichtung</h1>
      <p className="mt-2 text-muted">
        Lege das erste Vorstandskonto an. Damit kannst du danach Mitglieder und Kategorien verwalten.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dein Name"
          required
          className="rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-amber/60"
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4-stellige PIN"
          inputMode="numeric"
          required
          minLength={4}
          className="rounded-xl border border-line bg-surface px-4 py-3 font-mono tracking-[0.5em] outline-none
                     placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-amber/60"
        />
        {error && <p className="text-danger">{error}</p>}
        <button
          disabled={busy || pin.length !== 4 || !name.trim()}
          className="rounded-xl bg-amber px-4 py-3 font-display font-bold text-bg disabled:opacity-40"
        >
          {busy ? "Lege an …" : "Konto anlegen"}
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/Avatar";

export function Profile() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!member) return null;

  const changePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api("/auth/pin", { method: "POST", body: { currentPin, newPin } });
      setMessage({ ok: true, text: "PIN geändert ✓" });
      setCurrentPin("");
      setNewPin("");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Keine Verbindung" });
    } finally {
      setBusy(false);
    }
  };

  const pinInput = (value: string, set: (v: string) => void, placeholder: string) => (
    <input
      value={value}
      onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
      placeholder={placeholder}
      inputMode="numeric"
      type="password"
      className="rounded-xl border border-line bg-surface px-4 py-3 font-mono tracking-[0.5em] outline-none
                 placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-amber/60"
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4 animate-rise">
        <Avatar name={member.name} color={member.color} size={64} />
        <div>
          <h1 className="font-display text-2xl font-extrabold">{member.name}</h1>
          <p className="text-sm text-muted">{member.role === "vorstand" ? "Vorstand" : "Mitglied"}</p>
        </div>
      </header>

      <Link
        to="/wrapped"
        className="animate-rise flex items-center justify-between rounded-3xl border border-amber/40 bg-amber/10 p-5"
      >
        <div>
          <p className="font-display text-lg font-bold text-amber">🎉 Dein Jahresrückblick</p>
          <p className="text-sm text-muted">Deine Striche, dein Getränk des Jahres, deine größten Abende</p>
        </div>
        <span className="text-2xl text-amber">→</span>
      </Link>

      <section className="rounded-3xl border border-line bg-surface p-5 animate-rise">
        <h2 className="font-display font-bold">PIN ändern</h2>
        <form onSubmit={changePin} className="mt-4 flex flex-col gap-3">
          {pinInput(currentPin, setCurrentPin, "Aktuelle PIN")}
          {pinInput(newPin, setNewPin, "Neue PIN (4 Ziffern)")}
          {message && (
            <p className={message.ok ? "text-ok" : "text-danger"}>{message.text}</p>
          )}
          <button
            disabled={busy || currentPin.length !== 4 || newPin.length !== 4}
            className="rounded-xl bg-amber py-3 font-display font-bold text-bg disabled:opacity-40"
          >
            Speichern
          </button>
        </form>
      </section>

      <button
        onClick={() => { logout(); navigate("/login"); }}
        className="rounded-xl border border-danger/40 py-3 font-medium text-danger"
      >
        Abmelden
      </button>
    </div>
  );
}

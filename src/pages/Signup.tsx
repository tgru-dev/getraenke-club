import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AVATAR_COLORS, initials } from "../lib/format";
import type { ClubSettings, PublicMember } from "../../shared/types";

export function Signup() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [code, setCode] = useState("");
  const [codeRequired, setCodeRequired] = useState(false);

  useEffect(() => {
    api<ClubSettings>("/settings")
      .then((s) => setCodeRequired(s.signupCodeRequired))
      .catch(() => {});
  }, []);
  const [color, setColor] = useState(
    () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pinInput = (value: string, set: (v: string) => void, placeholder: string) => (
    <input
      value={value}
      onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
      placeholder={placeholder}
      inputMode="numeric"
      type="password"
      required
      className="rounded-xl border border-line bg-surface px-4 py-3 font-mono tracking-[0.5em] outline-none
                 placeholder:font-sans placeholder:tracking-normal placeholder:text-muted focus:border-amber/60"
    />
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== pin2) {
      setError("Die PINs stimmen nicht überein");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; member: PublicMember }>("/signup", {
        method: "POST",
        body: { name, pin, color, code },
      });
      setSession(res.token, res.member);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Keine Verbindung");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="font-display text-3xl font-extrabold animate-rise">Willkommen im Club! 🍻</h1>
      <p className="mt-2 text-muted">
        Leg dir hier dein Mitgliedskonto an. Mit Name und PIN kannst du danach deine
        Getränke anstreichen.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dein Name"
          required
          maxLength={40}
          className="rounded-xl border border-line bg-surface px-4 py-3 outline-none placeholder:text-muted focus:border-amber/60"
        />
        {pinInput(pin, setPin, "PIN wählen (4 Ziffern)")}
        {pinInput(pin2, setPin2, "PIN wiederholen")}
        {codeRequired && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Club-Code (gibt's beim Vorstand)"
            required
            className="rounded-xl border border-line bg-surface px-4 py-3 outline-none placeholder:text-muted focus:border-amber/60"
          />
        )}

        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display font-bold"
            style={{ background: `${color}26`, color, border: `1.5px solid ${color}59`, fontSize: 18 }}
          >
            {name.trim() ? initials(name) : "?"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
                style={{ background: c }}
                aria-label={`Farbe ${c}`}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-danger">{error}</p>}
        <button
          disabled={busy || pin.length !== 4 || pin2.length !== 4 || !name.trim()}
          className="rounded-xl bg-amber px-4 py-3 font-display font-bold text-bg disabled:opacity-40"
        >
          {busy ? "Lege an …" : "Registrieren"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Schon dabei?{" "}
        <Link to="/login" className="text-amber underline">
          Zum Login
        </Link>
      </p>
    </div>
  );
}

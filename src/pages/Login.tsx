import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/Avatar";
import { PinPad } from "../components/PinPad";
import type { ClubSettings, PublicMember } from "../../shared/types";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [members, setMembers] = useState<PublicMember[] | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [selected, setSelected] = useState<PublicMember | null>(null);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api<PublicMember[]>("/members/public")
      .then((list) => {
        setMembers(list);
        if (list.length === 0) {
          // Erstinbetriebnahme: noch keine Mitglieder vorhanden
          api<{ needsSetup: boolean }>("/setup/status")
            .then((s) => s.needsSetup && navigate("/setup"))
            .catch(() => {});
        }
      })
      .catch(() => setError("Server nicht erreichbar"));
    api<ClubSettings>("/settings").then(setSettings).catch(() => {});
  }, [navigate]);

  const submitPin = async (pin: string) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await login(selected.id, pin, remember);
      navigate("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Keine Verbindung");
    } finally {
      setBusy(false);
    }
  };

  const filtered = members?.filter((m) =>
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <header className="mb-8 text-center animate-rise">
        {settings?.logo ? (
          <img src={settings.logo} alt="" className="mx-auto mb-3 h-16 object-contain" />
        ) : (
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        )}
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {settings?.clubName ?? "Jugendclub"}
        </h1>
        <p className="mt-1 text-muted">Getränke-Strichliste</p>
      </header>

      {selected ? (
        <div className="flex flex-col items-center gap-6 animate-pop">
          <div className="flex items-center gap-3">
            <Avatar name={selected.name} color={selected.color} />
            <div>
              <p className="font-display text-lg font-bold">{selected.name}</p>
              <button className="text-sm text-muted underline" onClick={() => { setSelected(null); setError(null); }}>
                anderes Mitglied
              </button>
            </div>
          </div>
          <PinPad onSubmit={submitPin} busy={busy} error={error} />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-(--color-amber)"
            />
            Angemeldet bleiben
          </label>
        </div>
      ) : (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Name suchen …"
            className="mb-4 w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none placeholder:text-muted focus:border-amber/60"
          />
          {error && <p className="mb-3 text-center text-danger">{error}</p>}
          {!members && !error && <p className="text-center text-muted">Lade Mitglieder …</p>}
          <div className="grid grid-cols-2 gap-3">
            {filtered?.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                className="animate-rise flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left
                           transition-colors active:bg-raised"
              >
                <Avatar name={m.name} color={m.color} size={40} />
                <span className="truncate font-medium">{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {!selected && (
        <p className="mt-8 text-center text-sm text-muted">
          Neu im Club?{" "}
          <a href="/signup" className="text-amber underline">
            Hier registrieren
          </a>
        </p>
      )}
      <a href="/tresen" className="mt-auto pt-10 text-center text-xs text-muted/60">
        Tresenmodus öffnen
      </a>
    </div>
  );
}

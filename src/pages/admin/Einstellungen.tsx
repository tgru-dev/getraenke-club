import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import type { ClubSettings } from "../../../shared/types";

const MAX_LOGO_BYTES = 300 * 1024;

export function Einstellungen() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [clubName, setClubName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<ClubSettings>("/settings").then((s) => {
      setSettings(s);
      setClubName(s.clubName);
    }).catch(() => {});
  }, []);

  const save = async (body: { clubName?: string; logo?: string | null }) => {
    setMessage(null);
    try {
      await api("/admin/settings", { method: "PUT", body });
      const s = await api<ClubSettings>("/settings");
      setSettings(s);
      setMessage({ ok: true, text: "Gespeichert ✓" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : "Speichern fehlgeschlagen" });
    }
  };

  const uploadLogo = (file: File) => {
    if (file.size > MAX_LOGO_BYTES) {
      setMessage({ ok: false, text: "Logo zu groß – bitte max. 300 KB (PNG/SVG/JPG)" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => void save({ logo: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-2xl font-extrabold">Einstellungen</h1>
      {message && <p className={message.ok ? "text-ok" : "text-danger"}>{message.text}</p>}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold">Clubname</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-raised px-4 py-2.5"
          />
          <button
            onClick={() => void save({ clubName })}
            disabled={!clubName.trim()}
            className="rounded-xl bg-amber px-5 py-2.5 font-bold text-bg disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display font-bold">Club-Logo</h2>
        <p className="mt-1 text-sm text-muted">Wird im Login und am Tresen angezeigt. Max. 300 KB.</p>
        <div className="mt-4 flex items-center gap-4">
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" className="h-16 rounded-xl border border-line bg-raised object-contain p-2" />
          ) : (
            <span className="text-muted">Kein Logo hochgeladen</span>
          )}
          <label className="cursor-pointer rounded-xl border border-amber/50 bg-amber/10 px-4 py-2 font-bold text-amber">
            Hochladen
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
          </label>
          {settings?.logo && (
            <button onClick={() => void save({ logo: null })} className="text-danger hover:underline">
              entfernen
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function BrandingClient({
  hasCustomLogo,
  mime,
  updatedAt,
}: {
  hasCustomLogo: boolean;
  mime: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Cache-Bust für die Vorschau, damit nach Upload sofort das neue Bild lädt
  const [version, setVersion] = useState(updatedAt ?? "default");

  async function upload(file: File) {
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError("Nur PNG, JPEG, WEBP oder SVG erlaubt.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Datei darf max. 1 MB groß sein.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/branding", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const map: Record<string, string> = {
          too_large: "Datei zu groß.",
          unsupported_mime: "Format nicht unterstützt.",
          no_file: "Keine Datei gewählt.",
        };
        setError(map[data?.error] ?? "Upload fehlgeschlagen.");
        return;
      }
      setVersion(Date.now().toString());
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("Eigenes Logo entfernen und auf Standard zurücksetzen?"))
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/branding", { method: "DELETE" });
      if (!res.ok) {
        setError("Zurücksetzen fehlgeschlagen.");
        return;
      }
      setVersion(Date.now().toString());
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Logo</h1>

      <section className="flex flex-col gap-4 rounded-2xl bg-neutral-900 p-5 ring-1 ring-neutral-800">
        <p className="text-sm text-neutral-400">
          Lege hier ein eigenes Logo für euren Club hoch. Es erscheint im
          Login, im Mitglieder- und Tresenmodus sowie im Admin-Header.
          Maximal 1 MB, PNG / JPEG / WEBP / SVG.
        </p>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-neutral-500">Vorschau</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/branding/logo?v=${encodeURIComponent(version)}`}
              alt="Logo-Vorschau"
              className="h-32 w-32 rounded-2xl bg-neutral-800 object-contain p-2"
            />
            <span className="text-xs text-neutral-500">
              {hasCustomLogo ? `eigenes Logo (${mime})` : "Standard-Logo"}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
              disabled={busy}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-neutral-900 hover:file:bg-neutral-200"
            />
            {hasCustomLogo && (
              <button
                onClick={reset}
                disabled={busy || pending}
                className="self-start rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30"
              >
                Eigenes Logo entfernen
              </button>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {busy && <p className="text-sm text-neutral-500">Lade hoch …</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

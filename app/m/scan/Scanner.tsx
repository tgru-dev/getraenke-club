"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Category = { id: string; label: string; color: string };

type LookupResult = {
  ean: string;
  product:
    | null
    | {
        id: string;
        name: string;
        categoryId: string;
        categoryLabel: string;
        categoryColor: string;
      };
  lookup: null | { name?: string; vendor?: string; error?: string };
};

type Phase =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "loading"; ean: string }
  | { kind: "review"; data: LookupResult }
  | { kind: "saving" }
  | { kind: "done"; user: string; categoryColor: string; categoryLabel: string }
  | { kind: "error"; message: string };

export function Scanner({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const handleEan = useCallback(async (ean: string) => {
    setPhase({ kind: "loading", ean });
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(ean)}`);
      if (!res.ok) {
        setPhase({ kind: "error", message: "Lookup fehlgeschlagen." });
        return;
      }
      const data: LookupResult = await res.json();
      setName(data.product?.name ?? data.lookup?.name ?? "");
      setCategoryId(data.product?.categoryId ?? categories[0]?.id ?? "");
      setPhase({ kind: "review", data });
    } catch {
      setPhase({ kind: "error", message: "Verbindungsfehler." });
    }
  }, [categories]);

  const startScanner = useCallback(async () => {
    setPhase({ kind: "scanning" });
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const video = videoRef.current;
      if (!video) return;
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          if (!result) return;
          const text = result.getText();
          if (!/^\d{8}$|^\d{12,14}$/.test(text)) return;
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(50);
          }
          controls.stop();
          controlsRef.current = null;
          handleEan(text);
        },
      );
      controlsRef.current = controls;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Kamera-Zugriff verweigert."
            : err.name === "NotFoundError"
              ? "Keine Kamera gefunden."
              : err.message
          : "Kamera-Fehler.";
      setPhase({ kind: "error", message });
    }
  }, [handleEan]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  async function bookAndMaybeSave() {
    if (phase.kind !== "review") return;
    if (!categoryId) return;
    setPhase({ kind: "saving" });
    try {
      let productId = phase.data.product?.id;

      // Wenn neu: Mapping speichern
      if (!productId) {
        if (!name.trim()) {
          setPhase({ ...phase, kind: "review" });
          return;
        }
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ean: phase.data.ean,
            name: name.trim(),
            categoryId,
            source: phase.data.lookup?.name ? "opengtin" : "manual",
          }),
        });
        if (!res.ok) {
          setPhase({ kind: "error", message: "Konnte Produkt nicht speichern." });
          return;
        }
        const created = await res.json();
        productId = created.id;
      }

      // Strich buchen
      const tallyRes = await fetch("/api/tallies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          source: "scan",
          productId,
        }),
      });
      if (!tallyRes.ok) {
        if (tallyRes.status === 401) {
          router.replace("/login");
          return;
        }
        setPhase({ kind: "error", message: "Strich konnte nicht gebucht werden." });
        return;
      }

      const cat =
        categories.find((c) => c.id === categoryId) ?? {
          color: "#10b981",
          label: "Strich",
        };
      setPhase({
        kind: "done",
        user: phase.data.product?.name ?? name,
        categoryColor: cat.color,
        categoryLabel: cat.label,
      });
    } catch {
      setPhase({ kind: "error", message: "Verbindungsfehler." });
    }
  }

  function reset() {
    stopScanner();
    setPhase({ kind: "idle" });
    setName("");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-4">
      <header className="mb-4 flex items-center justify-between">
        <Link
          href="/m"
          className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
        >
          ← Zurück
        </Link>
        <h1 className="text-lg font-semibold">Barcode scannen</h1>
        <span className="w-12" />
      </header>

      {phase.kind === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="text-6xl">📷</div>
          <p className="text-sm text-neutral-400">
            Halte den Strichcode der Flasche/Dose vor die Kamera.
          </p>
          <button
            onClick={startScanner}
            className="rounded-2xl bg-white px-6 py-3 text-base font-semibold text-neutral-900"
          >
            Kamera starten
          </button>
        </div>
      )}

      {phase.kind === "scanning" && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className="aspect-[3/4] w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-3/4 rounded-2xl border-2 border-white/70" />
            </div>
          </div>
          <p className="text-sm text-neutral-400">Scanne …</p>
          <button
            onClick={reset}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-200"
          >
            Abbrechen
          </button>
        </div>
      )}

      {phase.kind === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-neutral-400">Suche {phase.ean} …</p>
        </div>
      )}

      {phase.kind === "review" && (
        <ReviewView
          data={phase.data}
          categories={categories}
          name={name}
          onName={setName}
          categoryId={categoryId}
          onCategoryId={setCategoryId}
          onConfirm={bookAndMaybeSave}
          onCancel={reset}
        />
      )}

      {phase.kind === "saving" && (
        <p className="mt-8 text-center text-sm text-neutral-400">Speichere …</p>
      )}

      {phase.kind === "done" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-5xl"
            style={{ backgroundColor: phase.categoryColor, color: "#0b0d12" }}
          >
            ✓
          </div>
          <p className="text-lg">{phase.user || "Strich"}</p>
          <p className="text-base text-neutral-300">{phase.categoryLabel}</p>
          <div className="flex gap-3">
            <button
              onClick={startScanner}
              className="rounded-xl bg-white px-4 py-2 font-semibold text-neutral-900"
            >
              Nächster Scan
            </button>
            <Link
              href="/m"
              className="rounded-xl bg-neutral-800 px-4 py-2 text-neutral-200"
            >
              Fertig
            </Link>
          </div>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-base text-red-400">{phase.message}</p>
          <button
            onClick={reset}
            className="rounded-xl bg-white px-4 py-2 font-semibold text-neutral-900"
          >
            Nochmal
          </button>
        </div>
      )}
    </main>
  );
}

function ReviewView({
  data,
  categories,
  name,
  onName,
  categoryId,
  onCategoryId,
  onConfirm,
  onCancel,
}: {
  data: LookupResult;
  categories: Category[];
  name: string;
  onName: (s: string) => void;
  categoryId: string;
  onCategoryId: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const known = data.product != null;
  const heading = known
    ? "Bekanntes Produkt"
    : data.lookup?.name
      ? "Neu (von OpenGTIN)"
      : "Unbekannt – manuell zuordnen";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-neutral-900 p-4 ring-1 ring-neutral-800">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{heading}</p>
        <p className="mt-1 font-mono text-xs text-neutral-500">EAN {data.ean}</p>
        {known && data.product && (
          <p className="mt-2 text-lg font-semibold">{data.product.name}</p>
        )}
        {!known && (
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Produktname</span>
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="z.B. Cola 0,33"
              className="rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-600"
            />
            {data.lookup?.vendor && (
              <span className="text-xs text-neutral-500">
                Hersteller laut OpenGTIN: {data.lookup.vendor}
              </span>
            )}
            {data.lookup?.error && (
              <span className="text-xs text-neutral-500">
                Kein OpenGTIN-Treffer – bitte Namen + Kategorie manuell setzen.
              </span>
            )}
          </label>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm text-neutral-400">Kategorie</p>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                onClick={() => onCategoryId(c.id)}
                className={`rounded-2xl p-3 text-left text-sm font-semibold transition ${
                  active ? "ring-2 ring-white" : "opacity-80"
                }`}
                style={{ backgroundColor: c.color, color: "#0b0d12" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl bg-neutral-800 px-4 py-3 text-neutral-200"
        >
          Abbrechen
        </button>
        <button
          onClick={onConfirm}
          disabled={!categoryId || (!known && !name.trim())}
          className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-neutral-900 disabled:opacity-50"
        >
          {known ? "Strich buchen" : "Speichern + buchen"}
        </button>
      </div>
    </div>
  );
}

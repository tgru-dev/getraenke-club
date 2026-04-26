"use client";

import { useEffect, useRef, useState } from "react";

export function SonstigesDialog({
  color,
  onCancel,
  onConfirm,
  busy = false,
}: {
  color: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const note = text.trim();
    if (!note) return;
    onConfirm(note);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-neutral-900 p-5 shadow-2xl ring-1 ring-neutral-800">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h2 className="text-lg font-semibold">Sonstiges</h2>
        </div>
        <p className="mb-3 text-sm text-neutral-400">
          Was hast du getrunken? Kurz beschreiben.
        </p>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="z.B. Energy, Wasser, Kaffee …"
          maxLength={120}
          className="w-full rounded-xl bg-neutral-800 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-neutral-600"
        />
        <div className="mt-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-neutral-800 px-4 py-3 text-neutral-200"
          >
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-neutral-900 disabled:opacity-50"
          >
            Buchen
          </button>
        </div>
      </div>
    </div>
  );
}

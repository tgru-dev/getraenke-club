"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const url = "/sw.js";
    navigator.serviceWorker.register(url).catch(() => {
      // Registrierung optional – App funktioniert auch ohne SW.
    });
  }, []);
  return null;
}

// Offline-Puffer fuer Buchungen der Mitglieder-App.
// Schlaegt der POST mangels Netz fehl, landet die Buchung in localStorage und
// wird beim naechsten online-Event / Intervall nachgereicht. Die client_id
// macht das Nachreichen idempotent (Server legt nie Duplikate an).

import { api, NetworkError } from "./api";
import type { QueuedBooking } from "../../shared/types";

const QUEUE_KEY = "gc_queue";
const listeners = new Set<(count: number) => void>();
let flushing = false;

function readQueue(): QueuedBooking[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedBooking[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedBooking[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  for (const fn of listeners) fn(queue.length);
}

export function pendingCount(): number {
  return readQueue().length;
}

export function onQueueChange(fn: (count: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export type BookResult =
  | { status: "ok"; drinkId: number }
  | { status: "queued"; clientId: string };

export async function bookDrink(categoryId: number, note: string | null): Promise<BookResult> {
  const booking: QueuedBooking = {
    clientId: crypto.randomUUID(),
    categoryId,
    note,
    createdAt: Date.now(),
  };
  try {
    const res = await api<{ id: number }>("/drinks", { method: "POST", body: booking });
    return { status: "ok", drinkId: res.id };
  } catch (e) {
    if (e instanceof NetworkError) {
      writeQueue([...readQueue(), booking]);
      return { status: "queued", clientId: booking.clientId };
    }
    throw e;
  }
}

/** Undo einer noch nicht synchronisierten Buchung: einfach aus der Queue nehmen. */
export function removeQueued(clientId: string): boolean {
  const queue = readQueue();
  const next = queue.filter((q) => q.clientId !== clientId);
  if (next.length === queue.length) return false;
  writeQueue(next);
  return true;
}

export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    let queue = readQueue();
    for (const item of queue) {
      try {
        await api("/drinks", { method: "POST", body: item });
        queue = queue.filter((q) => q.clientId !== item.clientId);
        writeQueue(queue);
        synced++;
      } catch (e) {
        if (e instanceof NetworkError) break; // immer noch offline → spaeter erneut
        // Fachlicher Fehler (z. B. Kategorie geloescht): Eintrag verwerfen,
        // sonst blockiert er die Queue fuer immer.
        queue = queue.filter((q) => q.clientId !== item.clientId);
        writeQueue(queue);
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}

export function startQueueSync() {
  window.addEventListener("online", () => void flushQueue());
  setInterval(() => {
    if (pendingCount() > 0) void flushQueue();
  }, 30_000);
  if (pendingCount() > 0) void flushQueue();
}

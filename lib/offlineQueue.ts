// Client-seitige Offline-Queue für Tally-Buchungen.
// Speichert in localStorage und versucht zyklisch nachzusenden, sobald
// das Netz wieder verfügbar ist.

const STORAGE_KEY = "drinks:tallyQueue:v1";

export type QueuedTally = {
  id: string; // client-uuid
  userName: string; // bindet Eintrag an aktuell angemeldeten User
  categoryId: string;
  source: "tap" | "scan";
  productId?: string;
  note?: string;
  createdAt: string; // ISO
};

function read(): QueuedTally[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: QueuedTally[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getQueueFor(userName: string): QueuedTally[] {
  return read().filter((q) => q.userName === userName);
}

export function enqueue(item: QueuedTally) {
  const all = read();
  all.push(item);
  write(all);
}

export function removeById(id: string) {
  write(read().filter((q) => q.id !== id));
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Versucht alle Einträge des aktuellen Users nachzusenden.
 * Bricht bei 401 (Session weg) ab, damit der User sich neu anmelden kann.
 * Liefert die Anzahl erfolgreich gesendeter Einträge.
 */
export async function flushQueue(userName: string): Promise<{
  sent: number;
  remaining: number;
  authError: boolean;
}> {
  const items = getQueueFor(userName);
  let sent = 0;
  for (const item of items) {
    try {
      const res = await fetch("/api/tallies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: item.categoryId,
          source: item.source,
          productId: item.productId,
          ...(item.note ? { note: item.note } : {}),
        }),
      });
      if (res.status === 401) {
        return { sent, remaining: getQueueFor(userName).length, authError: true };
      }
      if (res.ok || res.status === 429) {
        // 429 = Rate-Limit – kurz warten dann weiter
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 500));
          // ohne Erfolg, nicht entfernen, später neu versuchen
          continue;
        }
        removeById(item.id);
        sent += 1;
      } else {
        // Server-Fehler -> abbrechen, später neu versuchen
        break;
      }
    } catch {
      // Netzwerk noch tot -> abbrechen
      break;
    }
  }
  return {
    sent,
    remaining: getQueueFor(userName).length,
    authError: false,
  };
}

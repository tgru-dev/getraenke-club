// Zeitstempel werden als UTC-Epoch (ms) gespeichert. Fuer Tagesgruppierung,
// Heatmap und CSV-Export brauchen wir lokale Clubzeit (Europe/Berlin) inkl.
// Sommer-/Winterzeit. SQLite kennt keine Zeitzonen-Datenbank, daher wird in
// JS mit Intl aggregiert (Datenmengen sind klein: ~40 Mitglieder).

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
});

const hourFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "numeric",
  hour12: false,
});

const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

export function berlinDate(ms: number): string {
  return dateFmt.format(new Date(ms)); // "YYYY-MM-DD"
}

export function berlinTime(ms: number): string {
  return timeFmt.format(new Date(ms)); // "HH:MM"
}

export function berlinHour(ms: number): number {
  return parseInt(hourFmt.format(new Date(ms)), 10) % 24;
}

export function berlinWeekday(ms: number): number {
  return WEEKDAY_INDEX[weekdayFmt.format(new Date(ms))] ?? 0;
}

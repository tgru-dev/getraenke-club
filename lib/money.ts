// Geldbeträge im System sind immer Cent-Integer.
// UI-Eingabe kann "1,50" oder "1.50" sein.

const FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function formatEur(cents: number): string {
  return FORMATTER.format(cents / 100);
}

export function eurToCents(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToEurInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

import { prisma } from "./db";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

export type OpenGtinResult = {
  ean: string;
  found: boolean;
  name?: string;
  vendor?: string;
  raw?: string;
  error?: string;
};

function parseResponse(text: string): { found: boolean; name?: string; vendor?: string; error?: string } {
  // OpenGTIN-DB liefert Text im key=value-Format, eine Eigenschaft pro Zeile.
  // Felder können numerische Suffixe haben (name0, name1, ...). Wir nehmen
  // den ersten gefundenen, nicht leeren Wert.
  const lines = text.split(/\r?\n/);
  const get = (rx: RegExp): string | undefined => {
    for (const line of lines) {
      const m = line.match(rx);
      if (m && m[1] && m[1].trim()) return m[1].trim();
    }
    return undefined;
  };

  const errorRaw = get(/^error=(.+)$/i);
  if (errorRaw && errorRaw !== "0") {
    return { found: false, error: errorRaw };
  }

  const detail = get(/^(?:detail)?name\d*=(.+)$/i);
  const name = detail ?? get(/^pname\d*=(.+)$/i);
  const vendor = get(/^(?:vendor|hersteller|maker)\d*=(.+)$/i);

  if (!name) return { found: false, error: errorRaw ?? "no_name" };
  return { found: true, name, vendor };
}

export async function lookupOpenGtin(ean: string): Promise<OpenGtinResult> {
  // 1) Cache prüfen
  const cached = await prisma.barcodeCache.findUnique({ where: { ean } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    const parsed = parseResponse(cached.payload);
    return { ean, raw: cached.payload, ...parsed };
  }

  // 2) Live abfragen
  const queryid = process.env.OPENGTIN_QUERYID ?? "400000000";
  const url = `https://opengtindb.org/?ean=${encodeURIComponent(
    ean,
  )}&cmd=query&queryid=${encodeURIComponent(queryid)}`;

  let payload = "";
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(8000),
    });
    payload = await res.text();
  } catch (err) {
    return {
      ean,
      found: false,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }

  await prisma.barcodeCache.upsert({
    where: { ean },
    update: { payload, fetchedAt: new Date() },
    create: { ean, payload },
  });

  const parsed = parseResponse(payload);
  return { ean, raw: payload, ...parsed };
}

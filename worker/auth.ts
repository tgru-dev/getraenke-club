// PIN-Hashing & Token-Signierung.
//
// Bewusste Entscheidung: SHA-256 mit Salt statt PBKDF2/bcrypt. Bei einem
// 4-stelligen PIN-Raum (10.000 Moeglichkeiten) bietet Key-Stretching keinen
// echten Schutz gegen Offline-Brute-Force, kostet aber CPU-Zeit, die im
// Workers-Free-Tier knapp ist. Der wirksame Schutz ist das serverseitige
// Rate-Limiting (5 Fehlversuche -> 5 Minuten Sperre, siehe index.ts).

const encoder = new TextEncoder();

export function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${pin}`);
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface TokenPayload {
  sub: number;
  role: "mitglied" | "vorstand";
  exp: number; // ms epoch
}

export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const body = base64UrlEncode(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  try {
    const key = await hmacKey(secret);
    const sigBytes = Uint8Array.from(base64UrlDecode(sigPart), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(base64UrlDecode(body)) as TokenPayload;
    if (typeof payload.sub !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

import { Hono } from "hono";
import type { Context } from "hono";
import { hashPin, randomHex, signToken, verifyToken, type TokenPayload } from "./auth";
import { berlinDate, berlinTime, berlinHour, berlinWeekday } from "./time";

interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
  ASSETS: Fetcher;
}

type AppContext = { Bindings: Env; Variables: { auth: TokenPayload } };

const app = new Hono<AppContext>().basePath("/api");

const UNDO_WINDOW_MS = 60_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60_000;
const TOKEN_TTL_SHORT = 12 * 60 * 60_000; // 12 h
const TOKEN_TTL_LONG = 90 * 24 * 60 * 60_000; // 90 Tage ("merken")

// ---------- Hilfsfunktionen ----------

function err(c: Context, status: 400 | 401 | 403 | 404 | 409 | 423, message: string) {
  return c.json({ error: message }, status);
}

// Schwache PINs ablehnen: alle Ziffern gleich (1111), auf-/absteigende Folgen
// (1234, 4321, 0123) und Doppelmuster (1212). Gilt ueberall, wo eine PIN
// gesetzt wird — bestehende PINs bleiben unberuehrt.
const WEAK_PIN_ERROR =
  "Zu unsichere PIN – bitte keine Wiederholungen (1111, 1212) oder Folgen (1234, 4321)";

function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{3}$/.test(pin)) return true; // 0000–9999 mit gleichen Ziffern
  if (/^(\d\d)\1$/.test(pin)) return true; // 1212, 4747, …
  const d = [...pin].map(Number);
  const ascending = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  const descending = d.every((v, i) => i === 0 || v === d[i - 1] - 1);
  return ascending || descending;
}

/** Prueft Format + Staerke einer neuen PIN; gibt Fehlermeldung oder null zurueck. */
function validateNewPin(pin: string | undefined): string | null {
  if (!pin || !/^\d{4}$/.test(pin)) return "PIN muss genau 4 Ziffern haben";
  if (isWeakPin(pin)) return WEAK_PIN_ERROR;
  return null;
}

async function audit(db: D1Database, actorId: number | null, action: string, details: unknown) {
  await db
    .prepare("INSERT INTO audit_log (actor_id, action, details, created_at) VALUES (?, ?, ?, ?)")
    .bind(actorId, action, JSON.stringify(details), Date.now())
    .run();
}

interface MemberRow {
  id: number;
  name: string;
  pin_hash: string;
  pin_salt: string;
  role: "mitglied" | "vorstand";
  color: string;
  active: number;
  failed_attempts: number;
  locked_until: number | null;
  created_at: number;
  deleted_at: number | null;
}

async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/** Prueft PIN inkl. Rate-Limiting. Gibt das Mitglied zurueck oder eine Fehlermeldung. */
async function checkPin(
  db: D1Database,
  memberId: number,
  pin: string
): Promise<{ member: MemberRow } | { error: string; locked?: boolean }> {
  const member = await db
    .prepare("SELECT * FROM members WHERE id = ? AND active = 1 AND deleted_at IS NULL")
    .bind(memberId)
    .first<MemberRow>();
  if (!member) return { error: "Mitglied nicht gefunden" };

  const now = Date.now();
  if (member.locked_until && member.locked_until > now) {
    const minutes = Math.ceil((member.locked_until - now) / 60_000);
    return { error: `Zu viele Fehlversuche. Gesperrt für ${minutes} Min.`, locked: true };
  }

  const hash = await hashPin(pin, member.pin_salt);
  if (hash !== member.pin_hash) {
    const attempts = member.failed_attempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? now + LOCK_DURATION_MS : null;
    await db
      .prepare("UPDATE members SET failed_attempts = ?, locked_until = ? WHERE id = ?")
      .bind(lockedUntil ? 0 : attempts, lockedUntil, member.id)
      .run();
    return lockedUntil
      ? { error: "Zu viele Fehlversuche. Gesperrt für 5 Min.", locked: true }
      : { error: `Falsche PIN (Versuch ${attempts}/${MAX_FAILED_ATTEMPTS})` };
  }

  if (member.failed_attempts > 0 || member.locked_until) {
    await db
      .prepare("UPDATE members SET failed_attempts = 0, locked_until = NULL WHERE id = ?")
      .bind(member.id)
      .run();
  }
  return { member };
}

function publicMember(m: MemberRow) {
  return { id: m.id, name: m.name, color: m.color, role: m.role };
}

const DRINK_SELECT = `
  SELECT d.id, d.member_id AS memberId, m.name AS memberName,
         d.category_id AS categoryId, c.name AS categoryName, c.color AS categoryColor,
         d.note, d.source, d.created_at AS createdAt
  FROM drinks d
  JOIN members m ON m.id = d.member_id
  JOIN categories c ON c.id = d.category_id
  WHERE d.deleted_at IS NULL`;

function parseRange(c: Context): { from: number; to: number } {
  const from = parseInt(c.req.query("from") ?? "", 10);
  const to = parseInt(c.req.query("to") ?? "", 10);
  return {
    from: Number.isFinite(from) ? from : 0,
    to: Number.isFinite(to) ? to : Date.now() + 60_000,
  };
}

// ---------- Auth-Middleware ----------

function getToken(c: Context<AppContext>): string | null {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  // Query-Token fuer Download-Links (CSV-Export), wo keine Header moeglich sind
  return c.req.query("token") ?? null;
}

const requireAuth = async (c: Context<AppContext>, next: () => Promise<void>) => {
  const token = getToken(c);
  const payload = token ? await verifyToken(token, c.env.AUTH_SECRET) : null;
  if (!payload) return err(c, 401, "Nicht angemeldet");
  c.set("auth", payload);
  await next();
};

const requireAdmin = async (c: Context<AppContext>, next: () => Promise<void>) => {
  const token = getToken(c);
  const payload = token ? await verifyToken(token, c.env.AUTH_SECRET) : null;
  if (!payload) return err(c, 401, "Nicht angemeldet");
  if (payload.role !== "vorstand") return err(c, 403, "Nur für den Vorstand");
  c.set("auth", payload);
  await next();
};

// ---------- Setup (Erstinbetriebnahme) ----------

app.get("/setup/status", async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>();
  return c.json({ needsSetup: (row?.n ?? 0) === 0 });
});

app.post("/setup", async (c) => {
  const { name, pin } = await c.req.json<{ name?: string; pin?: string }>();
  if (!name?.trim()) return err(c, 400, "Name erforderlich");
  const pinError = validateNewPin(pin);
  if (pinError) return err(c, 400, pinError);
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>();
  if ((row?.n ?? 0) > 0) return err(c, 409, "Setup wurde bereits durchgeführt");

  const salt = randomHex(16);
  const hash = await hashPin(pin!, salt);
  const result = await c.env.DB.prepare(
    "INSERT INTO members (name, pin_hash, pin_salt, role, color, created_at) VALUES (?, ?, ?, 'vorstand', '#f5a524', ?)"
  )
    .bind(name.trim(), hash, salt, Date.now())
    .run();
  const id = result.meta.last_row_id as number;
  await audit(c.env.DB, id, "setup", { name: name.trim() });
  const token = await signToken(
    { sub: id, role: "vorstand", exp: Date.now() + TOKEN_TTL_SHORT },
    c.env.AUTH_SECRET
  );
  return c.json({ token, member: { id, name: name.trim(), color: "#f5a524", role: "vorstand" } });
});

// Selbst-Registrierung: legt IMMER ein normales Mitglied an (Rolle ist nicht
// vom Client waehlbar). Erst moeglich, wenn die Ersteinrichtung gelaufen ist.
app.post("/signup", async (c) => {
  const { name, pin, color, code } = await c.req.json<{
    name?: string;
    pin?: string;
    color?: string;
    code?: string;
  }>();
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return err(c, 400, "Name erforderlich");
  if (trimmed.length > 40) return err(c, 400, "Name zu lang (max. 40 Zeichen)");
  const pinError = validateNewPin(pin);
  if (pinError) return err(c, 400, pinError);

  // Optionaler Club-Code (vom Vorstand in den Einstellungen gesetzt)
  const signupCode = (await getSetting(c.env.DB, "signupCode"))?.trim();
  if (signupCode && (code ?? "").trim().toLowerCase() !== signupCode.toLowerCase()) {
    return err(c, 403, "Falscher Club-Code – frag beim Vorstand nach");
  }

  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>();
  if ((count?.n ?? 0) === 0) {
    return err(c, 409, "Bitte zuerst die Ersteinrichtung unter /setup durchführen");
  }
  const existing = await c.env.DB.prepare(
    "SELECT id FROM members WHERE active = 1 AND deleted_at IS NULL AND lower(name) = lower(?)"
  )
    .bind(trimmed)
    .first<{ id: number }>();
  if (existing) return err(c, 409, "Dieser Name ist bereits vergeben");

  const salt = randomHex(16);
  const hash = await hashPin(pin!, salt);
  const memberColor = /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? color! : "#f5a524";
  const result = await c.env.DB.prepare(
    "INSERT INTO members (name, pin_hash, pin_salt, role, color, created_at) VALUES (?, ?, ?, 'mitglied', ?, ?)"
  )
    .bind(trimmed, hash, salt, memberColor, Date.now())
    .run();
  const id = result.meta.last_row_id as number;
  await audit(c.env.DB, id, "mitglied_registriert", { name: trimmed });
  const token = await signToken(
    { sub: id, role: "mitglied", exp: Date.now() + TOKEN_TTL_SHORT },
    c.env.AUTH_SECRET
  );
  return c.json({ token, member: { id, name: trimmed, color: memberColor, role: "mitglied" } });
});

// ---------- Oeffentlich (Login-Picker, Tresen, Branding) ----------

app.get("/members/public", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, color, role FROM members WHERE active = 1 AND deleted_at IS NULL ORDER BY name COLLATE NOCASE"
  ).all();
  return c.json(rows.results);
});

app.get("/categories", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, color, sort_order AS sortOrder, free_text AS freeText, active FROM categories WHERE active = 1 ORDER BY sort_order, id"
  ).all();
  return c.json(
    rows.results.map((r) => ({ ...r, freeText: !!r.freeText, active: !!r.active }))
  );
});

app.get("/settings", async (c) => {
  const rows = await c.env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const map = Object.fromEntries(rows.results.map((r) => [r.key, r.value]));
  return c.json({
    clubName: map.clubName ?? "Jugendclub",
    logo: map.logo ?? null,
    // Nur das Flag, nie der Code selbst
    signupCodeRequired: !!map.signupCode?.trim(),
  });
});

// ---------- Login & Konto ----------

app.post("/auth/login", async (c) => {
  const { memberId, pin, remember } = await c.req.json<{
    memberId?: number;
    pin?: string;
    remember?: boolean;
  }>();
  if (!memberId || !pin) return err(c, 400, "Mitglied und PIN erforderlich");

  const result = await checkPin(c.env.DB, memberId, pin);
  if ("error" in result) return err(c, result.locked ? 423 : 401, result.error);

  const ttl = remember ? TOKEN_TTL_LONG : TOKEN_TTL_SHORT;
  const token = await signToken(
    { sub: result.member.id, role: result.member.role, exp: Date.now() + ttl },
    c.env.AUTH_SECRET
  );
  return c.json({ token, member: publicMember(result.member) });
});

app.get("/auth/me", requireAuth, async (c) => {
  const auth = c.get("auth");
  const member = await c.env.DB.prepare(
    "SELECT * FROM members WHERE id = ? AND active = 1 AND deleted_at IS NULL"
  )
    .bind(auth.sub)
    .first<MemberRow>();
  if (!member) return err(c, 401, "Konto nicht mehr aktiv");
  return c.json({ member: publicMember(member) });
});

app.post("/auth/pin", requireAuth, async (c) => {
  const auth = c.get("auth");
  const { currentPin, newPin } = await c.req.json<{ currentPin?: string; newPin?: string }>();
  if (!currentPin) return err(c, 400, "Aktuelle PIN erforderlich");
  const pinError = validateNewPin(newPin);
  if (pinError) return err(c, 400, pinError);
  const result = await checkPin(c.env.DB, auth.sub, currentPin);
  if ("error" in result) return err(c, result.locked ? 423 : 401, result.error);

  const salt = randomHex(16);
  const hash = await hashPin(newPin!, salt);
  await c.env.DB.prepare("UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ?")
    .bind(hash, salt, auth.sub)
    .run();
  return c.json({ ok: true });
});

// ---------- Buchungen (Mitglieder-App) ----------

async function insertDrink(
  db: D1Database,
  data: {
    memberId: number;
    categoryId: number;
    note: string | null;
    source: "mitglied" | "tresen" | "admin";
    clientId: string | null;
    undoToken: string | null;
    createdAt: number;
  }
): Promise<{ id: number; duplicate: boolean } | { invalid: string }> {
  const category = await db
    .prepare("SELECT id, free_text FROM categories WHERE id = ? AND active = 1")
    .bind(data.categoryId)
    .first<{ id: number; free_text: number }>();
  if (!category) return { invalid: "Kategorie nicht gefunden" };

  if (data.clientId) {
    const existing = await db
      .prepare("SELECT id FROM drinks WHERE client_id = ?")
      .bind(data.clientId)
      .first<{ id: number }>();
    if (existing) return { id: existing.id, duplicate: true };
  }

  const result = await db
    .prepare(
      "INSERT INTO drinks (member_id, category_id, note, source, client_id, undo_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      data.memberId,
      data.categoryId,
      data.note,
      data.source,
      data.clientId,
      data.undoToken,
      data.createdAt
    )
    .run();
  return { id: result.meta.last_row_id as number, duplicate: false };
}

app.post("/drinks", requireAuth, async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<{
    categoryId?: number;
    note?: string;
    clientId?: string;
    createdAt?: number;
  }>();
  if (!body.categoryId) return err(c, 400, "Kategorie erforderlich");

  // createdAt kommt vom Client, damit offline gepufferte Buchungen den
  // tatsaechlichen Zeitpunkt behalten (begrenzt auf max. 7 Tage rueckwirkend).
  const now = Date.now();
  let createdAt = typeof body.createdAt === "number" ? body.createdAt : now;
  if (createdAt > now || createdAt < now - 7 * 24 * 60 * 60_000) createdAt = now;

  const result = await insertDrink(c.env.DB, {
    memberId: auth.sub,
    categoryId: body.categoryId,
    note: body.note?.trim() || null,
    source: "mitglied",
    clientId: body.clientId ?? null,
    undoToken: null,
    createdAt,
  });
  if ("invalid" in result) return err(c, 400, result.invalid);
  return c.json({ id: result.id, duplicate: result.duplicate });
});

app.delete("/drinks/:id", requireAuth, async (c) => {
  const auth = c.get("auth");
  const id = parseInt(c.req.param("id") ?? "", 10);
  const drink = await c.env.DB.prepare(
    "SELECT id, member_id, created_at FROM drinks WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ id: number; member_id: number; created_at: number }>();
  if (!drink || drink.member_id !== auth.sub) return err(c, 404, "Buchung nicht gefunden");
  if (Date.now() - drink.created_at > UNDO_WINDOW_MS) {
    return err(c, 403, "Undo nur innerhalb von 60 Sekunden möglich");
  }
  await c.env.DB.prepare("UPDATE drinks SET deleted_at = ?, deleted_by = ? WHERE id = ?")
    .bind(Date.now(), auth.sub, id)
    .run();
  return c.json({ ok: true });
});

app.get("/me/summary", requireAuth, async (c) => {
  const auth = c.get("auth");
  const now = Date.now();

  // Tagesbeginn/Monatsbeginn in Berlin-Zeit bestimmen
  const today = berlinDate(now);
  const monthStartDate = today.slice(0, 8) + "01";

  const rows = await c.env.DB.prepare(
    `${DRINK_SELECT} AND d.member_id = ? AND d.created_at >= ? ORDER BY d.created_at DESC`
  )
    .bind(auth.sub, now - 35 * 24 * 60 * 60_000)
    .all();

  const drinks = rows.results as unknown as { createdAt: number; categoryId: number }[];
  const todayDrinks = drinks.filter((d) => berlinDate(d.createdAt) === today);
  const monthCountsMap = new Map<number, number>();
  for (const d of drinks) {
    if (berlinDate(d.createdAt) >= monthStartDate) {
      monthCountsMap.set(d.categoryId, (monthCountsMap.get(d.categoryId) ?? 0) + 1);
    }
  }
  return c.json({
    today: todayDrinks,
    monthCounts: [...monthCountsMap.entries()].map(([categoryId, count]) => ({ categoryId, count })),
  });
});

app.get("/me/history", requireAuth, async (c) => {
  const auth = c.get("auth");
  const rows = await c.env.DB.prepare(
    `${DRINK_SELECT} AND d.member_id = ? ORDER BY d.created_at DESC LIMIT 300`
  )
    .bind(auth.sub)
    .all();
  return c.json(rows.results);
});

// "Club Wrapped": persoenlicher Jahresrueckblick + zwei Club-Gesamtzahlen.
// Bewusst KEINE Vergleiche/Rankings zwischen Mitgliedern (Jugendschutz-Gedanke).
app.get("/me/wrapped", requireAuth, async (c) => {
  const auth = c.get("auth");
  const yearParam = parseInt(c.req.query("year") ?? "", 10);
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
  // Jahresgrenzen in Berlin-Zeit: 1. Januar ist immer Winterzeit (UTC+1)
  const from = Date.UTC(year - 1, 11, 31, 23, 0, 0);
  const to = Date.UTC(year, 11, 31, 23, 0, 0);

  const mine = await c.env.DB.prepare(
    `SELECT d.created_at AS createdAt, cat.name, cat.color
     FROM drinks d JOIN categories cat ON cat.id = d.category_id
     WHERE d.deleted_at IS NULL AND d.member_id = ? AND d.created_at >= ? AND d.created_at < ?`
  )
    .bind(auth.sub, from, to)
    .all<{ createdAt: number; name: string; color: string }>();

  const perCategoryMap = new Map<string, { color: string; count: number }>();
  const perDay = new Map<string, number>();
  const perWeekday = Array(7).fill(0) as number[];
  let nightOwl: { date: string; time: string; score: number } | null = null;
  let firstDrink: number | null = null;

  for (const d of mine.results) {
    const cat = perCategoryMap.get(d.name) ?? { color: d.color, count: 0 };
    cat.count++;
    perCategoryMap.set(d.name, cat);
    const date = berlinDate(d.createdAt);
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
    perWeekday[berlinWeekday(d.createdAt)]++;
    // "Nachteule": am weitesten in die Nacht (18:00 = Abendbeginn, 17:59 = Maximum)
    const hour = berlinHour(d.createdAt);
    const score = ((hour - 18 + 24) % 24) * 60 + (d.createdAt % 3_600_000) / 60_000;
    if (!nightOwl || score > nightOwl.score) {
      nightOwl = { date, time: berlinTime(d.createdAt), score };
    }
    if (firstDrink === null || d.createdAt < firstDrink) firstDrink = d.createdAt;
  }

  let busiestDay: { date: string; count: number } | null = null;
  for (const [date, count] of perDay) {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date, count };
  }
  const myTotal = mine.results.length;
  const maxWeekday = Math.max(...perWeekday);

  const club = await c.env.DB.prepare(
    `SELECT cat.name, COUNT(*) AS n
     FROM drinks d JOIN categories cat ON cat.id = d.category_id
     WHERE d.deleted_at IS NULL AND d.created_at >= ? AND d.created_at < ?
     GROUP BY cat.id ORDER BY n DESC`
  )
    .bind(from, to)
    .all<{ name: string; n: number }>();

  return c.json({
    year,
    myTotal,
    perCategory: [...perCategoryMap.entries()]
      .map(([name, v]) => ({ name, color: v.color, count: v.count }))
      .sort((a, b) => b.count - a.count),
    activeDays: perDay.size,
    busiestDay,
    busiestWeekday: myTotal > 0 ? perWeekday.indexOf(maxWeekday) : null,
    nightOwl: nightOwl ? { date: nightOwl.date, time: nightOwl.time } : null,
    firstDrink,
    clubTotal: club.results.reduce((a, r) => a + r.n, 0),
    clubTopCategory: club.results[0]?.name ?? null,
  });
});

// ---------- Tresenmodus ----------

app.post("/tresen/book", async (c) => {
  const { memberId, pin, categoryId, note } = await c.req.json<{
    memberId?: number;
    pin?: string;
    categoryId?: number;
    note?: string;
  }>();
  if (!memberId || !pin || !categoryId) return err(c, 400, "Unvollständige Anfrage");

  const result = await checkPin(c.env.DB, memberId, pin);
  if ("error" in result) return err(c, result.locked ? 423 : 401, result.error);

  const undoToken = randomHex(16);
  const inserted = await insertDrink(c.env.DB, {
    memberId,
    categoryId,
    note: note?.trim() || null,
    source: "tresen",
    clientId: null,
    undoToken,
    createdAt: Date.now(),
  });
  if ("invalid" in inserted) return err(c, 400, inserted.invalid);
  return c.json({ drinkId: inserted.id, undoToken });
});

// Undo am Tresen: braucht das Undo-Token aus der Buchungsantwort (kennt nur
// das Tablet der laufenden Sitzung) — keine erneute PIN-Eingabe noetig.
app.post("/tresen/undo", async (c) => {
  const { drinkId, undoToken } = await c.req.json<{ drinkId?: number; undoToken?: string }>();
  if (!drinkId || !undoToken) return err(c, 400, "Unvollständige Anfrage");
  const drink = await c.env.DB.prepare(
    "SELECT id, member_id, created_at, undo_token FROM drinks WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(drinkId)
    .first<{ id: number; member_id: number; created_at: number; undo_token: string | null }>();
  if (!drink || drink.undo_token !== undoToken) return err(c, 404, "Buchung nicht gefunden");
  if (Date.now() - drink.created_at > UNDO_WINDOW_MS) {
    return err(c, 403, "Undo nur innerhalb von 60 Sekunden möglich");
  }
  await c.env.DB.prepare("UPDATE drinks SET deleted_at = ?, deleted_by = ? WHERE id = ?")
    .bind(Date.now(), drink.member_id, drinkId)
    .run();
  return c.json({ ok: true });
});

// ---------- Admin: Mitglieder ----------

app.get("/admin/members", requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, color, role, active, created_at AS createdAt FROM members WHERE deleted_at IS NULL ORDER BY active DESC, name COLLATE NOCASE"
  ).all();
  return c.json(rows.results.map((r) => ({ ...r, active: !!r.active })));
});

app.post("/admin/members", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const { name, pin, role, color } = await c.req.json<{
    name?: string;
    pin?: string;
    role?: string;
    color?: string;
  }>();
  if (!name?.trim()) return err(c, 400, "Name erforderlich");
  const pinError = validateNewPin(pin);
  if (pinError) return err(c, 400, pinError);
  const memberRole = role === "vorstand" ? "vorstand" : "mitglied";
  const salt = randomHex(16);
  const hash = await hashPin(pin!, salt);
  const result = await c.env.DB.prepare(
    "INSERT INTO members (name, pin_hash, pin_salt, role, color, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(name.trim(), hash, salt, memberRole, color || "#f5a524", Date.now())
    .run();
  await audit(c.env.DB, auth.sub, "mitglied_angelegt", { name: name.trim(), role: memberRole });
  return c.json({ id: result.meta.last_row_id });
});

app.patch("/admin/members/:id", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const id = parseInt(c.req.param("id") ?? "", 10);
  const body = await c.req.json<{
    name?: string;
    role?: string;
    active?: boolean;
    color?: string;
    pin?: string;
  }>();
  const member = await c.env.DB.prepare("SELECT * FROM members WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<MemberRow>();
  if (!member) return err(c, 404, "Mitglied nicht gefunden");

  // Sich selbst nicht aussperren
  if (id === auth.sub && (body.active === false || (body.role && body.role !== "vorstand"))) {
    return err(c, 400, "Du kannst dein eigenes Vorstandskonto nicht deaktivieren");
  }

  const changes: string[] = [];
  const name = body.name?.trim() || member.name;
  const role = body.role === "vorstand" || body.role === "mitglied" ? body.role : member.role;
  const active = typeof body.active === "boolean" ? (body.active ? 1 : 0) : member.active;
  const color = body.color || member.color;
  if (name !== member.name) changes.push(`Name: ${member.name} → ${name}`);
  if (role !== member.role) changes.push(`Rolle: ${role}`);
  if (active !== member.active) changes.push(active ? "aktiviert" : "deaktiviert");

  let pinHash = member.pin_hash;
  let pinSalt = member.pin_salt;
  if (body.pin) {
    const pinError = validateNewPin(body.pin);
    if (pinError) return err(c, 400, pinError);
    pinSalt = randomHex(16);
    pinHash = await hashPin(body.pin, pinSalt);
    changes.push("PIN zurückgesetzt");
  }

  await c.env.DB.prepare(
    "UPDATE members SET name = ?, role = ?, active = ?, color = ?, pin_hash = ?, pin_salt = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?"
  )
    .bind(name, role, active, color, pinHash, pinSalt, id)
    .run();
  if (changes.length) {
    await audit(c.env.DB, auth.sub, "mitglied_geaendert", { memberId: id, name, changes });
  }
  return c.json({ ok: true });
});

// Finales Loeschen: Tombstone (deleted_at) statt echtem DELETE, damit die
// historischen Striche im Getraenke-Log ihren Namen behalten. Das Konto
// verschwindet aus Login, Tresen, Verwaltung und Uebersichten; die PIN wird
// unbrauchbar gemacht.
app.delete("/admin/members/:id", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const id = parseInt(c.req.param("id") ?? "", 10);
  if (id === auth.sub) return err(c, 400, "Du kannst dein eigenes Konto nicht löschen");
  const member = await c.env.DB.prepare("SELECT * FROM members WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<MemberRow>();
  if (!member) return err(c, 404, "Mitglied nicht gefunden");
  await c.env.DB.prepare(
    "UPDATE members SET deleted_at = ?, active = 0, role = 'mitglied', pin_hash = 'geloescht', pin_salt = '' WHERE id = ?"
  )
    .bind(Date.now(), id)
    .run();
  await audit(c.env.DB, auth.sub, "mitglied_geloescht", { memberId: id, name: member.name });
  return c.json({ ok: true });
});

// ---------- Admin: Kategorien ----------

app.get("/admin/categories", requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, color, sort_order AS sortOrder, free_text AS freeText, active, price FROM categories ORDER BY sort_order, id"
  ).all();
  return c.json(rows.results.map((r) => ({ ...r, freeText: !!r.freeText, active: !!r.active })));
});

app.post("/admin/categories", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const { name, color, sortOrder, freeText } = await c.req.json<{
    name?: string;
    color?: string;
    sortOrder?: number;
    freeText?: boolean;
  }>();
  if (!name?.trim()) return err(c, 400, "Name erforderlich");
  const result = await c.env.DB.prepare(
    "INSERT INTO categories (name, color, sort_order, free_text) VALUES (?, ?, ?, ?)"
  )
    .bind(name.trim(), color || "#f5a524", sortOrder ?? 99, freeText ? 1 : 0)
    .run();
  await audit(c.env.DB, auth.sub, "kategorie_angelegt", { name: name.trim() });
  return c.json({ id: result.meta.last_row_id });
});

app.patch("/admin/categories/:id", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const id = parseInt(c.req.param("id") ?? "", 10);
  const body = await c.req.json<{
    name?: string;
    color?: string;
    sortOrder?: number;
    freeText?: boolean;
    active?: boolean;
    price?: number | null;
  }>();
  const cat = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?")
    .bind(id)
    .first<{ id: number; name: string; color: string; sort_order: number; free_text: number; active: number; price: number | null }>();
  if (!cat) return err(c, 404, "Kategorie nicht gefunden");

  // price: Zahl in Cent setzt, null loescht, undefined laesst unveraendert
  let price = cat.price;
  if (body.price === null) price = null;
  else if (typeof body.price === "number" && body.price >= 0) price = Math.round(body.price);

  await c.env.DB.prepare(
    "UPDATE categories SET name = ?, color = ?, sort_order = ?, free_text = ?, active = ?, price = ? WHERE id = ?"
  )
    .bind(
      body.name?.trim() || cat.name,
      body.color || cat.color,
      typeof body.sortOrder === "number" ? body.sortOrder : cat.sort_order,
      typeof body.freeText === "boolean" ? (body.freeText ? 1 : 0) : cat.free_text,
      typeof body.active === "boolean" ? (body.active ? 1 : 0) : cat.active,
      price,
      id
    )
    .run();
  await audit(c.env.DB, auth.sub, "kategorie_geaendert", { categoryId: id, ...body });
  return c.json({ ok: true });
});

// ---------- Admin: Strichliste, Korrekturen, Stats ----------

app.get("/admin/overview", requireAdmin, async (c) => {
  const { from, to } = parseRange(c);
  const counts = await c.env.DB.prepare(
    `SELECT member_id AS memberId, category_id AS categoryId, COUNT(*) AS n
     FROM drinks WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
     GROUP BY member_id, category_id`
  )
    .bind(from, to)
    .all<{ memberId: number; categoryId: number; n: number }>();
  const members = await c.env.DB.prepare(
    "SELECT id, name, active FROM members WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE"
  ).all<{ id: number; name: string; active: number }>();

  const byMember = new Map<number, Record<number, number>>();
  for (const row of counts.results) {
    const rec = byMember.get(row.memberId) ?? {};
    rec[row.categoryId] = row.n;
    byMember.set(row.memberId, rec);
  }
  const rows = members.results
    .map((m) => {
      const rec = byMember.get(m.id) ?? {};
      const total = Object.values(rec).reduce((a, b) => a + b, 0);
      return { memberId: m.id, memberName: m.name, active: !!m.active, counts: rec, total };
    })
    .filter((r) => r.total > 0 || r.active);
  return c.json(rows);
});

app.get("/admin/members/:id/drinks", requireAdmin, async (c) => {
  const id = parseInt(c.req.param("id") ?? "", 10);
  const { from, to } = parseRange(c);
  const rows = await c.env.DB.prepare(
    `${DRINK_SELECT} AND d.member_id = ? AND d.created_at >= ? AND d.created_at < ? ORDER BY d.created_at DESC LIMIT 500`
  )
    .bind(id, from, to)
    .all();
  return c.json(rows.results);
});

app.post("/admin/drinks", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const { memberId, categoryId, note, createdAt } = await c.req.json<{
    memberId?: number;
    categoryId?: number;
    note?: string;
    createdAt?: number;
  }>();
  if (!memberId || !categoryId) return err(c, 400, "Mitglied und Kategorie erforderlich");
  const result = await insertDrink(c.env.DB, {
    memberId,
    categoryId,
    note: note?.trim() || null,
    source: "admin",
    clientId: null,
    undoToken: null,
    createdAt: typeof createdAt === "number" ? createdAt : Date.now(),
  });
  if ("invalid" in result) return err(c, 400, result.invalid);
  await audit(c.env.DB, auth.sub, "strich_nachgetragen", { memberId, categoryId, drinkId: result.id });
  return c.json({ id: result.id });
});

app.delete("/admin/drinks/:id", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const id = parseInt(c.req.param("id") ?? "", 10);
  const drink = await c.env.DB.prepare(
    "SELECT id, member_id, category_id, created_at FROM drinks WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(id)
    .first<{ id: number; member_id: number; category_id: number; created_at: number }>();
  if (!drink) return err(c, 404, "Buchung nicht gefunden");
  await c.env.DB.prepare("UPDATE drinks SET deleted_at = ?, deleted_by = ? WHERE id = ?")
    .bind(Date.now(), auth.sub, id)
    .run();
  await audit(c.env.DB, auth.sub, "strich_geloescht", {
    drinkId: id,
    memberId: drink.member_id,
    categoryId: drink.category_id,
    originalZeit: berlinDate(drink.created_at) + " " + berlinTime(drink.created_at),
  });
  return c.json({ ok: true });
});

// Stornierung rueckgaengig machen: Soft-Delete aufheben (Audit-Eintrag inklusive)
app.post("/admin/drinks/:id/restore", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const id = parseInt(c.req.param("id") ?? "", 10);
  const drink = await c.env.DB.prepare(
    "SELECT id, member_id, category_id, created_at FROM drinks WHERE id = ? AND deleted_at IS NOT NULL"
  )
    .bind(id)
    .first<{ id: number; member_id: number; category_id: number; created_at: number }>();
  if (!drink) return err(c, 404, "Keine stornierte Buchung mit dieser ID gefunden");
  await c.env.DB.prepare("UPDATE drinks SET deleted_at = NULL, deleted_by = NULL WHERE id = ?")
    .bind(id)
    .run();
  await audit(c.env.DB, auth.sub, "strich_wiederhergestellt", {
    drinkId: id,
    memberId: drink.member_id,
    categoryId: drink.category_id,
    originalZeit: berlinDate(drink.created_at) + " " + berlinTime(drink.created_at),
  });
  return c.json({ ok: true });
});

app.get("/admin/stats", requireAdmin, async (c) => {
  const { from, to } = parseRange(c);
  const rows = await c.env.DB.prepare(
    `SELECT d.member_id AS memberId, m.name AS memberName, d.category_id AS categoryId, d.created_at AS createdAt
     FROM drinks d JOIN members m ON m.id = d.member_id
     WHERE d.deleted_at IS NULL AND d.created_at >= ? AND d.created_at < ?`
  )
    .bind(from, to)
    .all<{ memberId: number; memberName: string; categoryId: number; createdAt: number }>();

  const perDayMap = new Map<string, Record<number, number>>();
  const topMap = new Map<number, { memberName: string; count: number }>();
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const r of rows.results) {
    const date = berlinDate(r.createdAt);
    const day = perDayMap.get(date) ?? {};
    day[r.categoryId] = (day[r.categoryId] ?? 0) + 1;
    perDayMap.set(date, day);

    const top = topMap.get(r.memberId) ?? { memberName: r.memberName, count: 0 };
    top.count++;
    topMap.set(r.memberId, top);

    heatmap[berlinWeekday(r.createdAt)][berlinHour(r.createdAt)]++;
  }

  return c.json({
    perDay: [...perDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, counts })),
    topDrinkers: [...topMap.entries()]
      .map(([memberId, v]) => ({ memberId, memberName: v.memberName, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    heatmap,
    total: rows.results.length,
  });
});

// Getraenke-Log: JEDE Buchung inkl. stornierter (Soft-Delete) — lueckenlos nachvollziehbar
app.get("/admin/log", requireAdmin, async (c) => {
  const { from, to } = parseRange(c);
  const rows = await c.env.DB.prepare(
    `SELECT d.id, d.member_id AS memberId, m.name AS memberName,
            d.category_id AS categoryId, cat.name AS categoryName, cat.color AS categoryColor,
            d.note, d.source, d.created_at AS createdAt,
            d.deleted_at AS deletedAt, del.name AS deletedByName,
            (m.deleted_at IS NOT NULL) AS memberDeleted
     FROM drinks d
     JOIN members m ON m.id = d.member_id
     JOIN categories cat ON cat.id = d.category_id
     LEFT JOIN members del ON del.id = d.deleted_by
     WHERE d.created_at >= ? AND d.created_at < ?
     ORDER BY d.created_at DESC LIMIT 1000`
  )
    .bind(from, to)
    .all();
  return c.json(rows.results.map((r) => ({ ...r, memberDeleted: !!r.memberDeleted })));
});

// Jahresabrechnung: Striche x Kategoriepreis pro Mitglied. Geloeschte und
// deaktivierte Mitglieder erscheinen, wenn sie Striche im Zeitraum haben
// (offene Rechnungen verschwinden nicht).
app.get("/admin/billing", requireAdmin, async (c) => {
  const { from, to } = parseRange(c);
  const counts = await c.env.DB.prepare(
    `SELECT d.member_id AS memberId, m.name AS memberName,
            (m.deleted_at IS NOT NULL) AS memberDeleted,
            d.category_id AS categoryId, COUNT(*) AS n
     FROM drinks d JOIN members m ON m.id = d.member_id
     WHERE d.deleted_at IS NULL AND d.created_at >= ? AND d.created_at < ?
     GROUP BY d.member_id, d.category_id`
  )
    .bind(from, to)
    .all<{ memberId: number; memberName: string; memberDeleted: number; categoryId: number; n: number }>();
  const cats = await c.env.DB.prepare(
    "SELECT id, name, color, price FROM categories ORDER BY sort_order, id"
  ).all<{ id: number; name: string; color: string; price: number | null }>();

  const priceById = new Map(cats.results.map((cat) => [cat.id, cat.price]));
  const byMember = new Map<number, { memberName: string; memberDeleted: boolean; counts: Record<number, number> }>();
  for (const row of counts.results) {
    const rec = byMember.get(row.memberId) ?? {
      memberName: row.memberName,
      memberDeleted: !!row.memberDeleted,
      counts: {},
    };
    rec.counts[row.categoryId] = row.n;
    byMember.set(row.memberId, rec);
  }
  const usedCatIds = new Set(counts.results.map((r) => r.categoryId));
  const rows = [...byMember.entries()]
    .map(([memberId, rec]) => {
      let total = 0;
      let amountCents = 0;
      for (const [catId, n] of Object.entries(rec.counts)) {
        total += n;
        const price = priceById.get(Number(catId));
        if (typeof price === "number") amountCents += n * price;
      }
      return { memberId, ...rec, total, amountCents };
    })
    .sort((a, b) => a.memberName.localeCompare(b.memberName, "de"));

  return c.json({
    categories: cats.results.filter((cat) => usedCatIds.has(cat.id)),
    rows,
  });
});

// ---------- Admin: Audit & Export ----------

app.get("/admin/audit", requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.id, a.actor_id AS actorId, m.name AS actorName, a.action, a.details, a.created_at AS createdAt
     FROM audit_log a LEFT JOIN members m ON m.id = a.actor_id
     ORDER BY a.created_at DESC LIMIT 300`
  ).all();
  return c.json(rows.results);
});

app.get("/admin/export.csv", requireAdmin, async (c) => {
  const { from, to } = parseRange(c);
  const rows = await c.env.DB.prepare(
    `${DRINK_SELECT} AND d.created_at >= ? AND d.created_at < ? ORDER BY d.created_at`
  )
    .bind(from, to)
    .all<{ memberName: string; categoryName: string; note: string | null; source: string; createdAt: number }>();

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["Datum;Uhrzeit;Mitglied;Kategorie;Notiz;Quelle"];
  for (const r of rows.results) {
    lines.push(
      [
        berlinDate(r.createdAt),
        berlinTime(r.createdAt),
        esc(r.memberName),
        esc(r.categoryName),
        esc(r.note ?? ""),
        r.source,
      ].join(";")
    );
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="strichliste_${berlinDate(from)}_${berlinDate(to)}.csv"`,
    },
  });
});

// ---------- Admin: Einstellungen (Logo, Clubname) ----------

app.put("/admin/settings", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const { clubName, logo, signupCode } = await c.req.json<{
    clubName?: string;
    logo?: string | null;
    signupCode?: string | null;
  }>();
  if (typeof logo === "string" && logo.length > 400_000) {
    return err(c, 400, "Logo zu groß (max. ~300 KB)");
  }
  const upsert = c.env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const batch: D1PreparedStatement[] = [];
  if (typeof clubName === "string" && clubName.trim()) batch.push(upsert.bind("clubName", clubName.trim()));
  if (typeof logo === "string") batch.push(upsert.bind("logo", logo));
  if (logo === null) batch.push(c.env.DB.prepare("DELETE FROM settings WHERE key = 'logo'"));
  if (typeof signupCode === "string" && signupCode.trim()) batch.push(upsert.bind("signupCode", signupCode.trim()));
  if (signupCode === null) batch.push(c.env.DB.prepare("DELETE FROM settings WHERE key = 'signupCode'"));
  if (batch.length) await c.env.DB.batch(batch);
  await audit(c.env.DB, auth.sub, "einstellungen_geaendert", {
    clubName,
    logoGeaendert: logo !== undefined,
    clubCodeGeaendert: signupCode !== undefined,
  });
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ error: "Nicht gefunden" }, 404));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    // Alles andere (SPA-Routen, Assets) wird vom Asset-Handling beantwortet;
    // not_found_handling=single-page-application liefert dabei die index.html.
    return env.ASSETS.fetch(request);
  },
};

# Getränke-Club – Entwickler-Handbuch

Digitale Getränke-Strichliste für einen Jugendclub (~40 Mitglieder, Rollen: Mitglied
und Vorstand). Dieses Dokument ist die vollständige technische Referenz für spätere
Änderungen durch Menschen oder LLMs. Anforderungs-Ursprung: `plan.md`.
Kurzfassung & Deployment-Anleitung: `README.md`.

---

## 1. Architektur

### 1.1 Überblick

**Ein einziges Cloudflare-Worker-Projekt** liefert Frontend und API aus:

```
Browser (PWA)
   │  /api/*            → Hono-Router im Worker (worker/index.ts)
   │  alles andere      → Workers Static Assets (dist/client)
   ▼                       not_found_handling: single-page-application
Cloudflare Worker ──── D1 (SQLite) Binding "DB"
```

- **Frontend**: React 19 + Vite 6 SPA (TypeScript), Tailwind CSS v4, React Router 7,
  Recharts (Admin-Charts), `vite-plugin-pwa` (Workbox-Service-Worker).
- **Backend**: Hono 4 im Worker. Der `fetch`-Export in `worker/index.ts` routet:
  Pfad beginnt mit `/api/` → Hono-App, sonst → `env.ASSETS.fetch(request)`
  (liefert dank SPA-Fallback die `index.html` für Client-Routen wie `/admin`).
- **Datenbank**: Cloudflare D1, Migrationen in `migrations/` (über
  `wrangler d1 migrations apply` eingespielt, lokal wie remote).
- **Dev-Setup**: `@cloudflare/vite-plugin` lässt `vite dev`/`vite preview` den
  Worker inkl. lokalem D1 (Miniflare, Persistenz unter `.wrangler/state/v3/d1/`)
  mitlaufen — ein einziger Dev-Server, keine zwei Prozesse.

### 1.2 Bewusste Entscheidungen (nicht ohne Rücksprache ändern!)

| Entscheidung | Begründung |
|---|---|
| React SPA + Hono statt Next.js | Mit dem Nutzer abgestimmt. PWA/Offline und Kiosk-Tablet sind so deutlich einfacher; Deployment trivialer. |
| 4-stellige PIN für **alle**, auch Vorstand | Nutzer-Entscheidung („gleiche PIN für alle"). Schutz über Rate-Limiting statt Passwort-Komplexität. |
| Initialen-Avatare statt Fotos | Kein R2-Storage nötig, datenschutzfreundlich. Fotos = bewusst verschobenes Feature. |
| Selbst-Registrierung unter `/signup` offen (kein Invite-Code) | Nutzer-Entscheidung; club-interne App, URL wird nur intern geteilt. Rolle ist serverseitig fest `mitglied`; Vorstand sieht Registrierungen im Audit-Log und kann Konten deaktivieren. |
| Tresen bucht **nicht** offline | PIN-Prüfung braucht den Server; PINs in einer lokalen Queue zu speichern wäre unsicher. Nur die eingeloggte Mitglieder-App puffert offline. |
| SHA-256+Salt statt PBKDF2/bcrypt für PINs | Bei 10.000 möglichen PINs bringt Key-Stretching keinen echten Schutz, kostet aber Workers-CPU (Free-Tier-Limit). Wirksamer Schutz: Lockout (s. §4). |
| Soft-Delete für Buchungen | `deleted_at` statt DELETE. Grundlage für lückenloses Getränke-Log und Audit. |
| Mitglieder/Kategorien deaktivieren statt löschen | Historische Striche dürfen nie verwaisen. |
| Keine Geldbeträge | Reine Mengenzählung, so in plan.md gefordert. |

### 1.3 Verzeichnisstruktur

```
plan.md                  Ursprüngliche Anforderungen (nicht löschen)
docs.md                  Dieses Handbuch
README.md                Kurzanleitung Setup/Deployment
wrangler.jsonc           Worker-Config: D1-Binding "DB" (echte database_id), ASSETS-Binding
.dev.vars                AUTH_SECRET fuer lokale Entwicklung (gitignored, NICHT deployen)
vite.config.ts           react() + tailwindcss() + cloudflare() + VitePWA()
tsconfig.json            Ein gemeinsames tsconfig für src/, worker/, shared/
migrations/0001_init.sql Schema + Seed der 5 Standard-Kategorien
shared/types.ts          API-Typen, von Worker UND Frontend importiert
worker/
  index.ts               Alle API-Routen, Middleware, CSV-Export, fetch-Export
  auth.ts                hashPin, randomHex, signToken, verifyToken
  time.ts                berlinDate/Time/Hour/Weekday (Intl, Europe/Berlin)
src/
  main.tsx               BrowserRouter + AuthProvider + startQueueSync()
  App.tsx                Routen-Definition + Auth-/Admin-Guards
  index.css              @theme-Tokens, Hintergrund-Atmosphäre, Keyframes
  lib/api.ts             fetch-Wrapper → ApiError | NetworkError
  lib/auth.tsx           AuthContext (Token + Member in localStorage)
  lib/offline.ts         Offline-Queue + idempotenter Sync
  lib/format.ts          formatTime/Day/DateTime, dayKey, rangeFor, initials
  components/            Avatar, PinPad, Tally, RangeFilter
  pages/                 Login, Setup, Signup, MemberShell, Dashboard, History, Profile, Tresen
  pages/admin/           AdminLayout, Strichliste, GetraenkeLog, Stats,
                         Mitglieder, Kategorien, Audit, Einstellungen
public/                  icon.svg, icon-maskable.svg (PWA-Icons)
```

---

## 2. Datenmodell (D1/SQLite)

Alle Zeitstempel: **Unix-Epoch in Millisekunden (INTEGER, UTC)**. Booleans: INTEGER 0/1.

### members
| Spalte | Typ | Bedeutung |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Anzeigename |
| pin_hash, pin_salt | TEXT | `SHA-256(salt + ":" + pin)`, Salt 16 zufällige Bytes hex |
| role | TEXT | `'mitglied'` \| `'vorstand'` (CHECK) |
| color | TEXT | Hex-Farbe für Initialen-Avatar |
| active | INTEGER | 0 = deaktiviert (taucht nicht mehr in Login/Tresen auf) |
| failed_attempts | INTEGER | Fehlversuchszähler fürs Rate-Limiting |
| locked_until | INTEGER NULL | Epoch-ms; Konto gesperrt bis dahin |
| created_at | INTEGER | |
| deleted_at | INTEGER NULL | Migration 0002: **finales Löschen** als Tombstone. Gesetzt = Konto existiert nicht mehr (Login/Listen filtern `deleted_at IS NULL`), aber Buchungs-JOINs liefern weiter den Namen |

### categories
| Spalte | Typ | Bedeutung |
|---|---|---|
| name, color | TEXT | Anzeige |
| sort_order | INTEGER | Reihenfolge in allen Buchungs-UIs |
| free_text | INTEGER | 1 = beim Buchen wird ein Freitext abgefragt (z. B. „Sonstiges") |
| active | INTEGER | 0 = ausgeblendet, historische Striche bleiben |
| price | INTEGER NULL | Migration 0002: Preis in **Cent** für die Abrechnung (NULL = ohne Preis). Nur in Admin-Antworten enthalten — Mitglieder sehen nie Beträge |

Seed (Migration 0001): Bier/Spezi/Radler, Mische, Cola/Sprite/Fanta, Shot, Sonstiges (free_text=1).

### drinks — die Striche
| Spalte | Typ | Bedeutung |
|---|---|---|
| member_id, category_id | INTEGER FK | |
| note | TEXT NULL | Freitext (nur bei free_text-Kategorien bzw. Admin-Nachtrag) |
| source | TEXT | `'mitglied'` (eigene App) \| `'tresen'` \| `'admin'` (Nachtrag) |
| client_id | TEXT UNIQUE NULL | UUID vom Client; macht Offline-Sync idempotent |
| undo_token | TEXT NULL | Nur Tresen-Buchungen; berechtigt zum Undo ohne PIN |
| created_at | INTEGER | Buchungszeitpunkt (bei Offline-Sync: tatsächlicher Tap-Zeitpunkt) |
| deleted_at | INTEGER NULL | **Soft-Delete**: gesetzt bei Undo/Admin-Löschung |
| deleted_by | INTEGER NULL | members.id; bei Undo = das Mitglied selbst, bei Admin-Löschung = der Admin |

Indizes: `(created_at)` und `(member_id, created_at)`.
**Alle Zähl-/Anzeige-Queries filtern `deleted_at IS NULL`** — Ausnahme: `/admin/log` (zeigt bewusst alles).

### audit_log
`actor_id (NULL-bar), action (TEXT), details (JSON-TEXT), created_at`.
Aktionen: `setup`, `mitglied_angelegt`, `mitglied_geaendert`, `kategorie_angelegt`,
`kategorie_geaendert`, `strich_nachgetragen`, `strich_geloescht`, `einstellungen_geaendert`.
Labels dafür: `ACTION_LABELS` in `src/pages/admin/Audit.tsx` — **bei neuen Aktionen dort ergänzen**.

### settings
Key-Value: `clubName` (TEXT), `logo` (Data-URL, Upload-Limit clientseitig 300 KB,
serverseitig 400.000 Zeichen), `signupCode` (optionaler Club-Code für die
Registrierung; `GET /settings` liefert nur das Flag `signupCodeRequired`, nie den Code).

### Zeitzonen-Konzept
SQLite/D1 kennt keine Zeitzonen-Datenbank. Tag-/Stunden-Zuordnung (Heatmap,
Tagesgruppen, CSV, Monatsbeginn) passiert deshalb **im Worker in JS** über
`Intl.DateTimeFormat` mit `timeZone: "Europe/Berlin"` (`worker/time.ts`) —
korrekt inkl. Sommer-/Winterzeit. Die Datenmengen (~40 Mitglieder) sind klein genug,
um Rohzeilen zu laden und in JS zu aggregieren. Im Frontend wird mit lokaler
Gerätezeit formatiert (`src/lib/format.ts`) — Geräte stehen in Deutschland.

---

## 3. API-Referenz

Alle Routen unter `/api`. Request/Response: JSON. Fehlerformat immer
`{ "error": "menschenlesbare Meldung (deutsch)" }` mit passendem HTTP-Status
(400/401/403/404/409/423). 423 = Konto wegen Fehlversuchen gesperrt.

Auth: Header `Authorization: Bearer <token>`; alternativ Query `?token=` (nur für
Download-Links wie CSV nötig). Middleware: `requireAuth` (gültiges Token),
`requireAdmin` (zusätzlich `role === 'vorstand'`).

### Öffentlich (kein Token)
| Route | Zweck |
|---|---|
| `GET /setup/status` | `{needsSetup: boolean}` — true wenn 0 Mitglieder |
| `POST /setup` `{name, pin}` | Legt erstes Vorstandskonto an (nur bei leerer members-Tabelle, sonst 409). Antwort: `{token, member}` |
| `POST /signup` `{name, pin, color?, code?}` | Selbst-Registrierung. Rolle ist **serverseitig fest `mitglied`**. Guards: optionaler Club-Code (Settings-Key `signupCode`, Vergleich case-insensitive, 403 bei Fehler), erst nach Ersteinrichtung möglich (409), Name unique unter aktiven Mitgliedern case-insensitive (409), max. 40 Zeichen. Audit `mitglied_registriert`, Antwort wie Login (Auto-Login) |
| `GET /members/public` | Aktive Mitglieder `{id, name, color, role}[]` — für Login-Picker & Tresen-Kacheln |
| `GET /categories` | **Nur aktive** Kategorien, sortiert nach sort_order |
| `GET /settings` | `{clubName, logo}` — Branding für Login/Tresen |
| `POST /auth/login` `{memberId, pin, remember?}` | `{token, member}`. TTL: 12 h, mit remember 90 Tage |
| `POST /tresen/book` `{memberId, pin, categoryId, note?}` | Prüft PIN (inkl. Lockout), bucht mit source='tresen'. Antwort: `{drinkId, undoToken}` |
| `POST /tresen/undo` `{drinkId, undoToken}` | Soft-Delete ≤ 60 s nach Buchung; deleted_by = Mitglied selbst. Vom UI derzeit nicht genutzt (s. §6.2) |

### Mit Token (Mitglied)
| Route | Zweck |
|---|---|
| `GET /auth/me` | `{member}` — validiert Token, 401 wenn Konto deaktiviert |
| `POST /auth/pin` `{currentPin, newPin}` | Eigene PIN ändern (newPin: 4 Ziffern) |
| `POST /drinks` `{categoryId, note?, clientId?, createdAt?}` | Strich buchen, source='mitglied'. `clientId` (UUID) → bei Duplikat `{id, duplicate:true}` statt Neuanlage. `createdAt` max. 7 Tage rückwirkend (sonst „jetzt") — für Offline-Sync |
| `DELETE /drinks/:id` | Undo: nur eigene Buchung, nur ≤ 60 s (`UNDO_WINDOW_MS`), sonst 403 |
| `GET /me/summary` | `{today: Drink[], monthCounts: {categoryId, count}[]}` — „heute"/„Monat" in Berlin-Zeit |
| `GET /me/history` | Eigene Buchungen, neueste zuerst, LIMIT 300 |
| `GET /me/wrapped?year=` | „Club Wrapped": persönlicher Jahresrückblick (Total, Kategorien, aktive Tage, stärkster Tag, Lieblings-Wochentag, Nachteulen-Buchung, Club-Gesamtzahl + beliebteste Kategorie). **Bewusst keine Rankings/Vergleiche zwischen Mitgliedern** (Jugendschutz). Jahresgrenzen in Berlin-Zeit |

### Nur Vorstand (`/admin/...`)
| Route | Zweck |
|---|---|
| `GET /admin/members` | Alle Mitglieder inkl. deaktivierter |
| `POST /admin/members` `{name, pin, role?, color?}` | Anlegen (Audit) |
| `PATCH /admin/members/:id` `{name?, role?, active?, color?, pin?}` | Ändern; `pin` = PIN-Reset (setzt auch failed_attempts/locked_until zurück). Eigenes Konto kann nicht deaktiviert/herabgestuft werden (400). Audit |
| `DELETE /admin/members/:id` | **Finales Löschen** = Tombstone (`members.deleted_at`, active=0, PIN unbrauchbar). Konto verschwindet aus Login/Tresen/Verwaltung/Übersichten; Buchungen bleiben im Getränke-Log, in Stats, CSV und Abrechnung (Name + „(gelöscht)"-Marker). Eigenes Konto: 400. Audit `mitglied_geloescht`. Nicht umkehrbar (UI bietet es nur für deaktivierte Mitglieder an) |
| `GET /admin/categories` | Alle Kategorien inkl. inaktiver |
| `POST /admin/categories` / `PATCH /admin/categories/:id` | Pflege inkl. sort_order, free_text, active (Audit) |
| `GET /admin/overview?from&to` | Matrix: pro Mitglied `{counts: {catId: n}, total}`. Inaktive nur, wenn sie Striche im Zeitraum haben |
| `GET /admin/members/:id/drinks?from&to` | Drilldown: Einzelbuchungen eines Mitglieds, LIMIT 500 |
| `POST /admin/drinks` `{memberId, categoryId, note?, createdAt?}` | Strich nachtragen, source='admin' (Audit) |
| `DELETE /admin/drinks/:id` | Stornieren = Soft-Delete mit deleted_by=Admin (Audit inkl. Original-Zeit). Jederzeit möglich, kein Zeitfenster |
| `POST /admin/drinks/:id/restore` | Stornierung aufheben: deleted_at/deleted_by → NULL (Audit `strich_wiederhergestellt`). 404 wenn nicht storniert |
| `GET /admin/log?from&to` | **Getränke-Log**: ALLE Buchungen inkl. stornierter (`deletedAt`, `deletedByName`) und von gelöschten Mitgliedern (`memberDeleted`), LIMIT 1000 |
| `GET /admin/billing?from&to` | **Abrechnung**: pro Mitglied Striche je Kategorie + `amountCents` (Striche × `categories.price`). Enthält auch deaktivierte/gelöschte Mitglieder mit Buchungen im Zeitraum (offene Rechnungen). Kategorien ohne Preis zählen nur in der Strichsumme |
| `GET /admin/stats?from&to` | `{perDay: [{date:"YYYY-MM-DD", counts}], topDrinkers (Top 15), heatmap[7][24] (Mo–So × 0–23 Berlin-Zeit), total}` |
| `GET /admin/audit` | Audit-Einträge, LIMIT 300 |
| `GET /admin/export.csv?from&to&token=` | CSV: `Datum;Uhrzeit;Mitglied;Kategorie;Notiz;Quelle`, Semikolon-getrennt, CRLF, UTF-8-BOM (Excel-kompatibel), Berlin-Zeit |
| `PUT /admin/settings` `{clubName?, logo?}` | logo: Data-URL-String setzt, `null` löscht (Audit) |

Zeitraum-Parameter `from`/`to`: Epoch-ms, **`to` exklusiv**. Fehlend → 0 bzw. „jetzt+1min".

---

## 4. Auth & Sicherheit im Detail

1. **PIN-Speicherung**: `pin_hash = SHA-256(pin_salt + ":" + pin)` (hex). Kein
   Pepper, kein Stretching — siehe §1.2. Implementierung: `worker/auth.ts`.
2. **Schwache PINs verboten** (`validateNewPin()`/`isWeakPin()` in `worker/index.ts`):
   abgelehnt werden gleiche Ziffern (1111), Doppelmuster (1212) und auf-/absteigende
   Folgen (1234, 4321, 0123). Gilt serverseitig an ALLEN Stellen, die eine PIN
   setzen (Setup, Signup, PIN ändern, Admin-Anlage, Admin-PIN-Reset); bestehende
   PINs sind nicht betroffen.
3. **Rate-Limiting** (`checkPin()` in `worker/index.ts`): Jeder Fehlversuch
   inkrementiert `failed_attempts`. Beim 5. Versuch (`MAX_FAILED_ATTEMPTS`) wird
   `locked_until = now + 5 min` gesetzt und der Zähler zurückgesetzt. Solange
   gesperrt → HTTP 423 mit Restminuten. Erfolgreicher Login setzt beides zurück.
   Gilt für Login, Tresen-Buchung und PIN-Änderung gleichermaßen.
3. **Token**: Eigenes Format `base64url(JSON{sub, role, exp}) + "." + base64url(HMAC-SHA-256)`
   — bewusst kein JWT-Standard (kein Header/Alg-Verwirrspiel nötig). Verifikation
   prüft Signatur + exp. **Rolle steckt im Token**: Wird ein Mitglied herabgestuft,
   wirkt das erst nach Token-Ablauf bzw. Re-Login (akzeptierter Trade-off; bei Bedarf
   in `requireAdmin` die Rolle live aus der DB lesen).
4. **AUTH_SECRET**: In Produktion ein Cloudflare-Secret (`wrangler secret put
   AUTH_SECRET`, gesetzt am 10.06.2026, 48 Zufallsbytes). Lokal kommt der Wert aus
   `.dev.vars` (gitignored). **NIEMALS als `var` in `wrangler.jsonc` eintragen** —
   eine gleichnamige Var überschreibt beim Deploy das Secret mit Klartext (ist
   einmal passiert und wurde repariert; s. §8 Stolpersteine). Achtung: Ein
   Secret-Wechsel invalidiert alle ausgegebenen Tokens → alle müssen sich neu
   einloggen (PINs sind nicht betroffen, die Hashes nutzen kein Secret).
5. **Öffentliche Endpunkte** (Mitgliederliste, Kategorien, Settings): bewusster
   Trade-off für eine club-interne App — Tresen und Login-Picker brauchen die Daten
   ohne Session. Es sind nur Namen/Farben/Rollen exponiert, keine PINs/Statistiken.
6. **Selbstschutz**: Ein Vorstand kann das eigene Konto nicht deaktivieren oder
   herabstufen (sonst Aussperr-Gefahr beim letzten Admin).

---

## 5. Offline-Konzept (PWA)

- **Service Worker** (`vite-plugin-pwa`, generateSW): precacht die App-Shell,
  `navigateFallback: /index.html` mit Denylist `/api/*` (API-Calls laufen NIE über
  den SW-Fallback). Google Fonts: StaleWhileRevalidate/CacheFirst. `registerType:
  autoUpdate` — neue Deploys aktualisieren sich selbst.
- **Buchungs-Queue** (`src/lib/offline.ts`): `bookDrink()` versucht den POST;
  wirft `api()` einen `NetworkError` (fetch-Exception = offline/Server weg), wird
  die Buchung als `QueuedBooking {clientId, categoryId, note, createdAt}` in
  localStorage (`gc_queue`) gelegt. UI bleibt optimistisch (+1 bleibt stehen),
  MemberShell zeigt einen Banner mit Anzahl wartender Buchungen.
- **Sync** (`flushQueue()`): beim `online`-Event, alle 30 s (wenn Queue nicht leer)
  und beim App-Start. Sequenziell; bei erneutem `NetworkError` Abbruch (immer noch
  offline). Bei **fachlichem** Fehler (z. B. Kategorie inzwischen deaktiviert) wird
  der Eintrag verworfen, damit er die Queue nicht ewig blockiert.
- **Idempotenz**: Server prüft `client_id` (UNIQUE) vor dem INSERT — doppeltes
  Nachreichen erzeugt nie doppelte Striche (`{duplicate: true}`).
- **Undo offline**: Noch nicht synchronisierte Buchung → einfach Queue-Eintrag
  entfernen (`removeQueued(clientId)`), kein Server-Call nötig.
- **Auth offline**: `AuthProvider` hält Member-Daten im localStorage-Cache; schlägt
  `GET /auth/me` mit `NetworkError` fehl, bleibt die Session bestehen (App nutzbar),
  nur bei echtem 401 wird ausgeloggt.

---

## 6. Frontend-Verhalten im Detail

### 6.1 Dashboard (Mitglieder-Startseite)
- Kacheln = aktive Kategorien, dynamisches 2-Spalten-Grid (5 Kategorien → 2×3).
- Tap: optimistisches `bump(+1)` → `bookDrink()` → Undo-Snackbar (60 s =
  `UNDO_WINDOW_MS`, gleich lang wie das Server-Fenster). Fehler → Rollback + Meldung.
- free_text-Kategorie → Modal mit Textfeld, gebucht wird mit `note`.
- **Kachel-Striche zeigen NUR den heutigen Tag.** Tageswechsel-Reset: beim Laden
  wird der Tag gemerkt (`loadedDay`-Ref); ein 60-s-Interval und ein
  `visibilitychange`-Listener laden die Summary neu, sobald `dayKey()` sich ändert
  (wichtig für PWAs, die über Mitternacht offen bleiben).
- „Dein Monat": **arabische Zahlen** (Nutzerwunsch), Tally-Striche nur auf den
  Tages-Kacheln.
- **Animations-Falle**: `animate-rise` und `tile-flash` NIE auf demselben Element —
  beide setzen `animation`; wird `tile-flash` entfernt, startet sonst die
  Einblend-Animation neu (Kachel „blinkt weg"). Deshalb haben die Kacheln keine
  Einblend-Animation.

### 6.2 Tresen (`/tresen`, ohne Login)
State-Machine in `Tresen.tsx`: `members → pin → categories → (note) → done`.
- PIN wird sofort beim Eingeben validiert (via `POST /auth/login`, Token verworfen,
  PIN im State behalten) — falsche PIN fällt also VOR der Kategorie-Wahl auf.
- Buchung über `/tresen/book` (Server prüft PIN erneut — harmlos).
- `done`-Screen: **1 s** (`CONFIRM_MS`, Nutzerwunsch), dann automatischer Reset zur
  Mitgliederliste („Logout"). Kein Undo-Button am Tresen — Fehlbuchungen korrigiert
  der Vorstand (Strichliste-Drilldown). Der API-Endpoint `/tresen/undo` existiert
  weiter (Server liefert `undoToken`), wird vom UI aber nicht mehr genutzt.
- **Inaktivität**: 15 s (`INACTIVITY_MS`), zurückgesetzt durch `pointerdown` auf dem
  Container; Timeout → harter Reset zur Mitgliederliste. Auf der Mitgliederliste
  selbst läuft kein Timer.
- Mitglieder/Kategorien werden alle 5 min neu geladen (Kiosk läuft dauerhaft).
- Offline: Banner, Buchungen nicht möglich (siehe §1.2).

### 6.3 Admin
- `AdminLayout`: Sidebar (auf schmalen Screens nur Anfangsbuchstaben). Navigation:
  Strichliste, Getränke-Log, Abrechnung, Statistiken, Mitglieder, Kategorien,
  Einstellungen. Das **Audit-Log ist bewusst NICHT verlinkt** (Nutzerwunsch) —
  Route existiert weiter, nur direkt über `/admin/audit` erreichbar.
  **Neue Admin-Seite = Eintrag in `nav[]` + Lazy-Route in `App.tsx`** (alle Admin-Seiten + Wrapped sind `React.lazy`-Chunks; das
  Haupt-Bundle der Mitglieder-App bleibt dadurch bei ~265 KB statt ~670 KB —
  Recharts steckt im Stats-Chunk).
- **Abrechnung**: Jahres-Auswahl (laufendes Jahr − 3), Matrix Mitglied×Kategorie
  mit Stückpreisen im Header, €-Summe pro Mitglied + Gesamt, Drucken-Button
  (`window.print`). Gelöschte Mitglieder erscheinen mit „(gelöscht)", solange sie
  Buchungen im Jahr haben. Hinweis-Banner, wenn keine Preise gepflegt sind.
- `RangeFilter` (geteilte Komponente): Presets Heute/Woche (ab Montag)/Monat +
  Custom-Datumsbereich (`to` wird +1 Tag exklusiv gerechnet). Liefert Epoch-ms.
- **Strichliste**: Matrix Mitglied×Kategorie (Spalten = aktive Kategorien), Klick
  auf Zeile → Drilldown (Einzelbuchungen, löschen mit confirm(), Nachtrag-Formular
  mit optionalem datetime-local). Sticky Header/Footer. CSV-Export-Button nimmt den
  aktuellen Zeitraum.
- **Getränke-Log**: lückenlose Liste ALLER Buchungen inkl. stornierter
  (durchgestrichen + rotes Badge „storniert · Zeitpunkt · von Wem"). Filter:
  Zeitraum, Mitgliedsname (Substring), Checkbox „Stornierte zeigen". Quelle-Labels:
  App/Tresen/Admin. Admins können hier jeden Strich **stornieren** (rotes ✕-Icon
  am Zeilenende mit confirm-Dialog, ohne Zeitfenster — anders als das 60-s-Limit
  der Mitglieder) und Stornierungen per „wiederherstellen"-Link **rückgängig
  machen** — beides mit Audit-Eintrag (`strich_geloescht` /
  `strich_wiederhergestellt`).
- **Statistiken**: KPI-Karten (Gesamt, Ø/Tag über die Zeitraumlänge, stärkster Tag,
  durstigste Person) · gestapeltes Tages-Balkendiagramm · Donut „Nach Kategorie" mit
  Prozent-Liste · Top-15 mit Medaillen · Heatmap Wochentag×Stunde mit Zeilensummen.
  Leerzustand wenn total=0.
- **Mitglieder**: Anlegen (Name, PIN, Rolle, Avatar-Farbe), Rolle ändern,
  aktivieren/deaktivieren, PIN-Reset (prompt, 4 Ziffern). **Endgültig löschen**
  (🗑) erscheint nur bei deaktivierten Mitgliedern (bewusste Zwei-Stufen-Hürde)
  und erklärt im confirm, dass Buchungen erhalten bleiben.
- **Wrapped** (`/wrapped`, Mitglieder-Feature, verlinkt im Profil): Jahresrückblick
  als gestaffelte Karten (eigene Striche, Getränk des Jahres, aktive Tage,
  stärkster Tag, Lieblings-Wochentag, Nachteulen-Moment, Club-Gesamt). Jahr
  umschaltbar (aktuell/Vorjahr). Eigener Lazy-Chunk, eigener Leerzustand.
  **Nur im Dezember sichtbar** (Nutzerwunsch, Überraschungseffekt): Profil-Link
  erscheint nur bei `getMonth() === 11`, die Seite zeigt sonst einen 🎁-Teaser.
  Reine Client-Gating-Logik — der API-Endpoint bleibt ganzjährig nutzbar.
- **Kategorien**: Inline-Edit (Name onBlur, Farbe color-input, Textfeld-Checkbox,
  ▲▼ tauscht sort_order beider Nachbarn), Anlegen, aktivieren/deaktivieren.
- **Einstellungen**: Clubname, Logo (FileReader → Data-URL, max 300 KB, PNG/JPG/SVG/WebP).

### 6.4 Konventionen
- API-Aufrufe: immer über `api()` aus `lib/api.ts`; Fehlerbehandlung unterscheidet
  `ApiError` (Server-Meldung anzeigen) vs. `NetworkError` (offline-Verhalten).
- UI-Sprache: durchgehend Deutsch, du-Form, lockerer Ton („Moin", „Prost! 🍻").
- Shared Types: API-Formen IMMER in `shared/types.ts` pflegen, nie duplizieren.
- Keys in localStorage: `gc_token`, `gc_member`, `gc_queue`.

---

## 7. Design-System

Ästhetik: **„Kneipen-Tafel bei Nacht"** — warmes Anthrazit, Bernstein-Glow,
Körnungs-Overlay (SVG-Noise in `body::before`), zwei dezente radiale Lichtkegel.

### Tokens (`src/index.css`, Tailwind v4 `@theme` — es gibt KEIN tailwind.config!)
| Token | Wert | Verwendung |
|---|---|---|
| `--color-bg` | `#15130f` | Seitenhintergrund |
| `--color-surface` | `#1e1b16` | Karten, Tabellen |
| `--color-raised` | `#282319` | Erhöhte Elemente (Modals, Inputs in Karten, Numpad) |
| `--color-line` | `#383023` | Rahmen/Trennlinien |
| `--color-ink` | `#f2ede4` | Text |
| `--color-muted` | `#9d9180` | Sekundärtext |
| `--color-amber` | `#f5a524` | Akzent/Primäraktionen |
| `--color-danger` / `--color-ok` | `#f87171` / `#34d399` | Fehler / Erfolg |

Nutzung als Tailwind-Klassen: `bg-surface`, `text-muted`, `border-line`, `bg-amber` usw.

### Typografie (Google Fonts, eingebunden in `index.html`)
- **Bricolage Grotesque** → `font-display`: Headlines, Buttons, Zahlen-Highlights
- **Schibsted Grotesk** → `font-sans` (Default): Fließtext
- **JetBrains Mono** → `font-mono`: Uhrzeiten, Zähler, PIN-Eingaben

PIN-Inputs: `font-mono tracking-[0.5em]` für die Ziffern, aber
`placeholder:font-sans placeholder:tracking-normal` — sonst sieht der Platzhalter
gesperrt/„blocksatzartig" aus.

### Markenzeichen & Animationen
- `Tally.tsx`: Zähler als echte Strichlisten-Striche (pro 5er-Gruppe 4 senkrechte
  SVG-Linien + 1 Diagonale), letzte Gruppe animiert (`.tally-stroke`). Wird auf den
  Tages-Kacheln verwendet (Monatsliste: Zahlen, s. §6.1).
- Keyframes in `index.css`: `pop-in` (`.animate-pop`, Modals/Screens), `rise`
  (`.animate-rise`, Listen-Einblendung), `tile-flash` (Glow-Ring beim Buchen,
  Farbe via CSS-Var `--flash-color`).

---

## 8. Entwicklung, Build, Deployment

```bash
npm run dev                # Vite-Dev inkl. Worker + lokalem D1 (Hot Reload)
npm run check              # tsc --noEmit (strict)
npm run build              # dist/client (SPA+SW) + dist/getraenke_club (Worker)
npm run preview            # Production-Build lokal testen (inkl. Worker/D1)
npm run db:migrate:local   # Migrationen → .wrangler/state (lokales D1)
npm run db:migrate:remote  # Migrationen → echtes D1
npm run deploy             # build + wrangler deploy -c dist/getraenke_club/wrangler.json
```

**Stolpersteine (alle schon einmal real passiert bzw. relevant):**
- **Wrangler 4 braucht Node ≥ 22.** Auf diesem Mac liegt ein altes Node 20 unter
  `/usr/local/bin/node` (pkg-Install); Homebrew-Node 26 ist installiert →
  `export PATH=/opt/homebrew/opt/node/bin:$PATH` vor Wrangler-/Build-Befehle.
- Der Worker-Build-Ordner heißt `dist/getraenke_club` — **Unterstrich**, vom
  Cloudflare-Vite-Plugin aus dem Worker-Namen abgeleitet. Deploy IMMER über die
  dort generierte `wrangler.json` (macht das npm-Script).
- **AUTH_SECRET-Falle**: Eine `var` namens AUTH_SECRET in `wrangler.jsonc`
  überschreibt beim Deploy das gleichnamige Cloudflare-Secret durch den
  Klartext-Wert — und blockiert umgekehrt `wrangler secret put` („Binding name
  already in use"). Reihenfolge zur Reparatur: Var aus der Config entfernen →
  deployen → dann `secret put`. Lokal stattdessen `.dev.vars` verwenden.
- **Lokale D1 hängt an der `database_id`**: Miniflare benennt die lokale
  SQLite-Datei nach einem Hash der ID. Ändert sich die `database_id` in
  `wrangler.jsonc` (z. B. Platzhalter → echte ID), entsteht lokal eine NEUE,
  leere Datenbank. Alte Daten retten: alte Datei in
  `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` finden, dort
  `PRAGMA wal_checkpoint(TRUNCATE);` ausführen, Datei über die neue kopieren
  (Server vorher stoppen, `-shm`/`-wal` der neuen Datei löschen).
- Beim interaktiven `wrangler d1 create` bietet Wrangler an, die DB selbst in die
  Config einzutragen — das erzeugt einen ZWEITEN `d1_databases`-Eintrag mit
  falschem Binding-Namen (und ggf. `"remote": true`, was lokalen Dev auf die
  Prod-DB umbiegt!). Immer manuell die ID in den bestehenden `DB`-Eintrag
  übernehmen und den Auto-Eintrag löschen.
- Lokale D1-Daten liegen in `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`
  (direkt mit `sqlite3` inspizierbar — praktisch zum Debuggen und für Testdaten).
- Neue Migration: `migrations/0002_xxx.sql` anlegen, NIE 0001 nachträglich ändern.
  Immer beides ausführen: `db:migrate:local` UND `db:migrate:remote`.
- Hono + Middleware: `c.req.param("id")` ist als `string | undefined` typisiert,
  wenn Middleware als zweites Argument übergeben wird → `?? ""` davor.

**Smoke-Test nach Änderungen** (gegen `npm run preview`):
```bash
curl -s localhost:4173/api/setup/status
curl -s -X POST localhost:4173/api/tresen/book -H 'Content-Type: application/json' \
     -d '{"memberId":1,"pin":"____","categoryId":1}'
# + Login → POST /api/drinks mit clientId zweimal → zweites Mal duplicate:true
```

---

## 9. Bekannte Grenzen / Backlog

- **Kein Paging**: Audit (300), History (300), Drilldown (500), Log (1000) sind
  LIMIT-begrenzt; bei einem 40-Personen-Club reicht das lange.
- **Rollenwechsel** greift erst nach Token-Ablauf/Re-Login (§4.3).
- **Kategorie-Sortierung**: ▲▼ feuert zwei parallele PATCHes (theoretisches Race,
  praktisch unkritisch); sauberer wäre ein Batch-Endpoint.
- **Fotos für Mitglieder**: bewusst nicht gebaut; bräuchte R2-Bucket + Upload-UI +
  `<img>`-Fallback auf Initialen.
- **Kein Undo am Tresen** (Nutzerwunsch: 1 s Bestätigung, dann Reset). Fehlbuchungen
  korrigiert der Vorstand (Strichliste/Drilldown); `/tresen/undo` bleibt als
  API-Endpoint für eine evtl. spätere Wiedereinführung erhalten.
- D1-Free-Tier-Limits (Stand 2026: 5 GB, 5 Mio. Reads/Tag) sind für diesen
  Anwendungsfall um Größenordnungen ausreichend.
- **Fehlbuchungen am Tresen korrigieren**: Da es dort kein Undo mehr gibt, ist der
  vorgesehene Weg das Getränke-Log (✕-Button) oder der Strichlisten-Drilldown.

---

## 10. Produktions-Status, Repository & Historie

### Produktion (Stand 10.06.2026)
| Was | Wert |
|---|---|
| Live-URL | https://getraenke-club.timgruszczynski422.workers.dev |
| Worker-Name | `getraenke-club` (Cloudflare-Account von timgruszczynski422@gmail.com) |
| D1-Datenbank | `getraenke-club`, ID `a04af21a-eee9-4c0a-bc2b-86b8ee377ec5`, Region EEUR |
| Migrationen remote | `0001_init.sql`, `0002_billing_und_loeschen.sql` angewendet |
| Secrets | `AUTH_SECRET` als Cloudflare-Secret gesetzt (48 Zufallsbytes, base64url) |
| Ersteinrichtung | erledigt — Vorstandskonto „tim" existiert; needsSetup=false |
| Tresen-Tablet | `/tresen` öffnen und „Zum Startbildschirm hinzufügen" (Vollbild-PWA) |

Deployment-Workflow für Änderungen: Code ändern → `npx tsc --noEmit` →
`npm run deploy` (baut und deployt in einem Schritt). Bei Schema-Änderungen
vorher `npm run db:migrate:remote` (und lokal `db:migrate:local`).

### Git / GitHub
- Repo: **https://github.com/tgru-dev/getraenke-club** (remote `origin`, Branch `main`)
- Tag **`v1`** = die alte Next.js-Version (kompletter Stand vor dem Neuaufbau,
  Commit `ba4ea16`) — bewusst in der History behalten statt neues Repo
- Tag **`v2`** = der Neuaufbau (dieses Projekt), als EIN Commit auf die
  v1-History aufgesetzt (`decbf38`), dadurch ist `git diff v1 v2` möglich
- Nicht im Repo (`.gitignore`): `node_modules/`, `dist/`, `.wrangler/` (lokale DB!),
  `.dev.vars`, `.claude/`, Logs — es liegen KEINE Secrets auf GitHub
- Es gibt keine CI/CD: Deploy passiert manuell per `npm run deploy` vom Mac;
  GitHub ist reine Code-Ablage

### Änderungshistorie der v2 (alles am 10.06.2026)
1. **Grundausbau** nach `plan.md`: Mitglieder-PWA, Tresen, Admin, Offline, D1.
   Abweichungen vom Plan mit Nutzer abgestimmt (Stack, PIN-Modell, Avatare — §1.2).
2. **Feinschliff-Runde**: Animations-Bug der Kacheln gefixt (§6.1 Animations-Falle),
   Statistik-Seite ausgebaut (KPIs, Donut, Medaillen, Heatmap-Summen).
3. **Upgrades**: Tagesreset der Kachel-Striche (Mitternachts-Check), Monatsliste
   in Zahlen statt Tally, Getränke-Log-Seite + `/admin/log`-Endpoint,
   PIN-Placeholder-Typografie gefixt.
4. **Cloudflare-Deployment**: D1 angelegt, Migration remote, AUTH_SECRET-Vorfall
   repariert (§8 Stolpersteine), `.dev.vars` eingeführt.
5. **Tresen-Änderung**: Bestätigung 1 s statt 6 s, Undo-Button am Tresen entfernt.
6. **Selbst-Registrierung** `/signup` (+ Guard-Logik, Audit `mitglied_registriert`,
   Login-Link, geteilte `AVATAR_COLORS`).
7. **Storno/Restore im Getränke-Log** (+ `POST /admin/drinks/:id/restore`,
   Audit `strich_wiederhergestellt`), Storno-Button als ✕-Icon.
8. **GitHub-Push** als v2 (siehe oben).
9. **Feature-Paket** (Migration 0002): Jahresabrechnung mit Kategoriepreisen,
   Club-Code für die Registrierung, „Club Wrapped"-Jahresrückblick,
   Bundle-Splitting (Admin/Wrapped lazy), finales Mitglieder-Löschen mit
   Log-Erhalt (Tombstone `members.deleted_at`).

### Lokale Entwicklungsumgebung (dieser Mac)
- Lokale Test-DB enthält Spieldaten (Mitglieder „tim"/„Jimmy W", ~200 Buchungen,
  Zusatz-Kategorie „Wein Sekt") — unabhängig von Produktion.
- Die lokalen Test-PINs sind nur dem Nutzer bekannt; für API-Tests ggf. ein
  Wegwerf-Mitglied mit bekanntem Hash direkt per `sqlite3` einfügen und danach
  löschen (Muster: `SHA-256("<salt>:<pin>")` hex in `pin_hash`).
- Preview-Server für manuelle Tests: `npm run preview` (Port 4173).

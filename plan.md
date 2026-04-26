# Plan: Getränke-Strichliste Jugendclub

## 1. Zielsetzung

Ablösung der Papier-Strichliste durch eine Web-App, die

- von Mitgliedern mobil bedient wird (schnelles Anstreichen der eigenen Getränke),
- vom Vorstand am Desktop ausgewertet und verwaltet wird (Statistiken, Nutzerverwaltung),
- einen Barcode-Scanner enthält, der gegen die OpenGTIN-DB (`https://opengtindb.org/api.php`) auflöst und eingescannte Produkte automatisch einer der 4 Kategorien zuordnet.

### Erfolgskriterien

- Ein Mitglied kann in **≤ 3 Taps** ein Getränk anstreichen.
- Vorstand kann jederzeit nachvollziehen: **wer / wann / was** konsumiert hat.
- Reine Browser-App (keine native App nötig), läuft auf jedem Smartphone und Desktop.
- Offline-Nachsicht oder zumindest robustes Verhalten bei Funkloch im Clubraum.

---

## 2. Kategorien

| Kat | Inhalt                  | Anmerkung               |
| --- | ----------------------- | ----------------------- |
| 1   | Bier / Spezi / Radler   | alkoholisch             |
| 2   | Mische                  | Longdrinks / Mixgetränke |
| 3   | Cola / Sprite / Fanta   | alkoholfreie Softdrinks |
| 4   | Shot                    | hochprozentig           |

Kategorien sollen in der Datenbank konfigurierbar sein (nicht hartkodiert), damit der Vorstand sie später ändern/erweitern kann (Reihenfolge, Farbe, Anzeigename).

---

## 3. Nutzerrollen

| Rolle        | Rechte                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| **Mitglied** | eigene Getränke anstreichen, eigene Historie sehen                     |
| **Vorstand** | alles vom Mitglied + Userverwaltung, alle Strichlisten, Statistiken, Barcode-Verwaltung, Export |

**Login per 4-stelliger PIN** für jedes Mitglied (vom Vorstand vergeben/zurücksetzbar). Kein E-Mail-Versand, keine Self-Registration – Vorstand legt Konten an.

### Tresenmodus (Tablet am Tresen)

- Dediziertes Tablet im Kioskbetrieb mit dauerhaft laufender App.
- Startbildschirm zeigt **Liste aller aktiven Mitglieder** als Kacheln (Foto/Initialen + Name).
- Tap auf Mitglied → PIN eingeben (Numpad) → 4 Kategorie-Kacheln → Strich + automatisches Zurück zur Mitgliederliste nach kurzer Bestätigung.
- Inaktivitäts-Timeout (z.B. 15 s) führt immer zurück zur Mitgliederliste – nie ein "offener" Account.
- **Kein Barcode-Scanner im Tresenmodus** – bewusst weggelassen, der Scanner ist nur für Mitglieder am eigenen Smartphone gedacht.
- Gleicher Code wie die Mobile-Ansicht, nur mit `?mode=kiosk` Parameter, der die Session ans Gerät statt an den User bindet und die Scanner-UI ausblendet.

---

## 4. Funktionsumfang

### 4.1 Mitglieder-Ansicht (Mobile First)

- Login (PIN/Passwort, optional "merken")
- Startbildschirm: 4 große Kacheln (eine pro Kategorie) mit Tap = +1
- Optisches Feedback (Haptik via Vibration API + Toast "Bier +1")
- **Undo** der letzten Aktion (z.B. 5 s Snackbar "Rückgängig")
- Button "Barcode scannen" → Kamera-Modal
- Eigene Historie: Liste der letzten Striche, gruppiert nach Tag
- Eigener aktueller Stand pro Kategorie diesen Monat

### 4.2 Barcode-Scanner

- Browser-Kamera-Zugriff (`getUserMedia`) mit Bibliothek `@zxing/browser` oder `html5-qrcode`
- Erkannter EAN/GTIN → Lookup-Reihenfolge:
  1. Lokale DB: Ist Barcode bekannt? → Kategorie sofort verbuchen.
  2. OpenGTIN-API abfragen (`https://opengtindb.org/api.php?ean=<code>&cmd=query&queryid=<id>`).
  3. Wenn Treffer: Produktinfos zeigen, Vorstand/Nutzer ordnet **einmalig** Kategorie zu, Mapping wird gespeichert.
  4. Wenn kein Treffer: manuelle Eingabe (Produktname + Kategorie wählen) und ebenfalls speichern.
- Server-seitiger Proxy für die OpenGTIN-API (CORS, API-Key/queryid kapseln, Caching).
- Zwischen-Cache: Antworten aus OpenGTIN für 30 Tage cachen.

### 4.3 Admin-Panel (Desktop First)

- Userverwaltung
  - Anlegen / Bearbeiten / Deaktivieren (nicht hart löschen, sonst sind historische Striche verwaist)
  - PIN/Passwort zurücksetzen
- Strichlisten-Übersicht
  - Tabelle: Nutzer × Kategorie, Zeitraum filterbar (heute / Woche / Monat / Custom)
  - Drilldown pro Nutzer: alle Einzelbuchungen mit Zeitstempel, Quelle (Tap vs. Scan), Produkt
  - Manuelle Korrektur (Strich nachtragen oder löschen, mit Audit-Eintrag)
- Statistiken & Charts (Recharts oder Chart.js)
  - Konsum pro Kategorie über Zeit (Balken/Linie)
  - Top-Trinker im Zeitraum
  - Verlauf pro Tag/Wochentag/Stunde (Heatmap)
- Produkt-/Barcode-Verwaltung
  - Liste bekannter Barcodes mit zugeordneter Kategorie + Produktname
  - Editieren / neu zuordnen
- Export
  - CSV-Export der Strichliste pro Zeitraum (reine Mengen, keine Geldbeträge)
- Audit-Log
  - Wer hat wann manuell etwas geändert/gelöscht

---

## 5. Technische Architektur

### 5.1 Stack-Vorschlag (auf Raspberry Pi 4 / 8 GB optimiert)

- **Framework:** Next.js 15 (App Router) im Standalone-Build – ein Codebase für Frontend + API, läuft als einfacher Node-Prozess auf dem Pi.
- **Sprache:** TypeScript überall.
- **UI:** TailwindCSS + shadcn/ui – sauberes Look & Feel auf Mobile und Desktop.
- **Datenbank:** **SQLite** via Prisma. Begründung: ein Jugendclub mit < 100 Nutzern erzeugt extrem wenig Last, SQLite ist auf dem Pi schneller als Postgres (kein Netzwerk-Roundtrip), die DB ist eine einzige Datei (`drinks.db`) → Backup = Datei kopieren. Keine extra Services, weniger RAM-Verbrauch.
- **Auth:** Eigener PIN-Login (bcrypt-Hash der PIN, Server-Session-Cookie via `iron-session`). Kein NextAuth-Overhead.
- **Barcode-Scan:** `@zxing/browser` (multi-Format, gut auf Mobile).
- **Charts:** Recharts.
- **State:** React Server Components + minimal Client-State (`useState`, kein Redux/Zustand nötig).

### 5.2 Datenmodell (vereinfacht)

```
User
  id, name, pinHash, role (member|admin), active, createdAt

Category
  id, key (kat1..kat4), label, color, sortOrder, pricePerUnit (optional)

Product            // Barcode-Mapping
  id, ean, name, categoryId, source (opengtin|manual), createdAt

Tally              // Einzelner Strich
  id, userId, categoryId, productId? (nullable), source (tap|scan|admin),
  amount (default 1), note?, createdAt, createdBy (für Admin-Korrekturen)

AuditLog
  id, actorUserId, action, targetTable, targetId, before, after, createdAt

BarcodeCache       // OpenGTIN-Antworten cachen
  ean (PK), payload, fetchedAt
```

### 5.3 API-Endpunkte (Next.js Route Handlers)

```
POST  /api/auth/login
POST  /api/auth/logout

GET   /api/me
GET   /api/me/tallies?range=...
POST  /api/tallies                // body: { categoryId, source, productId? }
DELETE /api/tallies/:id           // nur eigener letzter Strich (Undo) oder Admin

GET   /api/barcode/:ean           // Lookup + OpenGTIN-Proxy + Cache
POST  /api/products               // Admin: Barcode -> Kategorie speichern

GET   /api/admin/users
POST  /api/admin/users
PATCH /api/admin/users/:id
GET   /api/admin/stats?from&to&groupBy=
GET   /api/admin/export.csv?from&to
GET   /api/admin/audit
```

### 5.4 Sicherheit

- HttpOnly + Secure Cookies für Session.
- CSRF-Schutz für mutierende Requests.
- Rate-Limit auf `/api/tallies` (pro Nutzer max. 1 Strich pro Sekunde) – schützt vor Doppel-Taps und Trolling.
- Admin-Endpunkte hinter Server-seitigem Role-Check (nicht nur UI-Verstecken).

---

## 6. UX-Details

### Mobile

- Daumen-zone-optimiertes Layout: 4 Kacheln im 2×2-Grid, alle erreichbar mit Daumen.
- Großer FAB unten für Barcode-Scan.
- Single-Tap = +1; wer Mehrfach buchen will, tappt mehrfach (Undo-Snackbar fängt Fehler).
- Haptisches Feedback (Vibration 30 ms) bei Buchung.
- Dark-Mode Default (Clubatmosphäre, batterieschonend).

### Desktop

- Linke Sidebar: Userverwaltung, Strichliste, Stats, Produkte, Audit, Export.
- Tabelle mit Sticky-Header, Filterleiste oben.
- Charts in Karten daneben, responsiv anordnen.

---

## 7. Iterationen / Phasen

### Phase 1 – MVP (Tap funktioniert end-to-end)

- Projekt-Setup (Next.js, Tailwind, Prisma, SQLite)
- PIN-Login + User-Schema + 1 Admin-Seed
- 4 Kategorien geseeded (Bier/Spezi/Radler, Mische, Cola/Sprite/Fanta, Shot)
- Mitglieder-UI: 4 Kacheln, +1 buchen, Undo, eigene Tagesübersicht
- Admin: User anlegen/PIN setzen, Strichliste je Nutzer ansehen

### Phase 2 – Tresenmodus & Statistiken

- Tresenmodus: Mitglieder-Kachelliste + PIN-Eingabe + Auto-Logout nach 15 s
- Charts (Konsum nach Zeit/Kategorie)
- CSV-Export
- Korrekturen + Audit-Log
- Filter + Drilldown

### Phase 3 – Barcode-Scanner

- Scanner-UI **nur** im Mitglieder-Frontend (Smartphone), nicht im Tresenmodus
- Server-Proxy auf OpenGTIN mit Cache (BarcodeCache-Tabelle)
- Produkt → Kategorie-Mapping (Erstzuordnung im UI durch Vorstand)
- Admin-Verwaltung für Barcodes/Produkte

### Phase 4 – Polish

- Dark-Mode, Haptik, Animationen
- PWA-Manifest (Add to Homescreen, Offline-Buchungen mit Sync) – wichtig bei wackeligem WLAN im Clubraum
- Health-Check + Auto-Restart via systemd auf dem Pi

---

## 8. Risiken & Annahmen

- **OpenGTIN-Coverage:** API kennt nicht alle Getränke (gerade lokale Brauereien). → manuelles Anlegen muss schmerzfrei sein.
- **OpenGTIN-Rate-Limit / Verfügbarkeit:** Ausfall darf das Anstreichen nicht blockieren. → Scanner fällt auf manuelle Kategoriewahl zurück.
- **Missbrauch:** Mitglieder könnten sich gegenseitig Striche zuschieben. → Striche sind immer an die eingeloggte Session gebunden, Korrekturen nur durch Vorstand mit Audit.
- **Datenschutz:** Konsumdaten sind sensibel (insb. bei minderjährigen Mitgliedern). → klärt der Vorstand intern, App speichert nur was nötig ist, kein Tracking, keine externen Analytics.

---

## 9. Geklärte Entscheidungen

- **Kategorien:** Kat 1 = Bier/Spezi/Radler, Kat 2 = Mische, Kat 3 = Cola/Sprite/Fanta, Kat 4 = Shot.
- **Auth:** 4-stellige PIN je Mitglied, vom Vorstand vergeben/zurücksetzbar.
- **Tresenmodus:** ja, Tablet am Tresen mit Mitglieder-Kachelliste + PIN. **Ohne** Barcode-Scanner.
- **Barcode-Scanner:** nur im Mitglieder-Frontend (Smartphone).
- **Geldbeträge:** nein, reine Mengenerfassung.
- **Hosting:** Raspberry Pi 4 (8 GB) → SQLite + Next.js Standalone.
- **Erreichbarkeit:** öffentlich via **Cloudflare Tunnel** (kein Port-Forwarding, automatisches HTTPS, kein eigenes Zertifikat nötig). Damit ist auch das HTTPS-Erfordernis des Browser-Kamera-APIs ohne Zusatzaufwand erfüllt.

## 10. Offene Fragen (klären, bevor Phase 1 startet)

1. **Cloudflare-Domain:** ist eine Domain bei Cloudflare schon vorhanden, oder muss eine eingerichtet werden? Welchen Hostname soll die App bekommen (z.B. `drinks.example.de`)?
2. **Cloudflare Access?** soll der Tunnel zusätzlich durch Cloudflare Access (E-Mail-OTP / Google-Login) abgesichert werden, oder reicht die App-eigene PIN-Auth?
3. **Historische Papierdaten** importieren oder bei null starten?
4. **Mitgliederzahl** ungefähr (Sizing der Tresenmodus-Kachelliste)?
5. **Tablet-Hardware:** welches Tablet/Browser am Tresen (relevant für Kiosk-Konfiguration und PWA-Support)?

---

## 11. Hosting auf Raspberry Pi 4 (8 GB) mit Cloudflare Tunnel

- **OS:** Raspberry Pi OS (64-bit, Bookworm) – wichtig wegen aktueller Node-LTS-Verfügbarkeit für arm64.
- **Node:** Node.js 20 LTS via NodeSource oder `nvm`.
- **App-Layout:**
  ```
  /opt/drinks/
    ├─ app/                  # Next.js standalone build
    ├─ data/drinks.db        # SQLite
    └─ backups/              # tägliche Kopien
  ```
- **Prozessmanagement:** systemd-Service `drinks.service`, App lauscht nur auf `127.0.0.1:3000` (nicht auf 0.0.0.0 – der Tunnel ist die einzige öffentliche Schnittstelle), Auto-Restart bei Crash, Boot-Start.
- **Cloudflare Tunnel:**
  - `cloudflared` als zweiter systemd-Service auf dem Pi (`cloudflared.service`).
  - Tunnel zeigt auf `http://localhost:3000` und veröffentlicht die App unter dem konfigurierten Cloudflare-Hostname.
  - **HTTPS** wird von Cloudflare automatisch terminiert – kein Let's-Encrypt-Setup auf dem Pi nötig.
  - **Kein Port-Forwarding** im Router nötig, kein offener Port am Pi nach außen.
  - DDoS-Schutz und IP-Verschleierung gratis durch Cloudflare.
- **Backups:** Cronjob nachts: `sqlite3 drinks.db ".backup '/opt/drinks/backups/drinks-$(date +\%F).db'"` + 14 Tage Rotation.
- **Updates:** Deployment per `git pull && npm ci && npm run build && systemctl restart drinks`.
- **Monitoring (leichtgewichtig):** `systemctl status drinks cloudflared` reicht; Cloudflare-Dashboard zeigt Tunnel-Health.
- **Optional:** Cloudflare Access vor den Tunnel schalten (E-Mail-OTP / Google-SSO), falls zusätzliche Auth-Schicht gewünscht.

## 12. Nächste Schritte

1. Verbliebene offene Fragen (Abschnitt 10) klären.
2. Repo initialisieren (Next.js + Prisma + SQLite + Tailwind + shadcn/ui).
3. Phase 1 (MVP) umsetzen, lokal entwickeln, dann auf Pi deployen.
4. Im Clubraum testen, Feedback einholen, Phasen 2 + 3 angehen.

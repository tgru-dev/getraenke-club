# Getränke-Club 🍻

Digitale Getränke-Strichliste für den Jugendclub. PWA (React + Vite) mit Hono-API
auf Cloudflare Workers, Daten in Cloudflare D1.

## Features

- **Mitglieder-App** (mobil, Dark Mode): PIN-Login, 1 Tap = +1 Strich, 60-Sekunden-Undo,
  Tagesübersicht, Monatsstand mit echten Strichlisten-Strichen, Verlauf, eigene PIN ändern.
- **Tresenmodus** (`/tresen`): Kiosk fürs Tablet ohne Account. Mitglied antippen → PIN →
  Kategorie → Bestätigung mit Undo. Nach 15 s Inaktivität automatischer Reset.
- **Admin-Panel** (`/admin`, nur Rolle „Vorstand"): Strichlisten-Matrix mit Zeitraumfilter
  und Drilldown, manuelle Korrekturen (mit Audit-Log), Statistiken (30-Tage-Trend,
  Top-Trinker, Wochentag×Stunde-Heatmap), Mitglieder- und Kategorienverwaltung,
  CSV-Export, Logo-Upload.
- **Offline-tauglich**: Buchungen in der Mitglieder-App werden bei Funkloch lokal
  gepuffert und automatisch idempotent nachgereicht (der Tresen braucht Netz, weil
  die PIN serverseitig geprüft wird).

## Entwicklung

Voraussetzung: Node.js ≥ 22.

```bash
npm install
npm run db:migrate:local   # lokale D1-Datenbank anlegen
npm run dev                # Vite-Dev-Server mit lokalem Worker + D1
```

Beim ersten Start `/setup` öffnen (passiert automatisch) und das erste
Vorstandskonto anlegen.

## Deployment auf Cloudflare

1. **D1-Datenbank anlegen** und die ausgegebene ID in `wrangler.jsonc` unter
   `database_id` eintragen:
   ```bash
   npx wrangler d1 create getraenke-club
   ```
2. **Migrationen auf die echte Datenbank anwenden:**
   ```bash
   npm run db:migrate:remote
   ```
3. **Auth-Secret setzen** (ersetzt den Dev-Wert aus `wrangler.jsonc`):
   ```bash
   npx wrangler secret put AUTH_SECRET   # langen Zufallswert eingeben
   ```
4. **Deployen:**
   ```bash
   npm run deploy
   ```

Danach die Worker-URL öffnen → Ersteinrichtung durchlaufen → Mitglieder anlegen.
Auf dem Tresen-Tablet `/tresen` öffnen und als Vollbild-App ("Zum Startbildschirm
hinzufügen") einrichten.

## Sicherheitsmodell

Alle nutzen 4-stellige PINs (gehasht mit Salt gespeichert). Da der PIN-Raum klein
ist, schützt serverseitiges Rate-Limiting: nach 5 Fehlversuchen wird das Konto für
5 Minuten gesperrt. Admin-Aktionen (Korrekturen, Löschungen, PIN-Resets) landen im
Audit-Log. Mitglieder werden deaktiviert statt gelöscht, damit historische Striche
erhalten bleiben.

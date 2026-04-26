<div align="center">
  <img src="assets/icon-256.png" alt="Getränke-Club Logo" width="160" />
  <h1>Getränke-Club Strichliste</h1>
</div>

Web-App, die die Papier-Strichliste im Jugendclub ablöst.

- **Mitglieder** strichen ihre Getränke per Smartphone an. Vorstand kann
  Kategorien (z.B. Bier / Mische / Cola / Shot / Sonstiges …) jederzeit
  selbst pflegen, inklusive einer Texteingabe-Variante für freie Notizen.
- **Vorstand** verwaltet Mitglieder, Kategorien und das Logo, sieht
  Statistiken, Strichliste und Audit-Log über das Admin-Panel.
- Auf einem **Tablet am Tresen** läuft der Kiosk-Modus ohne Account –
  Mitglied antippen, eigene PIN eingeben, Kategorie wählen.
- Gehostet auf einem **Raspberry Pi 4 (8 GB)**, öffentlich gemacht über
  einen **Cloudflare Tunnel** (HTTPS automatisch).

Repo: <https://codeberg.org/tg-macos/getraenke-club>
Vollständiger Plan: [`plan.md`](./plan.md).

## Stack

- Next.js 15 (App Router) + TypeScript
- TailwindCSS
- Prisma + SQLite
- iron-session + bcryptjs (PIN-Login)
- PWA: Web-Manifest + Service Worker + Offline-Buchungs-Queue im Browser

## Wichtige Pfade

| Pfad                  | Zweck                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| `/login`              | PIN-Login mit runden Mitglieder-Kacheln, "zuletzt"-Markierung. Tap auf eine Kachel öffnet das PIN-Numpad. Direkter Link in den **Tresenmodus** für Tablets. |
| `/member`             | Mitglieder-UI (Mobile), Kategorie-Kacheln, Self-PIN-Change, 60 s-Undo. |
| `/kiosk`              | Tresenmodus für Tablet, **kein Account nötig**, PIN wird vor der Kategorieauswahl serverseitig geprüft, Auto-Reset nach 15 s. |
| `/admin`              | Übersicht inkl. 30-Tage-Trend.                                         |
| `/admin/users`        | Mitglieder anlegen, Rolle/Status ändern, PIN zurücksetzen, **löschen** (mit Cascade auf Striche). |
| `/admin/tallies`      | Strichliste mit Filtern + CSV-Export. Rückgängig gemachte Striche werden inline mit Strikethrough + "rückgängig (Name)" angezeigt. |
| `/admin/categories`   | Kategorien anlegen, umbenennen, Farbe/Reihenfolge ändern, Texteingabe-Flag, **löschen** (mit Cascade). |
| `/admin/branding`     | Eigenes Club-Logo hochladen (PNG/JPEG/WEBP/SVG, ≤ 1 MB).               |
| `/api/branding/logo`  | Öffentlicher Logo-Endpoint, fällt ohne Custom-Upload auf das Default-Icon zurück. |

---

## Lokale Entwicklung

```bash
git clone https://codeberg.org/tg-macos/getraenke-club.git
cd getraenke-club

cp .env.example .env
# SESSION_SECRET in .env mit Zufallswert füllen:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

App läuft auf <http://localhost:3000>. Default-Admin: **Name `Admin`, PIN `0000`**
(über `ADMIN_PIN` in `.env` änderbar).

## Funktionsdetails

### Login

- Anonymer Aufruf von `/login` zeigt das Mitglieder-Raster mit runden
  Avataren (Initialen + farbiger Hintergrund pro Name).
- Der zuletzt angemeldete User wird mit einem **"zuletzt"-Badge** markiert
  und nach vorne sortiert – die App wählt ihn aber **nicht** automatisch
  aus. Die PIN-Tastatur erscheint erst, wenn jemand explizit auf eine
  Kachel tippt.
- Unten ein dezenter **Tresenmodus →**-Link für Tablets.

### Kategorien (anpassbar)

Standard nach `prisma:seed`:

| Kat | Label                 | Farbe   | Texteingabe |
| --- | --------------------- | ------- | ----------- |
| 1   | Bier / Spezi / Radler | amber   | nein        |
| 2   | Mische                | violet  | nein        |
| 3   | Cola / Sprite / Fanta | sky     | nein        |
| 4   | Shot                  | red     | nein        |
| 5   | Sonstiges             | emerald | **ja**      |

Vorstand kann unter `/admin/categories` jederzeit:

- neue Kategorien anlegen (Name, Farbe per Color-Picker, Reihenfolge),
- bestehende inline editieren (Sort, Name, Farbe, Texteingabe-Flag),
- Kategorien löschen (mit Cascade-Bestätigung, falls bereits Striche
  existieren).

**Texteingabe-Flag:** Wenn aktiviert, öffnet ein Tap auf die Kachel ein
Eingabefeld. Der Text landet als Notiz am Strich (sichtbar in der
Admin-Strichliste und im CSV-Export). Praktisch für "Sonstiges", aber auch
für eigene Kategorien wie "Cocktail" oder "Sonderaktion".

### Eigenes Club-Logo

Unter `/admin/branding` lädt der Vorstand ein eigenes Logo hoch
(PNG/JPEG/WEBP/SVG, max. 1 MB). Es liegt als Blob in der SQLite-DB und ist
damit automatisch im Backup mit drin. Das Logo erscheint im
Login-Header, im Mitglieder-Header, im Tresenmodus-Header und in der
Admin-Topbar/Sidebar. "Logo entfernen" stellt das Standard-Icon wieder
her.

### Striche rückgängig machen

- Mitglieder können den letzten eigenen Strich **innerhalb von 60 s** über
  die "Rückgängig"-Snackbar zurücknehmen.
- Vorstand kann jeden Strich aus der Strichliste löschen (kein Zeitlimit).
- Beide Wege machen technisch ein **Soft-Delete**: der Strich bleibt in
  der DB, zählt aber nicht mehr in Übersicht/Export. In `/admin/tallies`
  erscheint er weiter mit roter Tönung, Strikethrough und Hinweis
  "rückgängig (Name)" – damit ist nachvollziehbar, wer wann was
  zurückgenommen hat.

### Vorstand bucht selbst

Vorstandsmitglieder loggen sich genauso ein wie alle anderen und landen
zuerst auf `/member`. Über den **Admin**-Button im Header kommen sie ins
Verwaltungspanel. In der Admin-Sidebar führt **Meine Striche →** zurück
zur Mitglieder-Ansicht.

### Tresenmodus

1. Auf dem Tablet `/login` öffnen und auf **Tresenmodus →** tippen.
   Die Seite verlangt **kein Login** und kein dauerhaftes Konto am Gerät.
2. Bedienung: Mitglied antippen → eigene PIN eingeben → die App prüft
   die PIN sofort serverseitig. Bei falscher Eingabe bleibt der Bildschirm
   auf der PIN-Stufe ("PIN falsch") und das Kategoriemenü erscheint
   gar nicht.
3. Nach erfolgreicher PIN: Kategorie wählen → Bestätigung →
   automatisches Zurück zur Mitgliederauswahl. **15 s Inaktivität** in
   den Pin- oder Kategorie-Schritten setzen ebenfalls zurück.
4. Über **Beenden** in der Kopfzeile kommt man zurück nach `/login`.

### PWA / Add to Homescreen

- App lässt sich auf iOS und Android über das Browsermenü als Icon auf
  den Homescreen legen ("Zum Home-Bildschirm hinzufügen"). Sie startet
  dann ohne Browserleisten, mit dem hochgeladenen Club-Logo (oder dem
  Default) und dunklem Theme.
- Beim ersten Öffnen über HTTPS registriert die App einen Service Worker,
  der die App-Shell offline-fähig macht und bei Verbindungsabbruch die
  Seite `/offline` ausliefert.
- **Offline-Buchungen:** Tippt ein Mitglied ohne Verbindung eine
  Kategorie an, wird der Strich optimistisch gezählt und in der lokalen
  Queue gepuffert. Sobald die Verbindung zurück ist (`online`-Event,
  Tab wieder sichtbar oder periodischer Retry alle 30 s), werden offene
  Buchungen automatisch nachgereicht. Im UI zeigt ein gelber Banner die
  Anzahl ausstehender Buchungen, rot bei Offline.

---

## Deployment auf Raspberry Pi 4

Annahmen: Raspberry Pi OS Bookworm (64-bit), Pi-User heißt `pi` (sonst
alle Vorkommen ersetzen). Du hast einen Cloudflare-Account und eine
Domain bei Cloudflare.

### 1. System vorbereiten

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs sqlite3 git
node --version    # erwartet: v20.x
```

### 2. App ablegen

```bash
sudo mkdir -p /opt/drinks/data /opt/drinks/backups
sudo chown -R pi:pi /opt/drinks
cd /opt/drinks
git clone https://codeberg.org/tg-macos/getraenke-club.git app
cd app
npm ci
```

### 3. `.env` anlegen

```bash
SECRET=$(openssl rand -hex 32)
cat > /opt/drinks/app/.env <<EOF
DATABASE_URL="file:/opt/drinks/data/drinks.db"
SESSION_SECRET="${SECRET}"
ADMIN_PIN="0000"
NODE_ENV="production"
EOF
chmod 600 /opt/drinks/app/.env
```

### 4. Datenbank + Build

```bash
cd /opt/drinks/app
npx prisma migrate deploy
npm run prisma:seed   # legt Standard-Kategorien + Admin (PIN aus ADMIN_PIN) an
npm run build         # erzeugt .next/standalone und kopiert public/static rein
```

### 5. systemd-Service für die App

`/etc/systemd/system/drinks.service`:

```ini
[Unit]
Description=Getraenke Strichliste
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/drinks/app
EnvironmentFile=/opt/drinks/app/.env
ExecStart=/usr/bin/node /opt/drinks/app/.next/standalone/server.js
Restart=on-failure
RestartSec=3
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now drinks
sudo systemctl status drinks
curl -i http://127.0.0.1:3000/login   # sollte HTTP/1.1 200 liefern
```

> Die App bindet bewusst nur an `127.0.0.1` – nach außen erreichbar
> wird sie ausschließlich über den Cloudflare Tunnel.

### 6. Cloudflare Tunnel

```bash
# cloudflared installieren (arm64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb \
  -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# Login öffnet einen Browser-Link – im Cloudflare-Dashboard die Domain
# autorisieren.
cloudflared tunnel login
cloudflared tunnel create drinks
```

`~/.cloudflared/config.yml` anlegen (UUID aus dem Output von `tunnel
create` einsetzen, hier `<id>` genannt):

```yaml
tunnel: <id>
credentials-file: /home/pi/.cloudflared/<id>.json
ingress:
  - hostname: drinks.example.de
    service: http://localhost:3000
  - service: http_status:404
```

DNS-Eintrag erzeugen und Service installieren:

```bash
cloudflared tunnel route dns drinks drinks.example.de
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

App ist anschließend unter `https://drinks.example.de` erreichbar – HTTPS
wird vollständig von Cloudflare terminiert. Es muss kein Port am Router
geöffnet werden, und der Pi-Server hat keinen offenen Port nach außen.

### 7. Erste Schritte im Live-System

1. `https://drinks.example.de/login` öffnen.
2. **Admin** auswählen und mit der PIN aus Schritt 3 (Standard `0000`)
   anmelden.
3. Im Mitglieder-Header **Admin** → **PIN ändern** – setze eine eigene
   PIN.
4. Über **Mitglieder** weitere Konten anlegen (Name + 4-stellige
   Start-PIN). Mitglieder ändern ihre PIN selbst über den **PIN**-Button
   im Mitglieder-Header.
5. Optional: Unter **Kategorien** eigene Getränke ergänzen oder
   anpassen, unter **Logo** das Club-Logo hochladen.

### 8. Backups

`/etc/cron.d/drinks-backup`:

```cron
15 4 * * * pi sqlite3 /opt/drinks/data/drinks.db ".backup '/opt/drinks/backups/drinks-$(date +\%F).db'" && find /opt/drinks/backups -name 'drinks-*.db' -mtime +14 -delete
```

Backup einmal manuell testen:

```bash
sudo -u pi sqlite3 /opt/drinks/data/drinks.db ".backup '/opt/drinks/backups/test.db'"
ls -lh /opt/drinks/backups/
```

> Logos und Konfiguration liegen ebenfalls in der DB – ein einziges
> Backup-File reicht zur kompletten Wiederherstellung.

### 9. Updates einspielen

```bash
cd /opt/drinks/app
git pull
npm ci
npx prisma migrate deploy
npm run prisma:seed       # idempotent: aktualisiert Standard-Kategorien
npm run build
sudo systemctl restart drinks
```

`npm run build` erzeugt zugleich das Standalone-Bundle und kopiert
`public/` und `.next/static` an die richtige Stelle (siehe
`scripts/postbuild.sh`).

### 10. Troubleshooting

| Symptom | Ursache / Fix |
| --- | --- |
| `drinks.service` startet nicht | `journalctl -u drinks -n 100`. Häufig: `DATABASE_URL` ist relativ und zeigt ins Leere. Im `.env` muss ein **absoluter** Pfad stehen (`file:/opt/drinks/data/drinks.db`). |
| Tunnel oben, aber 502 in Browser | App läuft nicht oder nicht auf 3000: `systemctl status drinks`, `curl http://127.0.0.1:3000/login`. |
| PWA zeigt nach Update alte Seite | Service Worker hat alte Shell gecached. Einmal im Browser hard-reload (oder die installierte App neu vom Homescreen anlegen) – beim nächsten Online-Aufruf zieht der SW automatisch. |
| Letzter Admin sperrt sich aus | API verhindert das (`last_admin`-Schutz). Zur Not direkt in DB: `sqlite3 /opt/drinks/data/drinks.db "UPDATE User SET active=1, role='admin' WHERE name='Admin';"`. |
| Strich verschwand, aber Vorstand fragt warum | In `/admin/tallies` taucht er weiter mit Strikethrough auf, inkl. **rückgängig (Name)**. Im CSV-Export ist er nicht enthalten (nur aktive). |
| Kiosk akzeptiert keine PIN | `/api/kiosk/verify` prüft serverseitig. Falsch-Eingaben sind auf 1 Versuch / 0,4 s rate-limited. Bei 429 kurz warten. |

---

## Stand der Umsetzung

- [x] Phase 1 – MVP: Login mit runden Mitglieder-Kacheln,
      Mitglieder-UI mit Kategorie-Kacheln + Undo, Self-PIN-Change,
      Adminpanel mit User-Verwaltung, Strichliste, CSV-Export, Audit-Log.
- [x] Phase 2 – Tresenmodus (Tablet-Kiosk), 30-Tage-Trend im Admin.
- [x] Phase 3 – Barcode-Scanner mit OpenGTIN _(später wieder entfernt –
      Kamera-Workflow nicht erwünscht)_.
- [x] Phase 4 – PWA-Manifest + App-Icon, Service Worker für Offline-Shell,
      Offline-Queue für Tally-Buchungen mit automatischem Retry und
      Status-Banner.
- [x] Phase 5 – Mitglieder-Löschen mit Cascade, "Sonstiges"-Kategorie,
      Login-Auswahl scrollbar, Kiosk außerhalb des Admin-Bereichs.
- [x] Phase 6 – Sonstiges als Texteingabe, Kiosk **ohne** Account
      (Auto-Logout vor Aktivierung), Default-Landing für alle auf
      `/member`, Admin-Header bekommt App-Icon.
- [x] Phase 7 – Eigenes Club-Logo (DB-Blob, jede Stelle nutzt
      `/api/branding/logo` mit Default-Fallback), CRUD für Kategorien
      mit `freetext`-Flag, URL-Umzug `/m → /member`.
- [x] Phase 8 – Soft-Delete für Tallies (Counts filtern, Strichliste zeigt
      "rückgängig (Name)"), Kiosk-PIN-Vorprüfung über
      `/api/kiosk/verify`, Login-PIN nur nach explizitem Tap (kein
      Auto-Select aus localStorage), Tresenmodus-Button von Member nach
      Login verlegt.

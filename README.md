<div align="center">
  <img src="assets/icon-256.png" alt="Getränke-Club Logo" width="160" />
  <h1>Getränke-Club Strichliste</h1>
</div>

Web-App, die die Papier-Strichliste im Jugendclub ablöst.

- **Mitglieder** strichen ihre Getränke per Smartphone an (4 Kategorien) –
  optional über die Smartphone-Kamera per Barcode-Scan.
- **Vorstand** verwaltet Mitglieder, Produkte und sieht Statistiken über das
  Admin-Panel.
- Auf einem Tablet am Tresen läuft der **Tresenmodus** für gemeinsame Bedienung
  ohne ständiges Ein- und Ausloggen.
- Gehostet auf einem **Raspberry Pi 4 (8 GB)**, öffentlich gemacht über
  einen **Cloudflare Tunnel** (HTTPS automatisch).

Repo: <https://codeberg.org/tg-macos/getraenke-club>
Vollständiger Plan: [`plan.md`](./plan.md).

## Stack

- Next.js 15 (App Router) + TypeScript
- TailwindCSS
- Prisma + SQLite
- iron-session + bcryptjs (PIN-Login)
- `@zxing/browser` (Barcode-Erkennung)
- OpenGTIN-DB als Produkt-Lookup, lokal 30 Tage gecached
- PWA: Web-Manifest + Service Worker + Offline-Buchungs-Queue im Browser

## Wichtige Pfade

| Pfad               | Zweck                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `/login`           | PIN-Login mit runden Mitglieder-Kacheln, letzter Login gemerkt   |
| `/m`               | Mitglieder-UI (Mobile), 4 Kategorie-Kacheln, Self-PIN-Change     |
| `/m/scan`          | Barcode-Scanner (nutzt Smartphone-Kamera)                        |
| `/kiosk`           | Tresenmodus für Tablet, kein Scanner, Auto-Reset nach 15 s       |
| `/admin`           | Übersicht inkl. 30-Tage-Trend                                    |
| `/admin/users`     | Mitglieder anlegen, Rolle/Status ändern, PIN zurücksetzen        |
| `/admin/tallies`   | Strichliste mit Filtern + CSV-Export                             |
| `/admin/products`  | Barcode↔Produkt↔Kategorie pflegen                                |

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
(über `ADMIN_PIN` in `.env` änderbar). Nach dem ersten Login die PIN über
"PIN ändern" in der Admin-Sidebar setzen.

## Funktionsdetails

### Barcode-Scanner

- Erreichbar über `/m/scan` oder den 📷-Button auf der Mitglieder-Startseite.
- Browser-Kamera-API verlangt **HTTPS** – wird durch den Cloudflare Tunnel
  automatisch erfüllt. Lokal funktioniert die Kamera nur über `localhost` oder
  HTTPS.
- Flow:
  1. Scan startet die Rückkamera, sucht EAN-8/12/13/14.
  2. Bekannter Barcode → Kategorie wird angezeigt, ein Tap bucht den Strich.
  3. OpenGTIN-Treffer (Produkt neu) → Namensvorschlag, Mitglied wählt
     Kategorie, Mapping wird gespeichert.
  4. Kein Treffer → Mitglied trägt Namen + Kategorie ein, Mapping wird
     gespeichert.
- Vorstand pflegt Mappings unter `/admin/products` nach.
- **OpenGTIN-Schlüssel:** Setze `OPENGTIN_QUERYID` in `.env`. Der Schlüssel
  ist über das Kontaktformular bei [opengtindb.org](https://opengtindb.org/)
  kostenlos erhältlich. Ohne Schlüssel liefert die API `error=5` und der
  Scanner fällt sofort auf manuelle Eingabe zurück (funktioniert ebenfalls).

### PWA / Add to Homescreen

- App lässt sich auf iOS und Android über das Browsermenü als Icon auf den
  Homescreen legen ("Zum Home-Bildschirm hinzufügen"). Sie startet dann ohne
  Browserleisten, mit dem `assets/icon-256.png`-Logo und dunklem Theme.
- Beim ersten Öffnen über HTTPS registriert die App einen Service Worker, der
  die App-Shell offline-fähig macht und bei Verbindungsabbruch die Seite
  `/offline` ausliefert.
- **Offline-Buchungen:** Tippt ein Mitglied ohne Verbindung eine Kategorie an,
  wird der Strich optimistisch gezählt und in der lokalen Queue gepuffert.
  Sobald die Verbindung zurück ist (Browser-`online`-Event oder periodischer
  Retry alle 30 s), werden offene Buchungen automatisch nachgereicht. Im UI
  zeigt ein gelber Banner die Anzahl ausstehender Buchungen; rot bei Offline.

### Tresenmodus

1. Auf dem Tablet einmal mit einem Admin-Account anmelden.
2. `/kiosk` öffnen (Link in der Admin-Sidebar).
3. Tablet im Browser-Vollbild belassen. Die Admin-Session bleibt 30 Tage gültig
   und wirkt als "Geräteberechtigung" des Tablets.
4. Bedienung: Mitglied antippen → eigene PIN eingeben → Kategorie wählen.
   Nach 15 s Inaktivität springt das Tablet automatisch zurück zur
   Mitgliederauswahl.

---

## Deployment auf Raspberry Pi 4

Annahmen: Raspberry Pi OS Bookworm (64-bit), Pi-User heißt `pi` (sonst alle
Vorkommen ersetzen). Du hast einen Cloudflare-Account und eine Domain bei
Cloudflare.

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
OPENGTIN_QUERYID=""
EOF
chmod 600 /opt/drinks/app/.env
```

> Den `OPENGTIN_QUERYID` später eintragen, sobald du den kostenlosen
> Schlüssel von opengtindb.org per Mail bekommen hast. Ohne Schlüssel
> funktioniert die App – Mitglieder müssen unbekannte Barcodes nur einmalig
> per Hand benennen.

### 4. Datenbank + Build

```bash
cd /opt/drinks/app
npx prisma migrate deploy
npm run prisma:seed   # legt 4 Kategorien + Admin (PIN aus ADMIN_PIN) an
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

> Die App bindet bewusst nur an `127.0.0.1` – nach außen erreichbar wird sie
> ausschließlich über den Cloudflare Tunnel.

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

`~/.cloudflared/config.yml` anlegen (UUID aus dem Output von `tunnel create`
einsetzen, hier `<id>` genannt):

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

App ist anschließend unter `https://drinks.example.de` erreichbar – HTTPS wird
vollständig von Cloudflare terminiert. Es muss kein Port am Router geöffnet
werden, und der Pi-Server hat keinen offenen Port nach außen.

### 7. Initial-Admin absichern

1. `https://drinks.example.de/login` öffnen.
2. Als `Admin` mit der PIN aus Schritt 3 (Standard `0000`) anmelden.
3. In der Admin-Sidebar auf **PIN ändern** klicken und eine neue PIN setzen.
4. Über `/admin/users` weitere Mitglieder mit Start-PIN anlegen. Mitglieder
   können ihre PIN selbst über die Schaltfläche **PIN** im Mitglieder-Header
   ändern.

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

### 9. Updates einspielen

```bash
cd /opt/drinks/app
git pull
npm ci
npx prisma migrate deploy
npm run build
sudo systemctl restart drinks
```

`npm run build` erzeugt zugleich das Standalone-Bundle und kopiert
`public/` und `.next/static` an die richtige Stelle (siehe
`scripts/postbuild.sh`).

### 10. Troubleshooting

| Symptom                                   | Ursache / Fix                                                    |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `drinks.service` startet nicht            | `journalctl -u drinks -n 100`. Häufig: `DATABASE_URL` ist relativ und zeigt ins Leere. Im `.env` muss ein **absoluter** Pfad stehen (`file:/opt/drinks/data/drinks.db`). |
| Tunnel oben, aber 502 in Browser          | App läuft nicht oder nicht auf 3000: `systemctl status drinks`, `curl http://127.0.0.1:3000/login`. |
| Kamera startet im Scanner nicht           | Seite muss über HTTPS aufgerufen werden (Cloudflare-Hostname, nicht IP des Pi). Browser-Berechtigung prüfen. |
| OpenGTIN-Lookup schlägt mit `error=5` fehl | `OPENGTIN_QUERYID` fehlt oder ist ungültig. Workflow funktioniert dennoch (manuelle Eingabe), Fix: Schlüssel registrieren und in `.env` eintragen, dann `systemctl restart drinks`. |
| Letzter Admin sperrt sich aus             | API verhindert das (`last_admin`-Schutz). Zur Not direkt in DB:  `sqlite3 /opt/drinks/data/drinks.db "UPDATE User SET active=1, role='admin' WHERE name='Admin';"`. |

---

## Stand der Umsetzung

- [x] Phase 1 – MVP: Login mit runden Mitglieder-Kacheln + Last-User-Memory,
      Mitglieder-UI mit 4 Kacheln + Undo, Self-PIN-Change, Adminpanel mit
      User-Verwaltung, Strichliste, CSV-Export, Audit-Log
- [x] Phase 2 – Tresenmodus (Tablet-Kiosk ohne Scanner), 30-Tage-Trend im Admin
- [x] Phase 3 – Barcode-Scanner mit OpenGTIN (Mitglieder-Smartphone),
      Produkt-/Barcode-Verwaltung im Admin, BarcodeCache mit 30 Tagen TTL
- [x] Phase 4 – PWA-Manifest + App-Icon (iOS/Android-Add-to-Homescreen),
      Service Worker für Offline-Shell + `/offline`-Fallback, Offline-Queue
      für Tally-Buchungen mit automatischem Retry und Status-Banner

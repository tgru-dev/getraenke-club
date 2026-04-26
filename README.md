# Getränke-Strichliste

Web-App zur Ablösung der Papier-Strichliste im Jugendclub.

- **Mitglieder** strichen ihre Getränke per Smartphone an (4 Kategorien).
- **Vorstand** verwaltet Mitglieder und sieht Statistiken über das Admin-Panel.
- Gehostet auf einem **Raspberry Pi 4 (8 GB)**, öffentlich gemacht via **Cloudflare Tunnel**.

Vollständiger Plan: siehe [`plan.md`](./plan.md).

## Stack

- Next.js 15 (App Router) + TypeScript
- TailwindCSS
- Prisma + SQLite
- iron-session + bcryptjs (PIN-Login)

## Lokale Entwicklung

```bash
cp .env.example .env
# SESSION_SECRET in .env mit zufälligem Wert füllen:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

App läuft auf <http://localhost:3000>.

Default-Admin: **Name `Admin`, PIN `0000`** (über `ADMIN_PIN` in `.env` änderbar).
PIN nach erstem Login im Admin-Panel ändern.

## Wichtige Pfade

- `/login` – PIN-Login mit runden Mitglieder-Kacheln und Last-User-Memory
- `/m` – Mitglieder-UI (Mobile), inkl. Self-PIN-Change
- `/m/scan` – Barcode-Scanner (Smartphone-Kamera)
- `/kiosk` – Tresenmodus für Tablet (nur erreichbar mit Admin-Session, kein Scanner)
- `/admin` – Admin-Übersicht mit 30-Tage-Trend
- `/admin/users` – Mitgliederverwaltung
- `/admin/tallies` – Strichlisten + CSV-Export
- `/admin/products` – Barcode/Produkt-Mappings

## Barcode-Scanner

- Erreichbar über `/m/scan` oder den 📷-Button auf der Mitglieder-Startseite.
- Browser-Kamera-API verlangt **HTTPS** – wird durch Cloudflare Tunnel automatisch erfüllt.
- Flow:
  1. Scan startet die Rückkamera, sucht EAN-8/12/13/14.
  2. Bekannter Barcode → Kategorie wird angezeigt, Strich wird mit einem Tap gebucht.
  3. OpenGTIN-Treffer (Produkt neu) → Vorschlag für Namen, Mitglied wählt Kategorie, Mapping wird gespeichert.
  4. Kein Treffer → Mitglied trägt Namen + Kategorie ein, Mapping wird gespeichert.
- Vorstand pflegt Barcodes/Kategorien unter `/admin/products` nach.
- **OpenGTIN-Schlüssel:** Setze `OPENGTIN_QUERYID` in `.env`. Der Schlüssel ist
  über das Kontaktformular bei [opengtindb.org](https://opengtindb.org/) kostenlos
  erhältlich. Ohne Schlüssel liefert die API `error=5` und der Scanner fällt
  sofort auf manuelle Eingabe zurück (funktioniert ebenfalls).

## Tresenmodus

1. Auf dem Tablet einmal mit einem Admin-Account anmelden.
2. `/kiosk` öffnen (Link in der Admin-Sidebar).
3. Tablet im Browser-Vollbild belassen. Die Admin-Session bleibt 30 Tage gültig
   und ist die "Kiosk-Berechtigung" des Geräts.
4. Bedienung: Mitglied antippen → eigene PIN eingeben → Kategorie wählen.
   Nach 15 s Inaktivität springt das Tablet automatisch zurück zur Mitgliederauswahl.

## Deployment auf Raspberry Pi 4

### 1. System vorbereiten

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs sqlite3
```

### 2. App ablegen

```bash
sudo mkdir -p /opt/drinks/data /opt/drinks/backups
sudo chown -R $USER:$USER /opt/drinks
cd /opt/drinks
git clone <repo> app
cd app
npm ci
```

### 3. `.env` anlegen

```bash
cat > .env <<'EOF'
DATABASE_URL="file:/opt/drinks/data/drinks.db"
SESSION_SECRET="<32+ Zeichen, mit openssl rand -hex 32 erzeugt>"
ADMIN_PIN="0000"
NODE_ENV="production"
EOF
```

### 4. Build + DB

```bash
npx prisma migrate deploy
npm run prisma:seed
npm run build
```

### 5. systemd-Service

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

> Hinweis: Next.js `output: "standalone"` legt den Server unter
> `.next/standalone/server.js` ab. `public/` und `.next/static/` müssen
> dorthin kopiert sein:
>
> ```bash
> cp -r public .next/standalone/
> cp -r .next/static .next/standalone/.next/
> ```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now drinks
sudo systemctl status drinks
```

### 6. Cloudflare Tunnel

```bash
# cloudflared installieren (arm64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# einmalig: Login + Tunnel anlegen
cloudflared tunnel login
cloudflared tunnel create drinks

# Konfig: ~/.cloudflared/config.yml
#
# tunnel: <id>
# credentials-file: /home/pi/.cloudflared/<id>.json
# ingress:
#   - hostname: drinks.example.de
#     service: http://localhost:3000
#   - service: http_status:404

cloudflared tunnel route dns drinks drinks.example.de
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

App ist anschließend unter `https://drinks.example.de` erreichbar – HTTPS
wird vollständig von Cloudflare terminiert. Es muss am Router kein Port
geöffnet werden.

### 7. Backups

`/etc/cron.d/drinks-backup`:

```cron
15 4 * * * pi sqlite3 /opt/drinks/data/drinks.db ".backup '/opt/drinks/backups/drinks-$(date +\%F).db'" && find /opt/drinks/backups -name 'drinks-*.db' -mtime +14 -delete
```

### 8. Updates

```bash
cd /opt/drinks/app
git pull
npm ci
npx prisma migrate deploy
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
sudo systemctl restart drinks
```

## Stand der Umsetzung

- [x] Phase 1 – MVP: Login mit runden Mitglieder-Kacheln + Last-User-Memory,
      Mitglieder-UI mit 4 Kacheln + Undo, Self-PIN-Change, Adminpanel mit
      User-Verwaltung, Strichliste, CSV-Export, Audit-Log
- [x] Phase 2 – Tresenmodus (Tablet-Kiosk ohne Scanner), 30-Tage-Trend im Admin
- [x] Phase 3 – Barcode-Scanner mit OpenGTIN (Mitglieder-Smartphone),
      Produkt-/Barcode-Verwaltung im Admin, BarcodeCache mit 30 Tagen TTL
- [ ] Phase 4 – Polish, PWA, Offline-Sync

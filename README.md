<div align="center">
  <img src="assets/icon-256.png" alt="Getränke-Club Logo" width="160" />
  <h1>Getränke-Club Strichliste</h1>
</div>

Digitale Strichliste für den Jugendclub – Ablösung der Papierliste.
Mitglieder buchen ihre Getränke per Smartphone oder gemeinsam über ein
Tablet am Tresen, der Vorstand sieht alles im Browser.

## Was die App kann

- **Mitglieder-Ansicht** – PIN-Login, ein Tap pro Getränk, eigene
  Tagesübersicht, 60 s-Undo, eigene PIN ändern.
- **Tresenmodus** – läuft am Tablet ohne Account: Mitglied antippen,
  PIN, Kategorie. Nach 15 s Inaktivität setzt sich alles zurück.
- **Admin-Panel** – Mitglieder anlegen / löschen, Kategorien pflegen,
  Strichliste mit CSV-Export, Logo hochladen, 30-Tage-Trend.
- **Offline-tauglich (PWA)** – Buchungen werden lokal gepuffert, wenn
  das WLAN aussetzt, und automatisch nachgereicht.

## URLs

| Pfad                | Wofür                                            |
| ------------------- | ------------------------------------------------ |
| `/login`            | PIN-Login + Link in den Tresenmodus              |
| `/member`           | Mitglieder-UI                                    |
| `/kiosk`            | Tresenmodus für Tablet                           |
| `/admin`            | Übersicht                                        |
| `/admin/users`      | Mitglieder verwalten                             |
| `/admin/categories` | Getränke-Kategorien anpassen                     |
| `/admin/tallies`    | Komplette Strichliste + CSV-Export               |
| `/admin/branding`   | Eigenes Logo hochladen                           |

## Installation auf dem Raspberry Pi (Schritt für Schritt)

Vorausgesetzt: Raspberry Pi 4 mit Pi OS Bookworm (64-bit), Pi-User
heißt `pi`, Cloudflare-Account mit eigener Domain.

```bash
# 1) Node 20 + SQLite installieren
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs sqlite3 git

# 2) App auschecken
sudo mkdir -p /opt/drinks/data /opt/drinks/backups
sudo chown -R pi:pi /opt/drinks
git clone https://github.com/tgru-dev/getraenke-club.git /opt/drinks/app
cd /opt/drinks/app
npm ci

# 3) .env mit Zufalls-Secret anlegen
SECRET=$(openssl rand -hex 32)
cat > .env <<EOF
DATABASE_URL="file:/opt/drinks/data/drinks.db"
SESSION_SECRET="${SECRET}"
NODE_ENV="production"
EOF
chmod 600 .env

# 4) DB anlegen, Standard-Daten seeden, App bauen
npx prisma migrate deploy
npm run prisma:seed     # Admin / PIN 0000 + Standard-Kategorien
npm run build
```

App-Service einrichten – Datei `/etc/systemd/system/drinks.service`:

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
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now drinks
```

Cloudflare Tunnel installieren und mit dem lokalen Port 3000 verbinden:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cf.deb
sudo dpkg -i /tmp/cf.deb
cloudflared tunnel login        # öffnet Browser-Link
cloudflared tunnel create drinks
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <id-aus-create>
credentials-file: /home/pi/.cloudflared/<id-aus-create>.json
ingress:
  - hostname: drinks.example.de
    service: http://localhost:3000
  - service: http_status:404
```

```bash
cloudflared tunnel route dns drinks drinks.example.de
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Fertig – die App ist unter `https://drinks.example.de` erreichbar,
HTTPS macht Cloudflare automatisch.

## Erste Schritte

1. `https://drinks.example.de/login` aufrufen.
2. Als **Admin** mit PIN `0000` einloggen.
3. Im Header **Admin → PIN ändern** → eigene PIN setzen.
4. Unter **Mitglieder** Konten anlegen (Name + 4-stellige Start-PIN).
   Mitglieder ändern ihre PIN selbst.
5. Optional: Unter **Kategorien** eigene Getränke ergänzen, unter
   **Logo** das Vereins-Logo hochladen.

## Updates einspielen

```bash
cd /opt/drinks/app
git pull
npm ci
npx prisma migrate deploy
npm run prisma:seed
npm run build
sudo systemctl restart drinks
```

## Backup

Tägliches Backup der DB per Cron – `/etc/cron.d/drinks-backup`:

```cron
15 4 * * * pi sqlite3 /opt/drinks/data/drinks.db ".backup '/opt/drinks/backups/drinks-$(date +\%F).db'" && find /opt/drinks/backups -name 'drinks-*.db' -mtime +14 -delete
```

Logo, Konfig und Striche liegen alle in derselben Datei – ein Backup
reicht.

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

App läuft auf <http://localhost:3000>, Default-Login `Admin / 0000`.

## Stack

Next.js 15 · TypeScript · TailwindCSS · Prisma + SQLite · iron-session
(PIN-Login mit bcrypt) · PWA + Service Worker.

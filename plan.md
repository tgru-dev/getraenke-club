Digitale getränke list für unsren Jugenclub in next.js
wir sind ca 40 mitglieder aufgeteielt in mitglieder und vorstand

Mitglieder-Ansicht – PIN-Login, ein Tap pro Getränk, eigene Tagesübersicht, 60 s-Undo, eigene PIN ändern.
Tresenmodus – läuft am Tablet ohne Account: Mitglied antippen, PIN, Kategorie. Nach 15 s Inaktivität setzt sich alles zurück.
Admin-Panel – Mitglieder anlegen / löschen, Kategorien pflegen, Strichliste mit CSV-Export, Logo hochladen, 30-Tage-Trend.
Offline-tauglich (PWA) – Buchungen werden lokal gepuffert, wenn das WLAN aussetzt, und automatisch nachgereicht.


es gibt folgende kategorien
-Bier / Spezi / Radler
-Mische
- Cola / Sprite / Fanta
-Shot
-Sonstiges (Textfeld)

Kategorien sollen in der Datenbank konfigurierbar sein (nicht hartkodiert), damit der Vorstand sie später ändern/erweitern kann (Reihenfolge, Farbe, Anzeigename).

Tresenmodus (Tablet am Tresen)
Dediziertes Tablet im Kioskbetrieb mit dauerhaft laufender App.
Startbildschirm zeigt Liste aller aktiven Mitglieder als Kacheln (Foto/Initialen + Name).
Tap auf Mitglied → PIN eingeben (Numpad) → 4 Kategorie-Kacheln → Strich + automatisches Zurück zur Mitgliederliste nach kurzer Bestätigung.
Inaktivitäts-Timeout (z.B. 15 s) führt immer zurück zur Mitgliederliste – nie ein "offener" Account.

Erfolgskriterien
Ein Mitglied kann in ≤ 3 Taps ein Getränk anstreichen.
Vorstand kann jederzeit nachvollziehen: wer / wann / was konsumiert hat.
Reine Browser-App (keine native App nötig), läuft auf jedem Smartphone und Desktop.
Offline-Nachsicht oder zumindest robustes Verhalten bei Funkloch im Clubraum.


Mitglieder-Ansicht 
Login (PIN/Passwort, optional "merken")
Startbildschirm: 4 große Kacheln (eine pro Kategorie) mit Tap = +1
Optisches Feedback (Toast "Bier +1")
Undo der letzten Aktion (z.B. 5 s Snackbar "Rückgängig")

Eigene Historie: Liste der letzten Striche, gruppiert nach Tag
Eigener aktueller Stand pro Kategorie diesen Monat

Admin-Panel (Desktop First)
Userverwaltung
Anlegen / Bearbeiten / Deaktivieren (nicht hart löschen, sonst sind historische Striche verwaist)
PIN/Passwort zurücksetzen
Strichlisten-Übersicht
Tabelle: Nutzer × Kategorie, Zeitraum filterbar (heute / Woche / Monat / Custom)
Drilldown pro Nutzer: alle Einzelbuchungen mit Zeitstempel, Quelle (Tap vs. Scan), Produkt
Manuelle Korrektur (Strich nachtragen oder löschen, mit Audit-Eintrag)
Statistiken & Charts (Recharts oder Chart.js)
Konsum pro Kategorie über Zeit (Balken/Linie)
Top-Trinker im Zeitraum
Verlauf pro Tag/Wochentag/Stunde (Heatmap)
Produktverwaltung
Editieren / neu zuordnen
Export
CSV-Export der Strichliste pro Zeitraum (reine Mengen, keine Geldbeträge)
Audit-Log
Wer hat wann manuell etwas geändert/gelöscht

Infrastruktur 
alles soll auf cloudflare infra gehostet werden
-d1 daten bank 
- cloudflare worker app 

UX-Details
Mobile
Daumen-zone-optimiertes Layout: 4 Kacheln im 2×2-Grid, alle erreichbar mit Daumen.
Single-Tap = +1; wer Mehrfach buchen will, tappt mehrfach (Undo-Snackbar fängt Fehler).
Dark-Mode Default (Clubatmosphäre, batterieschonend).
Desktop
Linke Sidebar: Userverwaltung, Strichliste, Stats, Produkte, Audit, Export.
Tabelle mit Sticky-Header, Filterleiste oben.
Charts in Karten daneben, responsiv anordnen.

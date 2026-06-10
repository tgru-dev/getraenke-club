-- Preis pro Kategorie in Cent (NULL = kein Preis hinterlegt, taucht in der
-- Abrechnung dann ohne Betrag auf)
ALTER TABLE categories ADD COLUMN price INTEGER;

-- Finales Loeschen von Mitgliedern: Tombstone statt echtem DELETE, damit
-- historische Buchungen im Getraenke-Log ihren Namen behalten.
-- Geloeschte Mitglieder sind ueberall ausgeblendet (Login, Tresen, Verwaltung).
ALTER TABLE members ADD COLUMN deleted_at INTEGER;

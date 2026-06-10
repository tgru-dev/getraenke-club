-- Mitglieder: werden deaktiviert statt geloescht, damit historische Striche erhalten bleiben.
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mitglied' CHECK (role IN ('mitglied', 'vorstand')),
  color TEXT NOT NULL DEFAULT '#f5a524',
  active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f5a524',
  sort_order INTEGER NOT NULL DEFAULT 0,
  free_text INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Buchungen ("Striche"). Loeschungen erfolgen als Soft-Delete mit Audit-Eintrag.
-- client_id dient der Idempotenz beim Offline-Sync (gleiche Buchung wird nie doppelt angelegt).
CREATE TABLE drinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  note TEXT,
  source TEXT NOT NULL DEFAULT 'mitglied' CHECK (source IN ('mitglied', 'tresen', 'admin')),
  client_id TEXT UNIQUE,
  undo_token TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by INTEGER
);

CREATE INDEX idx_drinks_created ON drinks (created_at);
CREATE INDEX idx_drinks_member ON drinks (member_id, created_at);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Standard-Kategorien aus dem Plan (vom Vorstand spaeter frei aenderbar)
INSERT INTO categories (name, color, sort_order, free_text) VALUES
  ('Bier / Spezi / Radler', '#f5a524', 0, 0),
  ('Mische', '#34d399', 1, 0),
  ('Cola / Sprite / Fanta', '#38bdf8', 2, 0),
  ('Shot', '#f87171', 3, 0),
  ('Sonstiges', '#c084fc', 4, 1);

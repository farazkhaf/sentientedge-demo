PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS snapshot_metadata (id TEXT PRIMARY KEY, label TEXT NOT NULL, version INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS areas (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (
  area_id TEXT NOT NULL REFERENCES areas(id), dimension TEXT NOT NULL,
  score REAL NOT NULL, updated_at TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(area_id, dimension)
);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY, area_id TEXT NOT NULL REFERENCES areas(id), kind TEXT NOT NULL CHECK(kind IN ('news','social')),
  recorded_at TEXT NOT NULL, category TEXT NOT NULL, text TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS records_area_kind_date ON records(area_id, kind, recorded_at);
CREATE TABLE IF NOT EXISTS briefings (
  area_id TEXT NOT NULL, kind TEXT NOT NULL, headline TEXT NOT NULL, summary TEXT NOT NULL,
  themes TEXT NOT NULL CHECK(json_valid(themes)), PRIMARY KEY(area_id, kind)
);
CREATE TABLE IF NOT EXISTS permits (
  area_id TEXT PRIMARY KEY REFERENCES areas(id), count_30d INTEGER NOT NULL, declared_value REAL NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY, longitude REAL NOT NULL, latitude REAL NOT NULL, category TEXT NOT NULL,
  amenity_count INTEGER NOT NULL, radius_m INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS places_category ON places(category);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO settings(key,value) VALUES('demo_state','ai-paused');
CREATE TABLE IF NOT EXISTS ai_reservations (
  id TEXT PRIMARY KEY, session_key TEXT NOT NULL, ip_key TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, tokens INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_usage_session ON ai_reservations(session_key, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_ip ON ai_reservations(ip_key, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_global ON ai_reservations(created_at);
CREATE INDEX IF NOT EXISTS ai_usage_active ON ai_reservations(active, expires_at);

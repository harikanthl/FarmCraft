-- r.md Phase 1 — AUTH + canonical D1 schema.
-- Adds identity (users / sessions / login_codes / farm_members),
-- operational analytics tables (weather_snapshots, ai_insights, sync_state),
-- and the canonical crop_profiles registry (seeded from @farmdots/crop-profiles).

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  locale TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- One-time codes for magic-link email login (15 min TTL recommended).
CREATE TABLE login_codes (
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, code)
);
CREATE INDEX idx_login_codes_email ON login_codes(email);
CREATE INDEX idx_login_codes_expires ON login_codes(expires_at);

-- Per-farm access list with roles (r.md §6).
CREATE TABLE farm_members (
  farm_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','worker','viewer')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (farm_id, user_id)
);
CREATE INDEX idx_farm_members_user ON farm_members(user_id);

-- Periodic weather captures for analytics replay (r.md §13).
CREATE TABLE weather_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  temp_c REAL,
  humidity REAL,
  wind_ms REAL,
  precipitation_mm REAL,
  condition TEXT,
  source TEXT,
  raw_json TEXT
);
CREATE INDEX idx_weather_snapshots_farm_time ON weather_snapshots(farm_id, captured_at DESC);

-- AI / analytics insight rows (r.md §21).
CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT,
  summary TEXT NOT NULL,
  payload_json TEXT,
  generated_at INTEGER NOT NULL
);
CREATE INDEX idx_ai_insights_farm_time ON ai_insights(farm_id, generated_at DESC);

-- Per-device sync watermarks (r.md §8). Phase 2 sync engine will use this; we
-- create the table now so the schema is stable.
CREATE TABLE sync_state (
  device_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  last_pushed_at INTEGER NOT NULL DEFAULT 0,
  last_pulled_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_sync_state_user ON sync_state(user_id);

-- Canonical crop registry (r.md §14). Seeded from @farmdots/crop-profiles.
CREATE TABLE crop_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  ideal_plant_spacing_m REAL NOT NULL,
  ideal_row_spacing_m REAL NOT NULL,
  watering_hint TEXT NOT NULL,
  high_humidity_risk_months TEXT NOT NULL,
  disease_risks TEXT NOT NULL,
  expected_yield_range TEXT NOT NULL,
  visual_theme TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO crop_profiles (id, name, ideal_plant_spacing_m, ideal_row_spacing_m, watering_hint, high_humidity_risk_months, disease_risks, expected_yield_range, visual_theme, updated_at) VALUES
  ('mango', 'Mango', 10.0, 12.0,
    'Deep, infrequent irrigation once fruit is set; reduce before harvest.',
    '[6,7,8,9,10]',
    '["anthracnose","powdery mildew","bacterial black spot"]',
    'Highly variable by age and variety — plan by tree canopy load.',
    'orchard', strftime('%s','now') * 1000),
  ('banana', 'Banana', 2.5, 3.0,
    'Consistent soil moisture; avoid long dry spells between sucker cycles.',
    '[5,6,7,8,9,10,11]',
    '["Panama disease","Sigatoka leaf spot","bunchy top"]',
    'Bunch weight per mat — track by mat age.',
    'tropical', strftime('%s','now') * 1000),
  ('coconut', 'Coconut', 7.5, 9.0,
    'Coastal sandy soils need steady moisture; inland: basin irrigation in dry months.',
    '[6,7,8,9]',
    '["bud rot","leaf rot","red palm weevil (monitor)"]',
    'Nuts per palm per year increases with maturity to a plateau.',
    'tropical', strftime('%s','now') * 1000),
  ('chili', 'Chili', 0.45, 1.2,
    'Even moisture during flowering; reduce humidity in canopy where possible.',
    '[7,8,9,10]',
    '["die-back / anthracnose","bacterial wilt","mite pressure in heat"]',
    'Per plant fresh weight — row density drives totals.',
    'row', strftime('%s','now') * 1000),
  ('guava', 'Guava', 5.0, 6.0,
    'Avoid waterlogging; light, frequent irrigation in fruiting season.',
    '[6,7,8,9,10]',
    '["fruit fly","algal leaf spot","wilt"]',
    'Per tree by canopy management and pruning cycle.',
    'orchard', strftime('%s','now') * 1000),
  ('papaya', 'Papaya', 2.0, 2.5,
    'Regular moisture; very sensitive to standing water — slope or beds.',
    '[6,7,8,9]',
    '["ringspot virus (vector control)","Phytophthora root rot","powdery mildew"]',
    'Short cycle — plan replacement stools.',
    'row', strftime('%s','now') * 1000);

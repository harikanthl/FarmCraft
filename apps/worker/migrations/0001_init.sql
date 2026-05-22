CREATE TABLE farms (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  polygon_json TEXT NOT NULL,
  irrigation_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL,
  source_device_id TEXT
);

CREATE INDEX idx_farms_owner ON farms(owner_id);

CREATE TABLE rows (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  valve_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_rows_farm ON rows(farm_id);

CREATE TABLE plants (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  label TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  crop_type TEXT NOT NULL,
  planted_date INTEGER,
  age REAL,
  yearly_yield REAL,
  health_status TEXT NOT NULL,
  watering_issues TEXT,
  disease_issues TEXT,
  drip_issues TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL,
  source_device_id TEXT
);

CREATE INDEX idx_plants_farm ON plants(farm_id);
CREATE INDEX idx_plants_row ON plants(row_id);

CREATE TABLE valves (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  connected_rows TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL,
  source_device_id TEXT
);

CREATE INDEX idx_valves_farm ON valves(farm_id);

CREATE TABLE irrigation_events (
  id TEXT PRIMARY KEY NOT NULL,
  valve_id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  issue TEXT,
  notes TEXT
);

CREATE INDEX idx_irrigation_farm ON irrigation_events(farm_id);

CREATE TABLE disease_events (
  id TEXT PRIMARY KEY NOT NULL,
  plant_id TEXT NOT NULL,
  disease_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  treatment TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_disease_plant ON disease_events(plant_id);

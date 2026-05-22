CREATE TABLE farm_events (
  id TEXT PRIMARY KEY NOT NULL,
  farm_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_start INTEGER NOT NULL,
  event_end INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT,
  row_ids TEXT NOT NULL DEFAULT '[]',
  valve_ids TEXT NOT NULL DEFAULT '[]',
  plant_ids TEXT NOT NULL DEFAULT '[]',
  crop_type TEXT,
  weather_dependent INTEGER,
  priority TEXT,
  status TEXT NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL,
  source_device_id TEXT
);

CREATE INDEX idx_farm_events_farm ON farm_events(farm_id);
CREATE INDEX idx_farm_events_start ON farm_events(event_start);

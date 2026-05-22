-- r.md Phase 2.1 — sync metadata for soft-delete + watermark cursors.
--
-- Adds `deleted_at` (nullable) + `last_synced_at` to every entity table; an
-- index on `updated_at` for `WHERE updated_at > ?` cursor scans; and indexes
-- on `deleted_at` so pulls can include tombstones efficiently.

ALTER TABLE farms ADD COLUMN deleted_at INTEGER;
ALTER TABLE farms ADD COLUMN last_synced_at INTEGER;
CREATE INDEX idx_farms_updated ON farms(updated_at);

ALTER TABLE rows ADD COLUMN deleted_at INTEGER;
ALTER TABLE rows ADD COLUMN last_synced_at INTEGER;
ALTER TABLE rows ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rows ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rows ADD COLUMN source_device_id TEXT;
CREATE INDEX idx_rows_updated ON rows(updated_at);

ALTER TABLE plants ADD COLUMN deleted_at INTEGER;
ALTER TABLE plants ADD COLUMN last_synced_at INTEGER;
CREATE INDEX idx_plants_updated ON plants(updated_at);

ALTER TABLE valves ADD COLUMN deleted_at INTEGER;
ALTER TABLE valves ADD COLUMN last_synced_at INTEGER;
CREATE INDEX idx_valves_updated ON valves(updated_at);

-- irrigation_events / disease_events were event-style rows without updatedAt/version.
-- Add them so a single push/pull path works uniformly.
ALTER TABLE irrigation_events ADD COLUMN deleted_at INTEGER;
ALTER TABLE irrigation_events ADD COLUMN last_synced_at INTEGER;
ALTER TABLE irrigation_events ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE irrigation_events ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE irrigation_events ADD COLUMN source_device_id TEXT;
CREATE INDEX idx_irrigation_updated ON irrigation_events(updated_at);

ALTER TABLE disease_events ADD COLUMN deleted_at INTEGER;
ALTER TABLE disease_events ADD COLUMN last_synced_at INTEGER;
ALTER TABLE disease_events ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE disease_events ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE disease_events ADD COLUMN source_device_id TEXT;
CREATE INDEX idx_disease_updated ON disease_events(updated_at);

ALTER TABLE farm_events ADD COLUMN deleted_at INTEGER;
ALTER TABLE farm_events ADD COLUMN last_synced_at INTEGER;
CREATE INDEX idx_farm_events_updated ON farm_events(updated_at);

-- Backfill updated_at for the legacy event tables so the watermark cursor
-- gives them a baseline (created_at, or started_at) to count from.
UPDATE rows
   SET updated_at = COALESCE(created_at, 0)
 WHERE updated_at = 0;

UPDATE irrigation_events
   SET updated_at = COALESCE(ended_at, started_at, 0)
 WHERE updated_at = 0;

UPDATE disease_events
   SET updated_at = COALESCE(created_at, 0)
 WHERE updated_at = 0;

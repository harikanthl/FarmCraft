/**
 * Per-collection conflict resolution strategies (r.md §8).
 *
 *   | Entity              | Strategy        |
 *   | ------------------- | --------------- |
 *   | notes / text fields | latest wins     |
 *   | geometry            | manual merge    |
 *   | operations / events | field-level merge |
 *   | overlays            | local-first     |
 *
 * Detection: if `local.updatedAt > local.lastSyncedAt` AND
 * `remote.updatedAt  > local.lastSyncedAt`, both diverged after the last sync
 * and we must apply the strategy. Otherwise the newer side wins outright.
 */
import type { FarmDotsDatabase } from "@/db/types";

import type { SyncCollectionName } from "./mutationGateway";

type RxLike = {
  toJSON: () => Record<string, unknown>;
  remove: () => Promise<unknown>;
  incrementalModify: (
    fn: (old: Record<string, unknown>) => Record<string, unknown>,
  ) => Promise<unknown>;
};

type CollectionStrategy = "geometryNotes" | "operations" | "overlays" | "geometryOverlay";

/** Which fields on a doc are geometric and need manual-merge protection. */
const GEOMETRY_FIELDS: Record<SyncCollectionName, readonly string[]> = {
  farms: ["polygonJson"],
  rows: [],
  plants: ["lat", "lng"],
  valves: ["lat", "lng"],
  irrigation_events: [],
  disease_events: [],
  farm_events: [],
};

const STRATEGY: Record<SyncCollectionName, CollectionStrategy> = {
  farms: "geometryNotes",
  rows: "operations",
  plants: "geometryNotes",
  valves: "geometryOverlay",
  irrigation_events: "operations",
  disease_events: "operations",
  farm_events: "operations",
};

/**
 * Field-level merge for `operations` style entities: pick the latest non-null
 * value per key by comparing each side's snapshot when they conflict. Status
 * transitions follow `planned -> in_progress -> completed|skipped` order.
 */
const STATUS_ORDER: Record<string, number> = {
  planned: 0,
  in_progress: 1,
  completed: 2,
  skipped: 2,
  missed: 2,
};

export function mergeFields(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...local };
  for (const key of Object.keys(remote)) {
    const lv = local[key];
    const rv = remote[key];
    if (rv === undefined) continue;
    if (key === "status") {
      const lOrder = typeof lv === "string" ? (STATUS_ORDER[lv] ?? 0) : 0;
      const rOrder = typeof rv === "string" ? (STATUS_ORDER[rv] ?? 0) : 0;
      out[key] = rOrder >= lOrder ? rv : lv;
      continue;
    }
    if (lv === undefined || lv === null) {
      out[key] = rv;
      continue;
    }
    // Latest non-null wins per-field; we don't have field-level timestamps so
    // we fall back to the doc-level `updatedAt` which the caller already used.
    out[key] = rv;
  }
  return out;
}

export async function applyPullDoc(
  db: FarmDotsDatabase,
  collection: SyncCollectionName,
  remote: Record<string, unknown>,
): Promise<void> {
  const docId = String(remote.id);
  if (!docId) return;
  // Union-typed access; the per-collection schema doesn't matter for the
  // sync layer so we operate on generic plain JSON shapes.
  const col = db[collection] as unknown as {
    findOne: (id: string) => { exec: () => Promise<RxLike | null> };
    upsert: (doc: Record<string, unknown>) => Promise<unknown>;
  };
  const localRx = await col.findOne(docId).exec();
  const localData = localRx?.toJSON?.() as Record<string, unknown> | undefined;

  // Apply tombstones: hard-delete locally so the doc disappears.
  if (remote.deletedAt != null) {
    if (localRx) await localRx.remove();
    return;
  }

  if (!localData) {
    const stamped = { ...remote, lastSyncedAt: Date.now() };
    await col.upsert(stamped);
    return;
  }

  const localUpdated = numberOr(localData.updatedAt, 0);
  const localSynced = numberOr(localData.lastSyncedAt, 0);
  const remoteUpdated = numberOr(remote.updatedAt, 0);
  const localDirty = localUpdated > localSynced;
  const remoteDirty = remoteUpdated > localSynced;

  if (!remoteDirty) return; // remote is older than our last sync; ignore.
  if (!localDirty) {
    const stamped = { ...remote, lastSyncedAt: Date.now() };
    await col.upsert(stamped);
    return;
  }

  // Both sides diverged — apply per-collection strategy.
  const strategy = STRATEGY[collection];
  switch (strategy) {
    case "geometryNotes":
      await resolveGeometry(db, collection, col, localData, remote);
      return;
    case "geometryOverlay":
      await resolveGeometryOverlay(db, collection, col, localData, remote);
      return;
    case "operations": {
      const merged = mergeFields(localData, remote);
      merged.lastSyncedAt = Date.now();
      merged.version = Math.max(
        numberOr(localData.version, 1),
        numberOr(remote.version, 1),
      );
      merged.updatedAt = Math.max(localUpdated, remoteUpdated);
      await col.upsert(merged);
      return;
    }
    case "overlays":
      if (localRx) {
        await localRx.incrementalModify((old) => ({
          ...old,
          lastSyncedAt: Date.now(),
        }));
      }
      return;
  }
}

async function resolveGeometry(
  db: FarmDotsDatabase,
  collection: SyncCollectionName,
  col: { upsert: (doc: Record<string, unknown>) => Promise<unknown> },
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Promise<void> {
  const geomFields = GEOMETRY_FIELDS[collection];
  const conflictingGeom = geomFields.some((f) => !shallowEqual(local[f], remote[f]));

  const merged: Record<string, unknown> = { ...local };
  for (const key of Object.keys(remote)) {
    if (geomFields.includes(key)) continue;
    merged[key] = remote[key];
  }
  merged.updatedAt = Date.now();
  merged.version = Math.max(numberOr(local.version, 1), numberOr(remote.version, 1)) + 1;
  merged.lastSyncedAt = Date.now();
  await col.upsert(merged);

  if (conflictingGeom) {
    await enqueueConflict(db, collection, String(local.id), local, remote, geomFields.join(","));
  }
}

async function resolveGeometryOverlay(
  db: FarmDotsDatabase,
  collection: SyncCollectionName,
  col: { upsert: (doc: Record<string, unknown>) => Promise<unknown> },
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Promise<void> {
  const geomFields = GEOMETRY_FIELDS[collection];
  const overlayFields = ["connectedRows"];
  const conflictingGeom = geomFields.some((f) => !shallowEqual(local[f], remote[f]));
  const merged: Record<string, unknown> = { ...local };
  for (const key of Object.keys(remote)) {
    if (geomFields.includes(key)) continue;
    if (overlayFields.includes(key)) continue;
    merged[key] = remote[key];
  }
  merged.updatedAt = Date.now();
  merged.version = Math.max(numberOr(local.version, 1), numberOr(remote.version, 1)) + 1;
  merged.lastSyncedAt = Date.now();
  await col.upsert(merged);
  if (conflictingGeom) {
    await enqueueConflict(db, collection, String(local.id), local, remote, geomFields.join(","));
  }
}

async function enqueueConflict(
  db: FarmDotsDatabase,
  collection: SyncCollectionName,
  docId: string,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  field: string,
): Promise<void> {
  const id = `${collection}:${docId}:${Date.now()}`;
  await db.pending_conflicts.insert({
    id,
    collection,
    docId,
    localJson: JSON.stringify(local),
    remoteJson: JSON.stringify(remote),
    field,
    createdAt: Date.now(),
    status: "pending",
  } as unknown as Record<string, unknown>);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "number" && typeof b === "number") return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

import type { RxJsonSchema } from "rxdb";

/** Sync metadata shared by every operational entity (r.md §8 Phase 2). */
const syncFields = {
  updatedAt: { type: "number", minimum: 0, multipleOf: 1 },
  version: { type: "number", minimum: 1, multipleOf: 1 },
  sourceDeviceId: { type: "string", maxLength: 128 },
  /** Soft-delete tombstone (unix ms). Documents with `deletedAt` set are filtered from UI lists but kept locally so the next push can propagate the delete. */
  deletedAt: { type: "number", minimum: 0, multipleOf: 1 },
  /** Set when the row was last acknowledged by the server. Used by the sync engine to detect dirty docs (updatedAt > lastSyncedAt). */
  lastSyncedAt: { type: "number", minimum: 0, multipleOf: 1 },
};

export const farmSchema: RxJsonSchema<any> = {
  title: "farm",
  /** v2 bump: adds deletedAt + lastSyncedAt (Phase 2 sync metadata). */
  version: 2,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    ownerId: { type: "string", maxLength: 128 },
    name: { type: "string", maxLength: 256 },
    polygonJson: { type: "string", maxLength: 1_000_000 },
    irrigationType: { type: "string", maxLength: 32 },
    primaryCropId: { type: "string", maxLength: 64 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    ...syncFields,
  },
  required: ["id", "ownerId", "name", "polygonJson", "irrigationType", "createdAt", "updatedAt", "version"],
  indexes: ["ownerId"],
};

export const rowSchema: RxJsonSchema<any> = {
  title: "row",
  /** v1: row gains the standard sync metadata so the queue / cursor can treat it like every other entity. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    farmId: { type: "string", maxLength: 40 },
    name: { type: "string", maxLength: 256 },
    orderIndex: { type: "number", minimum: 0, multipleOf: 1 },
    valveIds: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", maxLength: 40 },
    },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    ...syncFields,
  },
  required: ["id", "farmId", "name", "orderIndex", "valveIds", "createdAt"],
  indexes: ["farmId"],
};

export const plantSchema: RxJsonSchema<any> = {
  title: "plant",
  /** v1: adds deletedAt + lastSyncedAt for Phase 2 sync. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    farmId: { type: "string", maxLength: 40 },
    rowId: { type: "string", maxLength: 40 },
    label: { type: "string", maxLength: 256 },
    lat: { type: "number" },
    lng: { type: "number" },
    cropType: { type: "string", maxLength: 128 },
    plantedDate: { type: "number", minimum: 0, multipleOf: 1 },
    age: { type: "number" },
    yearlyYield: { type: "number" },
    healthStatus: { type: "string", maxLength: 32 },
    wateringIssues: { type: "string", maxLength: 4000 },
    diseaseIssues: { type: "string", maxLength: 4000 },
    dripIssues: { type: "string", maxLength: 4000 },
    notes: { type: "string", maxLength: 8000 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    ...syncFields,
  },
  required: [
    "id",
    "farmId",
    "rowId",
    "label",
    "lat",
    "lng",
    "cropType",
    "healthStatus",
    "createdAt",
    "updatedAt",
    "version",
  ],
  indexes: ["farmId", "rowId"],
};

export const valveSchema: RxJsonSchema<any> = {
  title: "valve",
  /** v1: adds deletedAt + lastSyncedAt for Phase 2 sync. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    farmId: { type: "string", maxLength: 40 },
    name: { type: "string", maxLength: 256 },
    lat: { type: "number" },
    lng: { type: "number" },
    connectedRows: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", maxLength: 40 },
    },
    status: { type: "string", maxLength: 32 },
    notes: { type: "string", maxLength: 4000 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    ...syncFields,
  },
  required: ["id", "farmId", "name", "lat", "lng", "connectedRows", "status", "createdAt", "updatedAt", "version"],
  indexes: ["farmId"],
};

export const irrigationEventSchema: RxJsonSchema<any> = {
  title: "irrigation_event",
  /** v1: adds sync metadata for Phase 2 queue + cursor. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    valveId: { type: "string", maxLength: 40 },
    farmId: { type: "string", maxLength: 40 },
    startedAt: { type: "number", minimum: 0, multipleOf: 1 },
    endedAt: { type: "number", minimum: 0, multipleOf: 1 },
    issue: { type: "string", maxLength: 4000 },
    notes: { type: "string", maxLength: 4000 },
    ...syncFields,
  },
  required: ["id", "valveId", "farmId", "startedAt"],
  indexes: ["farmId", "valveId"],
};

export const diseaseEventSchema: RxJsonSchema<any> = {
  title: "disease_event",
  /** v1: adds sync metadata for Phase 2 queue + cursor. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    plantId: { type: "string", maxLength: 40 },
    diseaseType: { type: "string", maxLength: 256 },
    severity: { type: "string", maxLength: 16 },
    treatment: { type: "string", maxLength: 4000 },
    notes: { type: "string", maxLength: 4000 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    ...syncFields,
  },
  required: ["id", "plantId", "diseaseType", "severity", "createdAt"],
  indexes: ["plantId"],
};

export const pendingVoiceOperationSchema: RxJsonSchema<any> = {
  title: "pending_voice_operation",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    farmId: { type: "string", maxLength: 40 },
    transcript: { type: "string", maxLength: 8000 },
    locale: { type: "string", maxLength: 16 },
    intentJson: { type: "string", maxLength: 16000 },
    status: { type: "string", maxLength: 16 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    updatedAt: { type: "number", minimum: 0, multipleOf: 1 },
    version: { type: "number", minimum: 1, multipleOf: 1 },
  },
  required: ["id", "transcript", "locale", "intentJson", "status", "createdAt", "updatedAt", "version"],
  indexes: ["farmId", "status"],
};

export const farmEventCollectionSchema: RxJsonSchema<any> = {
  title: "farm_event",
  /** v1: adds deletedAt + lastSyncedAt for Phase 2 sync. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    farmId: { type: "string", maxLength: 40 },
    type: { type: "string", maxLength: 48 },
    title: { type: "string", maxLength: 512 },
    description: { type: "string", maxLength: 8000 },
    start: { type: "number", minimum: 0, multipleOf: 1 },
    end: { type: "number", minimum: 0, multipleOf: 1 },
    allDay: { type: "boolean" },
    recurrenceRule: { type: "string", maxLength: 4000 },
    rowIds: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", maxLength: 40 },
    },
    valveIds: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", maxLength: 40 },
    },
    plantIds: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", maxLength: 40 },
    },
    cropType: { type: "string", maxLength: 128 },
    weatherDependent: { type: "boolean" },
    priority: { type: "string", maxLength: 16 },
    status: { type: "string", maxLength: 24 },
    completedAt: { type: "number", minimum: 0, multipleOf: 1 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    ...syncFields,
  },
  required: ["id", "farmId", "type", "title", "start", "end", "allDay", "status", "createdAt", "updatedAt", "version"],
  indexes: ["farmId", "start"],
};

/**
 * Phase 2 outbound queue. One row per pending mutation; the sync engine
 * drains it to `/api/v1/sync/push` in arrival order with exponential backoff.
 * `snapshotJson` is the full doc payload at the time of enqueue so we don't
 * race with later edits while the request is in flight.
 */
export const pendingSyncOperationSchema: RxJsonSchema<any> = {
  title: "pending_sync_operation",
  /** v1: `id` is `${collection}:${docId}` (e.g. `plants:<uuid>`), longer than entity ids alone. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },
    collection: { type: "string", maxLength: 64 },
    op: { type: "string", maxLength: 16 },
    docId: { type: "string", maxLength: 64 },
    snapshotJson: { type: "string", maxLength: 2_000_000 },
    deviceId: { type: "string", maxLength: 128 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    attempts: { type: "number", minimum: 0, multipleOf: 1 },
    lastError: { type: "string", maxLength: 4000 },
    nextAttemptAt: { type: "number", minimum: 0, multipleOf: 1 },
  },
  required: ["id", "collection", "op", "docId", "snapshotJson", "createdAt", "attempts"],
  indexes: ["collection", "createdAt"],
};

/**
 * Phase 2 conflict inbox. Populated by `applyPullBatch` when the geometry or
 * other "manual merge" strategies detect divergence between local and remote
 * versions. The UI lists these for the user to resolve.
 */
export const pendingConflictSchema: RxJsonSchema<any> = {
  title: "pending_conflict",
  /** v1: `id` is `${collection}:${docId}:${timestamp}` — see `enqueueConflict` in sync/conflict.ts. */
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 160 },
    collection: { type: "string", maxLength: 64 },
    docId: { type: "string", maxLength: 64 },
    localJson: { type: "string", maxLength: 2_000_000 },
    remoteJson: { type: "string", maxLength: 2_000_000 },
    field: { type: "string", maxLength: 64 },
    createdAt: { type: "number", minimum: 0, multipleOf: 1 },
    status: { type: "string", maxLength: 16 },
  },
  required: ["id", "collection", "docId", "localJson", "remoteJson", "createdAt", "status"],
  indexes: ["status", "collection"],
};

import { addRxPlugin, createRxDatabase } from "rxdb";
import type { RxDatabase, RxCollection } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import type { FarmDocument } from "./adapters.js";
import {
  diseaseEventSchema,
  farmEventCollectionSchema,
  farmSchema,
  irrigationEventSchema,
  pendingConflictSchema,
  pendingSyncOperationSchema,
  pendingVoiceOperationSchema,
  plantSchema,
  rowSchema,
  valveSchema,
} from "./schemas.js";

addRxPlugin(RxDBMigrationSchemaPlugin);

const storage = wrappedValidateAjvStorage({
  storage: getRxStorageDexie(),
});

export type FarmDotsCollections = {
  farms: RxCollection<FarmDocument>;
  rows: RxCollection<Record<string, unknown>>;
  plants: RxCollection<Record<string, unknown>>;
  valves: RxCollection<Record<string, unknown>>;
  irrigation_events: RxCollection<Record<string, unknown>>;
  disease_events: RxCollection<Record<string, unknown>>;
  farm_events: RxCollection<Record<string, unknown>>;
  pending_voice_operations: RxCollection<Record<string, unknown>>;
  pending_sync_operations: RxCollection<Record<string, unknown>>;
  pending_conflicts: RxCollection<Record<string, unknown>>;
};

export type FarmDotsDatabase = RxDatabase<FarmDotsCollections>;

/**
 * Phase 2 migration helper: adds the new sync-metadata fields with sensible
 * defaults so existing local docs upgrade cleanly without losing state.
 */
function applyPhase2Metadata<T extends Record<string, unknown>>(oldDoc: T): T {
  const next = { ...oldDoc } as Record<string, unknown>;
  if (next.deletedAt === undefined) delete next.deletedAt;
  if (typeof next.lastSyncedAt !== "number") next.lastSyncedAt = 0;
  if (typeof next.updatedAt !== "number") {
    next.updatedAt = (next.createdAt as number | undefined) ?? Date.now();
  }
  if (typeof next.version !== "number") next.version = 1;
  return next as T;
}

export async function createFarmDotsDatabase(): Promise<FarmDotsDatabase> {
  const db = await createRxDatabase<FarmDotsCollections>({
    name: "farmdots",
    storage,
    ignoreDuplicate: true,
  });

  await db.addCollections({
    farms: {
      schema: farmSchema,
      migrationStrategies: {
        1: (oldDoc) => ({ ...oldDoc }),
        2: applyPhase2Metadata,
      },
    },
    rows: {
      schema: rowSchema,
      migrationStrategies: {
        1: applyPhase2Metadata,
      },
    },
    plants: {
      schema: plantSchema,
      migrationStrategies: {
        1: applyPhase2Metadata,
      },
    },
    valves: {
      schema: valveSchema,
      migrationStrategies: {
        1: applyPhase2Metadata,
      },
    },
    irrigation_events: {
      schema: irrigationEventSchema,
      migrationStrategies: {
        1: applyPhase2Metadata,
      },
    },
    disease_events: {
      schema: diseaseEventSchema,
      migrationStrategies: {
        1: applyPhase2Metadata,
      },
    },
    farm_events: {
      schema: farmEventCollectionSchema,
      migrationStrategies: {
        1: applyPhase2Metadata,
      },
    },
    pending_voice_operations: { schema: pendingVoiceOperationSchema },
    pending_sync_operations: {
      schema: pendingSyncOperationSchema,
      migrationStrategies: {
        1: (oldDoc) => oldDoc,
      },
    },
    pending_conflicts: {
      schema: pendingConflictSchema,
      migrationStrategies: {
        1: (oldDoc) => oldDoc,
      },
    },
  });

  return db;
}

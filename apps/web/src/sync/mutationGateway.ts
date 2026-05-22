/**
 * Mutation gateway (r.md §8 Phase 2).
 *
 * Installs RxDB collection hooks that auto-enqueue every local mutation into
 * `pending_sync_operations`. The sync engine drains the queue against the
 * worker. Pull-batches from the server must be wrapped in `withinSyncWrite`
 * so they do NOT echo back into the queue.
 *
 * Why hooks (vs refactoring every call site): keeps the existing write API
 * unchanged. Existing `.upsert()`, `.incrementalModify()`, `.patch()`,
 * `bulkInsert`, `bulkRemove`, and `.find(...).remove()` call paths all flow
 * through `postSave` / `preRemove` and become sync-aware "for free".
 */
import type { FarmDotsDatabase } from "@/db/types";

import { getDeviceId } from "./deviceId";

export const SYNC_COLLECTIONS = [
  "farms",
  "rows",
  "plants",
  "valves",
  "irrigation_events",
  "disease_events",
  "farm_events",
] as const;
export type SyncCollectionName = (typeof SYNC_COLLECTIONS)[number];

/** Counter so nested `withinSyncWrite` blocks (e.g. cascading pull) compose. */
let syncWriteDepth = 0;
export function isWithinSyncWrite(): boolean {
  return syncWriteDepth > 0;
}
export async function withinSyncWrite<T>(fn: () => Promise<T>): Promise<T> {
  syncWriteDepth += 1;
  try {
    return await fn();
  } finally {
    syncWriteDepth -= 1;
  }
}

type PendingOp = {
  id: string;
  collection: string;
  op: "upsert" | "delete";
  docId: string;
  snapshotJson: string;
  deviceId: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt?: number;
  lastError?: string;
};

export function pendingKey(collection: string, docId: string): string {
  return `${collection}:${docId}`;
}

/** Max `${collection}:${docId}` length — must match `pendingSyncOperationSchema` id.maxLength. */
export const PENDING_SYNC_OP_ID_MAX_LENGTH = 128;

let bulkMutationDepth = 0;
const bulkSyncQueue = new Map<string, PendingOp>();

let installed: WeakSet<FarmDotsDatabase> | null = null;

function isWithinBulkMutation(): boolean {
  return bulkMutationDepth > 0;
}

function queuePendingOp(opDoc: PendingOp): void {
  bulkSyncQueue.set(opDoc.id, opDoc);
}

async function flushBulkSyncQueue(db: FarmDotsDatabase): Promise<void> {
  if (bulkSyncQueue.size === 0) return;
  const ops = [...bulkSyncQueue.values()];
  bulkSyncQueue.clear();
  const CHUNK = 500;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const chunk = ops.slice(i, i + CHUNK);
    const result = await db.pending_sync_operations.bulkInsert(chunk as unknown as Record<string, unknown>[]);
    if (result.error.length > 0) {
      throw new Error(`Enqueueing sync operations failed (${result.error.length} write errors).`);
    }
  }
}

/**
 * Batches `pending_sync_operations` writes during large local deletes/inserts
 * instead of one upsert per document hook.
 */
export async function withinBulkMutation<T>(db: FarmDotsDatabase, fn: () => Promise<T>): Promise<T> {
  bulkMutationDepth += 1;
  try {
    return await fn();
  } finally {
    bulkMutationDepth -= 1;
    if (bulkMutationDepth === 0) {
      await flushBulkSyncQueue(db);
    }
  }
}

async function upsertPendingOp(db: FarmDotsDatabase, opDoc: PendingOp): Promise<void> {
  if (isWithinBulkMutation()) {
    queuePendingOp(opDoc);
    return;
  }
  await db.pending_sync_operations.upsert(opDoc as unknown as Record<string, unknown>);
}

/**
 * Idempotent: installs the gateway exactly once per database instance, even if
 * the calling code is hot-reloaded (Vite) or remounted.
 */
export function installMutationGateway(db: FarmDotsDatabase): void {
  if (!installed) installed = new WeakSet();
  if (installed.has(db)) return;
  installed.add(db);

  const deviceId = getDeviceId();

  for (const name of SYNC_COLLECTIONS) {
    const col = db[name];

    col.postSave(async (data: Record<string, unknown>) => {
      if (isWithinSyncWrite()) return;
      const updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : 0;
      const lastSyncedAt = typeof data.lastSyncedAt === "number" ? data.lastSyncedAt : 0;
      if (updatedAt <= lastSyncedAt) return;

      const docId = String(data.id);
      const op: PendingOp["op"] = data.deletedAt ? "delete" : "upsert";
      const pendingId = pendingKey(name, docId);
      const existing = (await db.pending_sync_operations.findOne(pendingId).exec())?.toJSON() as
        | Partial<PendingOp>
        | undefined;
      const opDoc: PendingOp = {
        id: pendingId,
        collection: name,
        op,
        docId,
        snapshotJson: JSON.stringify(data),
        deviceId,
        createdAt: existing?.createdAt ?? Date.now(),
        attempts: 0,
      };
      await upsertPendingOp(db, opDoc);
    }, false);

    col.preRemove(async (data: Record<string, unknown>) => {
      if (isWithinSyncWrite()) return;
      const docId = String(data.id);
      const pendingId = pendingKey(name, docId);
      const tombstone = {
        ...data,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        version: (typeof data.version === "number" ? data.version : 0) + 1,
        sourceDeviceId: deviceId,
      };
      const opDoc: PendingOp = {
        id: pendingId,
        collection: name,
        op: "delete",
        docId,
        snapshotJson: JSON.stringify(tombstone),
        deviceId,
        createdAt: Date.now(),
        attempts: 0,
      };
      await upsertPendingOp(db, opDoc);
    }, false);
  }
}

/** Stamp sync metadata when callers do their own writes. Convenience used by
 * `withMutationMeta(doc).then(col.upsert)` style code; existing `.incrementalModify`
 * call sites continue to set `updatedAt` + `version` inline. */
export function withMutationMeta<T extends Record<string, unknown>>(doc: T, deviceId?: string): T {
  const did = deviceId ?? getDeviceId();
  return {
    ...doc,
    updatedAt: Date.now(),
    version: (typeof doc.version === "number" ? doc.version : 0) + 1,
    sourceDeviceId: did,
  } as T;
}

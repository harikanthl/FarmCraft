/**
 * Phase 2 sync engine. Drains `pending_sync_operations` and pulls incremental
 * changes via watermark cursors.
 *
 * Push path:
 *   1. Group ready ops by `(collection, op)`; oldest first.
 *   2. POST each batch to `/api/v1/sync/push`.
 *   3. On success: stamp `lastSyncedAt` on the source doc and delete the queue
 *      row. On failure: bump `attempts`, schedule next retry with exponential
 *      backoff. 401s clear the token (handled by the caller).
 *
 * Pull path:
 *   1. For each sync collection, GET `/api/v1/sync/pull?collection=&since=&cursor=`.
 *   2. Apply each remote doc via `withinSyncWrite(() => col.upsert(...))` so the
 *      mutation gateway does not echo it back. Tombstones (`deletedAt != null`)
 *      hard-delete the local row.
 *   3. Persist the next cursor + D1 bookmark.
 */
import type { FarmDotsDatabase } from "@/db/types";

import { AUTH_TOKEN_KEY, UnauthorizedError } from "@/auth/authClient";
import { getDeviceId } from "./deviceId";
import {
  loadAllCursors,
  loadBookmark,
  saveBookmark,
  saveCursor,
  type CursorMap,
} from "./cursors";
import { applyPullDoc } from "./conflict";
import { SYNC_COLLECTIONS, type SyncCollectionName, withinSyncWrite } from "./mutationGateway";

const PUSH_BATCH = 50;
const BACKOFF_STEPS_MS = [1000, 5000, 15000, 60000, 300000];

type PendingOp = {
  id: string;
  collection: SyncCollectionName;
  op: "upsert" | "delete";
  docId: string;
  snapshotJson: string;
  deviceId: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt?: number;
  lastError?: string;
};

export type SyncStatus =
  | { kind: "idle" }
  | { kind: "syncing"; pending: number }
  | { kind: "error"; message: string; pending: number }
  | { kind: "offline" };

type Listener = (status: SyncStatus) => void;

function authHeaders(): HeadersInit {
  const t = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

export class SyncEngine {
  private status: SyncStatus = { kind: "idle" };
  private listeners = new Set<Listener>();
  private running = false;
  private pendingRerun = false;

  constructor(private db: FarmDotsDatabase) {}

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  current(): SyncStatus {
    return this.status;
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  /** Manual / triggered entry point. Coalesces concurrent calls. */
  async runOnce(): Promise<void> {
    if (this.running) {
      this.pendingRerun = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.pendingRerun = false;
        await this.runInner();
      } while (this.pendingRerun);
    } finally {
      this.running = false;
    }
  }

  private async runInner(): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const pending = await this.pendingCount();
      this.setStatus(pending > 0 ? { kind: "offline" } : { kind: "idle" });
      return;
    }
    const pending = await this.pendingCount();
    this.setStatus({ kind: "syncing", pending });
    try {
      await this.drainPush();
      await this.pull();
      const after = await this.pendingCount();
      this.setStatus(after > 0 ? { kind: "syncing", pending: after } : { kind: "idle" });
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      const after = await this.pendingCount();
      this.setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        pending: after,
      });
    }
  }

  private async pendingCount(): Promise<number> {
    const docs = await this.db.pending_sync_operations.find().exec();
    return docs.length;
  }

  private async drainPush(): Promise<void> {
    const now = Date.now();
    const all = (await this.db.pending_sync_operations.find().exec()).map(
      (d) => d.toJSON() as PendingOp,
    );
    const ready = all
      .filter((o) => (o.nextAttemptAt ?? 0) <= now)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (ready.length === 0) return;

    // Group by collection so we hit /sync/push once per (collection) per loop.
    const groups = new Map<SyncCollectionName, PendingOp[]>();
    for (const op of ready) {
      const list = groups.get(op.collection) ?? [];
      list.push(op);
      groups.set(op.collection, list);
    }

    for (const [collection, ops] of groups) {
      for (let i = 0; i < ops.length; i += PUSH_BATCH) {
        const batch = ops.slice(i, i + PUSH_BATCH);
        try {
          await this.pushBatch(collection, batch);
        } catch (err) {
          if (err instanceof UnauthorizedError) throw err;
          await this.markFailures(batch, err);
        }
      }
    }
  }

  private async pushBatch(collection: SyncCollectionName, batch: PendingOp[]): Promise<void> {
    const payload = {
      collection,
      deviceId: getDeviceId(),
      ops: batch.map((o) => ({
        op: o.op,
        docId: o.docId,
        doc: JSON.parse(o.snapshotJson) as Record<string, unknown>,
      })),
      // Legacy support — push v1 callers still send `docs`.
      docs: batch.map((o) => JSON.parse(o.snapshotJson) as Record<string, unknown>),
    };
    const res = await fetch("/api/v1/sync/push", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(`push ${collection}: ${await res.text()}`);
    const ackedAt = Date.now();
    // Mark each source doc as synced + remove the queue row.
    await withinSyncWrite(async () => {
      for (const op of batch) {
        if (op.op === "upsert") {
          const col = this.db[collection] as unknown as {
            findOne: (id: string) => {
              exec: () => Promise<{
                incrementalModify: (
                  fn: (old: Record<string, unknown>) => Record<string, unknown>,
                ) => Promise<unknown>;
              } | null>;
            };
          };
          const doc = await col.findOne(op.docId).exec();
          if (doc) {
            await doc.incrementalModify((old) => ({
              ...old,
              lastSyncedAt: ackedAt,
            }));
          }
        }
        await this.db.pending_sync_operations.findOne(op.id).remove();
      }
    });
  }

  private async markFailures(batch: PendingOp[], err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    const now = Date.now();
    for (const op of batch) {
      const stepIdx = Math.min(op.attempts, BACKOFF_STEPS_MS.length - 1);
      const nextAttemptAt = now + BACKOFF_STEPS_MS[stepIdx];
      await this.db.pending_sync_operations.upsert({
        ...op,
        attempts: op.attempts + 1,
        nextAttemptAt,
        lastError: message,
      } as unknown as Record<string, unknown>);
    }
  }

  private async pull(): Promise<void> {
    const cursors: CursorMap = await loadAllCursors();
    const bookmark = await loadBookmark();
    let nextBookmark = bookmark;
    for (const collection of SYNC_COLLECTIONS) {
      const since = cursors[collection] ?? 0;
      const url = `/api/v1/sync/pull?collection=${encodeURIComponent(collection)}&since=${since}`;
      const headers: Record<string, string> = { ...(authHeaders() as Record<string, string>) };
      if (nextBookmark) headers["x-d1-bookmark"] = nextBookmark;
      const res = await fetch(url, { headers });
      if (res.status === 401) throw new UnauthorizedError();
      if (!res.ok) throw new Error(`pull ${collection}: ${await res.text()}`);
      const echoed = res.headers.get("x-d1-bookmark");
      if (echoed) nextBookmark = echoed;
      const body = (await res.json()) as {
        docs: Record<string, unknown>[];
        nextCursor?: number;
      };
      await this.applyPullDocs(collection, body.docs);
      if (typeof body.nextCursor === "number") {
        await saveCursor(collection, body.nextCursor);
      }
    }
    if (nextBookmark && nextBookmark !== bookmark) await saveBookmark(nextBookmark);
  }

  private async applyPullDocs(
    collection: SyncCollectionName,
    docs: Record<string, unknown>[],
  ): Promise<void> {
    if (docs.length === 0) return;
    await withinSyncWrite(async () => {
      for (const remote of docs) {
        await applyPullDoc(this.db, collection, remote);
      }
    });
  }
}

let singleton: SyncEngine | null = null;

export function getSyncEngine(db: FarmDotsDatabase): SyncEngine {
  if (!singleton) singleton = new SyncEngine(db);
  return singleton;
}

/**
 * Watermark cursors (r.md §8 / §9). Per-collection `last_pulled_at` timestamps
 * persisted in localStorage so the next pull only fetches rows updated since
 * the previous fetch. The D1 Sessions API bookmark travels alongside on a
 * separate key so read-replica routing stays consistent.
 *
 * Keys are namespaced by the active auth token (falling back to the device id)
 * so multiple users on the same browser don't collide.
 */
import { AUTH_TOKEN_KEY } from "@/auth/authClient";

import { getDeviceId } from "./deviceId";
import { SYNC_COLLECTIONS, type SyncCollectionName } from "./mutationGateway";

export type CursorMap = Partial<Record<SyncCollectionName, number>>;

const CURSOR_KEY = "farmdots_sync_cursors";
const BOOKMARK_KEY = "farmdots_d1_bookmark";

function namespace(): string {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  return token ? `auth:${token.slice(0, 8)}` : `device:${getDeviceId().slice(0, 8)}`;
}

function fullKey(base: string): string {
  return `${base}:${namespace()}`;
}

export async function loadAllCursors(): Promise<CursorMap> {
  if (typeof localStorage === "undefined") return {};
  const raw = localStorage.getItem(fullKey(CURSOR_KEY));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: CursorMap = {};
    for (const name of SYNC_COLLECTIONS) {
      const v = parsed[name];
      if (typeof v === "number" && Number.isFinite(v)) out[name] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveCursor(collection: SyncCollectionName, value: number): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const current = await loadAllCursors();
  current[collection] = value;
  localStorage.setItem(fullKey(CURSOR_KEY), JSON.stringify(current));
}

export async function resetCursors(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(fullKey(CURSOR_KEY));
  localStorage.removeItem(fullKey(BOOKMARK_KEY));
}

export async function loadBookmark(): Promise<string | null> {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(fullKey(BOOKMARK_KEY));
}

export async function saveBookmark(bookmark: string): Promise<void> {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(fullKey(BOOKMARK_KEY), bookmark);
}

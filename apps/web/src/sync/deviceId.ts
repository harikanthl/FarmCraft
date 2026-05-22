/**
 * Stable per-install device identifier (r.md §8).
 *
 * Persisted in localStorage on first use. The worker stamps every mutation
 * with the originating device so we can ignore echoes during pull and so the
 * `sync_state` table tracks watermarks per device.
 */
const STORAGE_KEY = "farmdots_device_id";

export function getDeviceId(): string {
  if (typeof localStorage === "undefined") {
    // Workers / SSR fallback — return a per-instance ephemeral id.
    return `ephemeral-${Math.random().toString(36).slice(2)}`;
  }
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing && existing.length > 0) return existing;
  const id = crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* Storage might be denied (Safari private). Use the in-memory id instead. */
  }
  return id;
}

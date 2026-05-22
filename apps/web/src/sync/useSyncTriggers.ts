/**
 * Phase 2.5 — auto-sync triggers.
 *
 * The sync engine runs on:
 *   - mount (initial pull)
 *   - window focus (catch up after sleep)
 *   - `online` event (immediately drain pending mutations)
 *   - 60s interval while the tab is foreground
 *
 * Hidden tabs are skipped — Service Worker / Background Sync would be the
 * follow-up if we need a true offline-first push path. For now the queue
 * persists and drains the next time the user lands on a foreground tab.
 */
import { useEffect } from "react";

import type { FarmDotsDatabase } from "@/db/types";
import { useAuth } from "@/auth/AuthContext";
import { getSyncEngine } from "./SyncEngine";

const INTERVAL_MS = 60_000;

export function useSyncTriggers(db: FarmDotsDatabase | null): void {
  const auth = useAuth();
  useEffect(() => {
    if (!db) return;
    if (!auth.isAuthed) return; // No point pulling/pushing while signed out.

    const engine = getSyncEngine(db);
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void engine.runOnce().catch(() => {
        /* state surfaced via engine.on() */
      });
    };

    run(); // initial

    const onFocus = () => run();
    const onOnline = () => run();
    const onVisible = () => {
      if (!document.hidden) run();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(run, INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [db, auth.isAuthed]);
}

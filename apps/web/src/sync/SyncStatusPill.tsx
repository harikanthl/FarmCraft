/**
 * Phase 2.5 sync status pill (header). Visualises the SyncEngine state and
 * doubles as the manual trigger so users can still force a sync.
 *
 *   idle      → green dot + "Synced"
 *   syncing   → spinner + "Syncing N…"
 *   error     → red dot + message (tooltip)
 *   offline   → amber dot + "Offline"
 */
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { FarmDotsDatabase } from "@/db/types";
import { getSyncEngine, type SyncStatus } from "./SyncEngine";
import { UnauthorizedError } from "@/auth/authClient";
import { useAuth } from "@/auth/AuthContext";

export function SyncStatusPill({ db }: { db: FarmDotsDatabase }) {
  const auth = useAuth();
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });
  const [conflicts, setConflicts] = useState(0);

  useEffect(() => {
    const engine = getSyncEngine(db);
    return engine.on(setStatus);
  }, [db]);

  useEffect(() => {
    const sub = db.pending_conflicts
      .find({ selector: { status: "pending" } })
      .$.subscribe((docs) => setConflicts(docs.length));
    return () => sub.unsubscribe();
  }, [db]);

  const trigger = async () => {
    try {
      if (!auth.isAuthed) {
        try {
          await auth.requireSignIn();
        } catch {
          return;
        }
      }
      const engine = getSyncEngine(db);
      await engine.runOnce();
    } catch (err) {
      if (err instanceof UnauthorizedError) auth.openSignIn();
    }
  };

  const { color, label, busy } = renderStatus(status);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void trigger()}
        title={statusTitle(status)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color} hover:opacity-90`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        <span>{label}</span>
      </button>
      {conflicts > 0 && (
        <Link
          to="/conflicts"
          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          title="Pending sync conflicts"
        >
          {conflicts} conflict{conflicts === 1 ? "" : "s"}
        </Link>
      )}
    </div>
  );
}

function renderStatus(s: SyncStatus): { color: string; label: string; busy: boolean } {
  switch (s.kind) {
    case "idle":
      return {
        color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
        label: "Synced",
        busy: false,
      };
    case "syncing":
      return {
        color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        label: `Syncing${s.pending ? ` ${s.pending}` : ""}…`,
        busy: true,
      };
    case "error":
      return {
        color: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
        label: s.pending > 0 ? `${s.pending} pending` : "Sync error",
        busy: false,
      };
    case "offline":
      return {
        color: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
        label: "Offline",
        busy: false,
      };
  }
}

function statusTitle(s: SyncStatus): string {
  if (s.kind === "error") return s.message;
  return "Click to sync now";
}

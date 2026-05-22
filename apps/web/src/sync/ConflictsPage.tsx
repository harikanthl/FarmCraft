/**
 * Phase 2.4 pending-conflicts inbox.
 *
 * Lists every row in `pending_conflicts` (geometry / overlay divergences that
 * the auto-resolver punted) and lets the user pick a winner. Each resolution
 * either restamps the local doc (keep local) or applies the remote snapshot
 * (replace local) — both writes flow through the normal mutation gateway so
 * the choice gets queued back to the server.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { FarmDotsDatabase } from "@/db/types";
import { withinSyncWrite } from "@/sync/mutationGateway";

type ConflictRow = {
  id: string;
  collection: string;
  docId: string;
  localJson: string;
  remoteJson: string;
  field?: string;
  createdAt: number;
  status: string;
};

export function ConflictsPage(props: { db: FarmDotsDatabase }) {
  const { db } = props;
  const [rows, setRows] = useState<ConflictRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const q = db.pending_conflicts.find({ selector: { status: "pending" } });
    const sub = q.$.subscribe((docs) => {
      setRows(docs.map((d) => d.toJSON() as ConflictRow));
    });
    return () => sub.unsubscribe();
  }, [db]);

  if (!db) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sync conflicts</h1>
        <Link to="/" className="text-sm text-emerald-700 hover:underline dark:text-emerald-300">
          Back to map
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          No pending conflicts. New conflicts will appear here when remote and local edits collide
          on geometry fields.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              busy={busyId === c.id}
              onResolve={async (choice) => {
                setBusyId(c.id);
                try {
                  await resolveConflict(db, c, choice);
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConflictCard({
  conflict,
  busy,
  onResolve,
}: {
  conflict: ConflictRow;
  busy: boolean;
  onResolve: (choice: "local" | "remote") => void | Promise<void>;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium">
            {conflict.collection} — {conflict.docId}
          </p>
          <p className="text-xs text-slate-500">
            Fields: {conflict.field || "(unknown)"} · {new Date(conflict.createdAt).toLocaleString()}
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Snapshot label="Local (your device)" json={conflict.localJson} />
        <Snapshot label="Remote (server)" json={conflict.remoteJson} />
      </div>
      <footer className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve("local")}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Keep mine
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve("remote")}
          className="rounded-md bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Use remote
        </button>
      </footer>
    </li>
  );
}

function Snapshot({ label, json }: { label: string; json: string }) {
  let pretty = json;
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    /* leave raw */
  }
  return (
    <div className="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-800">
      <p className="mb-1 font-medium">{label}</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">{pretty}</pre>
    </div>
  );
}

async function resolveConflict(
  db: FarmDotsDatabase,
  conflict: ConflictRow,
  choice: "local" | "remote",
): Promise<void> {
  const col = db[conflict.collection as keyof FarmDotsDatabase["collections"]] as unknown as {
    upsert: (doc: Record<string, unknown>) => Promise<unknown>;
  };
  const local = JSON.parse(conflict.localJson) as Record<string, unknown>;
  const remote = JSON.parse(conflict.remoteJson) as Record<string, unknown>;
  const winner = choice === "local" ? local : remote;

  // Mark the picked snapshot as a fresh local mutation so the gateway queues
  // it back to the server (otherwise "use remote" would not propagate to
  // other devices). Resolution itself is a user write, not a sync-write.
  winner.updatedAt = Date.now();
  winner.version = (typeof winner.version === "number" ? winner.version : 1) + 1;
  winner.lastSyncedAt = 0;

  await col.upsert(winner);
  // Mark the inbox row as resolved so it disappears from the list.
  await withinSyncWrite(async () => {
    const row = await db.pending_conflicts.findOne(conflict.id).exec();
    if (row) await row.remove();
  });
}

import type { FarmDotsDatabase } from "@/db/types";
import type { FarmEvent } from "@farmdots/shared";

/** Mark planned events whose end is in the past as missed (best-effort; run on calendar mount). */
export async function markMissedFarmEvents(db: FarmDotsDatabase, farmId?: string): Promise<void> {
  const now = Date.now();
  const q = farmId
    ? db.farm_events.find({ selector: { farmId, status: "planned" } })
    : db.farm_events.find({ selector: { status: "planned" } });
  const docs = await q.exec();

  for (const d of docs) {
    const ev = d.toJSON() as FarmEvent;
    if (ev.recurrenceRule?.trim()) continue;
    if (ev.end >= now) continue;
    await d.incrementalModify((old) => {
      const o = old as unknown as FarmEvent;
      const next = { ...(old as Record<string, unknown>) };
      next.status = "missed";
      next.updatedAt = now;
      next.version = o.version + 1;
      return next as typeof old;
    });
  }
}

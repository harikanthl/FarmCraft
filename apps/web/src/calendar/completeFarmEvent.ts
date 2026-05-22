import type { FarmDotsDatabase } from "@/db/types";
import type { FarmEvent } from "@farmdots/shared";
import type { IrrigationEvent } from "@farmdots/shared";

/**
 * Mark a calendar event completed; for irrigation types, append an irrigation_events log row.
 */
export async function completeFarmEvent(
  db: FarmDotsDatabase,
  ev: FarmEvent,
  opts?: { valveId?: string },
): Promise<void> {
  const doc = await db.farm_events.findOne(ev.id).exec();
  if (!doc) throw new Error("Event not found");
  const cur = doc.toJSON() as FarmEvent;
  const now = Date.now();

  await doc.patch({
    status: "completed",
    completedAt: now,
    updatedAt: now,
    version: cur.version + 1,
  });

  if (ev.type === "irrigation") {
    const valveId = opts?.valveId ?? ev.valveIds?.[0];
    if (valveId) {
      const row: IrrigationEvent = {
        id: crypto.randomUUID(),
        farmId: ev.farmId,
        valveId,
        startedAt: now,
        notes: `From calendar: ${ev.title} (${ev.id})`,
      };
      await db.irrigation_events.insert(row);
    }
  }
}

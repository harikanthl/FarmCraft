import type { FarmDotsDatabase } from "@/db/types";
import type { FarmEvent } from "@farmdots/shared";

export async function shiftFarmEventByDelta(db: FarmDotsDatabase, id: string, deltaMs: number): Promise<void> {
  const doc = await db.farm_events.findOne(id).exec();
  if (!doc) return;
  const ev = doc.toJSON() as FarmEvent;
  await doc.patch({
    start: ev.start + deltaMs,
    end: ev.end + deltaMs,
    updatedAt: Date.now(),
    version: ev.version + 1,
  });
}

export async function updateFarmEventEnd(db: FarmDotsDatabase, id: string, newEndMs: number): Promise<void> {
  const doc = await db.farm_events.findOne(id).exec();
  if (!doc) return;
  const ev = doc.toJSON() as FarmEvent;
  await doc.patch({
    end: newEndMs,
    updatedAt: Date.now(),
    version: ev.version + 1,
  });
}

/** Apply drag/resize from FullCalendar to the RxDB master document (handles recurring instance ids). */
export async function applyCalendarEventTimePatch(
  db: FarmDotsDatabase,
  args: {
    masterFarmEventId: string;
    newStartMs: number;
    newEndMs: number;
    isRecurringInstance: boolean;
    instanceStartMs?: number;
  },
): Promise<void> {
  const doc = await db.farm_events.findOne(args.masterFarmEventId).exec();
  if (!doc) return;
  const ev = doc.toJSON() as FarmEvent;
  const now = Date.now();

  if (args.isRecurringInstance && args.instanceStartMs != null) {
    const delta = args.newStartMs - args.instanceStartMs;
    await doc.patch({
      start: ev.start + delta,
      end: ev.end + delta,
      updatedAt: now,
      version: ev.version + 1,
    });
    return;
  }

  await doc.patch({
    start: args.newStartMs,
    end: args.newEndMs,
    updatedAt: now,
    version: ev.version + 1,
  });
}

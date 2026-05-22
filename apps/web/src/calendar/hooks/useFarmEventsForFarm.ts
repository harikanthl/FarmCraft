import type { FarmDotsDatabase } from "@/db/types";
import type { FarmEvent } from "@farmdots/shared";
import { useEffect, useState } from "react";

export function useFarmEventsForFarm(db: FarmDotsDatabase, farmId: string | null) {
  const [events, setEvents] = useState<FarmEvent[]>([]);

  useEffect(() => {
    if (!farmId) {
      setEvents([]);
      return;
    }
    const q = db.farm_events.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => {
      setEvents(docs.map((d) => d.toJSON() as FarmEvent));
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  return events;
}

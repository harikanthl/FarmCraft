import { expandFarmEventsForFullCalendar } from "@/calendar/expandFarmEvents";
import { endOfLocalDay, startOfLocalDay } from "@/calendar/dateTimeLocal";
import type { FarmDotsDatabase } from "@/db/types";
import type { FarmEvent } from "@farmdots/shared";
import { useEffect, useState } from "react";
import { useFarmEventsForFarm } from "./useFarmEventsForFarm";

/** Valves / rows referenced by calendar events that overlap “today” (expanded instances included). */
export function useCalendarSpatialHighlights(db: FarmDotsDatabase, farmId: string | null) {
  const events = useFarmEventsForFarm(db, farmId);
  const [valveIds, setValveIds] = useState<string[]>([]);
  const [rowIds, setRowIds] = useState<string[]>([]);

  useEffect(() => {
    if (!farmId) {
      setValveIds([]);
      setRowIds([]);
      return;
    }
    const day = new Date();
    const start = startOfLocalDay(day);
    const end = endOfLocalDay(day);
    const expanded = expandFarmEventsForFullCalendar(events, start, end);
    const vSet = new Set<string>();
    const rSet = new Set<string>();
    for (const block of expanded) {
      const fe = block.extendedProps?.farmEvent as FarmEvent | undefined;
      if (!fe) continue;
      for (const id of fe.valveIds ?? []) vSet.add(id);
      for (const id of fe.rowIds ?? []) rSet.add(id);
    }
    setValveIds([...vSet]);
    setRowIds([...rSet]);
  }, [events, farmId]);

  return { valveIds, rowIds };
}

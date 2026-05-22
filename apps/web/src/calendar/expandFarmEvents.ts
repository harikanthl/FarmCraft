import type { FarmEvent } from "@farmdots/shared";
import type { EventInput } from "@fullcalendar/core";
import { rrulestr } from "rrule";
import type { RRule } from "rrule";

function eventColor(type: FarmEvent["type"]): string {
  switch (type) {
    case "irrigation":
      return "#0ea5e9";
    case "harvest":
      return "#eab308";
    case "disease_check":
      return "#f97316";
    case "fertilizer":
    case "spraying":
      return "#22c55e";
    default:
      return "#64748b";
  }
}

/** Parse RRULE + dtstart from stored event; returns null if invalid or non-recurring. */
export function getFarmEventRRule(ev: FarmEvent): RRule | null {
  const raw = ev.recurrenceRule?.trim();
  if (!raw) return null;
  try {
    const line = raw.startsWith("RRULE:") ? raw : `RRULE:${raw}`;
    const dtstart = new Date(ev.start);
    return rrulestr(line, { dtstart }) as RRule;
  } catch {
    return null;
  }
}

/**
 * Expand stored farm events into FullCalendar event inputs for [rangeStart, rangeEnd].
 * Recurring masters yield multiple instances with synthetic ids; non-recurring yield one.
 */
export function expandFarmEventsForFullCalendar(
  events: FarmEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventInput[] {
  const out: EventInput[] = [];

  for (const ev of events) {
    const base = {
      extendedProps: {
        farmEvent: ev,
        masterId: ev.id,
        eventType: ev.type,
        status: ev.status,
      },
      backgroundColor: eventColor(ev.type),
      borderColor: eventColor(ev.type),
    };

    const rule = getFarmEventRRule(ev);
    if (!rule) {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      if (e < rangeStart || s > rangeEnd) continue;
      out.push({
        id: ev.id,
        title: ev.title,
        start: s,
        end: e,
        allDay: ev.allDay,
        startEditable: true,
        durationEditable: true,
        ...base,
        extendedProps: {
          ...base.extendedProps,
          isRecurringInstance: false,
        },
      });
      continue;
    }

    const duration = ev.end - ev.start;
    let dates: Date[];
    try {
      dates = rule.between(rangeStart, rangeEnd, true);
    } catch {
      continue;
    }

    for (const d of dates) {
      const instEnd = new Date(d.getTime() + duration);
      out.push({
        id: `${ev.id}:${d.getTime()}`,
        title: ev.title,
        start: d,
        end: instEnd,
        allDay: ev.allDay,
        startEditable: true,
        durationEditable: false,
        ...base,
        extendedProps: {
          ...base.extendedProps,
          isRecurringInstance: true,
          instanceStart: d.getTime(),
        },
      });
    }
  }

  return out;
}

/** Earliest relevant start at or after `nowMs` (non-recurring: event start if still active). */
export function nextOccurrenceStartMs(ev: FarmEvent, nowMs: number): number | null {
  const rule = getFarmEventRRule(ev);
  if (!rule) {
    if (ev.end < nowMs) return null;
    return ev.start;
  }
  const next = rule.after(new Date(nowMs), false);
  return next ? next.getTime() : null;
}

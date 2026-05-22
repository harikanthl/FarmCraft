import { expandFarmEventsForFullCalendar } from "@/calendar/expandFarmEvents";
import { endOfLocalDay, startOfLocalDay } from "@/calendar/dateTimeLocal";
import type { FarmDotsDatabase } from "@/db/types";
import type { FarmEvent } from "@farmdots/shared";
import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

function operationTypeLabel(t: TFunction, type: FarmEvent["type"] | undefined): string {
  if (!type) return "";
  return t(`operation.${type}`, { defaultValue: type.replace(/_/g, " ") });
}

function eventStatusLabel(t: TFunction, status: FarmEvent["status"] | undefined): string {
  if (!status) return "";
  return t(`eventStatus.${status}`, { defaultValue: status.replace(/_/g, " ") });
}

export function TodayOperationsCard(props: { db: FarmDotsDatabase; farmId: string | null }) {
  const { db, farmId } = props;
  const { t } = useTranslation("calendar");
  const [events, setEvents] = useState<FarmEvent[]>([]);

  useEffect(() => {
    if (!farmId) {
      setEvents([]);
      return;
    }
    const q = db.farm_events.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => setEvents(docs.map((d) => d.toJSON() as FarmEvent)));
    return () => sub.unsubscribe();
  }, [db, farmId]);

  const todayBlocks = useMemo(() => {
    const start = startOfLocalDay(new Date());
    const end = endOfLocalDay(new Date());
    return expandFarmEventsForFullCalendar(events, start, end).sort((a, b) => {
      const as = a.start instanceof Date ? a.start.getTime() : new Date(a.start as string).getTime();
      const bs = b.start instanceof Date ? b.start.getTime() : new Date(b.start as string).getTime();
      return as - bs;
    });
  }, [events]);

  if (!farmId) return null;

  const preview = todayBlocks.slice(0, 6);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
        <CalendarDays className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
        <span>{t("today.title")}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t("today.opsCount", { count: todayBlocks.length })}
        </span>
      </div>
      {preview.length === 0 ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">{t("today.nothingScheduled")}</span>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
          {preview.map((ev) => {
            const fe = ev.extendedProps?.farmEvent as FarmEvent | undefined;
            const start = ev.start instanceof Date ? ev.start : new Date(ev.start as string);
            const type = fe?.type ?? (ev.extendedProps?.eventType as FarmEvent["type"]);
            const st = fe?.status ?? (ev.extendedProps?.status as FarmEvent["status"]);
            return (
              <li key={ev.id} className="truncate">
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>{" "}
                <span className="font-medium">{ev.title}</span>
                <span className="text-slate-500">
                  {" "}
                  · {operationTypeLabel(t, type)} · {eventStatusLabel(t, st)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to={`/farm/${farmId}/calendar`}
        className="ml-auto shrink-0 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-400"
      >
        {t("today.openCalendar")}
      </Link>
    </div>
  );
}

import { InsightsFeed } from "@/intelligence/InsightsFeed";
import { fetchCalendarDrafts, type DraftFarmEvent } from "@/calendar/aiCalendarDraft";
import { expandFarmEventsForFullCalendar } from "@/calendar/expandFarmEvents";
import { applyCalendarEventTimePatch } from "@/calendar/patchFarmEventTimes";
import { markMissedFarmEvents } from "@/calendar/markMissedFarmEvents";
import { datetimeLocalToMs } from "@/calendar/dateTimeLocal";
import { fetchFarmForecast } from "@/calendar/weatherClient";
import { useFarmEventsForFarm } from "@/calendar/hooks/useFarmEventsForFarm";
import { EventEditorDialog } from "@/calendar/components/EventEditorDialog";
import { farmFromDoc } from "@/db/adapters";
import type { FarmDocument } from "@/db/adapters";
import type { FarmDotsDatabase } from "@/db/types";
import { computeFarmPolygonMetrics } from "@/geo/farmMetrics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ClarificationModal } from "@/voice/components/ClarificationModal";
import { MicButton } from "@/voice/components/MicButton";
import { VoiceDraftCard } from "@/voice/components/VoiceDraftCard";
import { VoiceTranscriptStrip } from "@/voice/components/VoiceTranscriptStrip";
import type { VoiceDraft } from "@/voice/useVoiceStore";
import { useVoiceStore } from "@/voice/useVoiceStore";
import { useVoiceWorkflow } from "@/voice/useVoiceWorkflow";
import { farmEventTypeSchema, type FarmEvent } from "@farmdots/shared";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { DateSelectArg, EventClickArg, EventDropArg, LocaleInput } from "@fullcalendar/core";
import afLocale from "@fullcalendar/core/locales/af";
import arLocale from "@fullcalendar/core/locales/ar";
import bnLocale from "@fullcalendar/core/locales/bn";
import bgLocale from "@fullcalendar/core/locales/bg";
import csLocale from "@fullcalendar/core/locales/cs";
import cyLocale from "@fullcalendar/core/locales/cy";
import daLocale from "@fullcalendar/core/locales/da";
import deLocale from "@fullcalendar/core/locales/de";
import elLocale from "@fullcalendar/core/locales/el";
import esLocale from "@fullcalendar/core/locales/es";
import etLocale from "@fullcalendar/core/locales/et";
import faLocale from "@fullcalendar/core/locales/fa";
import fiLocale from "@fullcalendar/core/locales/fi";
import frLocale from "@fullcalendar/core/locales/fr";
import heLocale from "@fullcalendar/core/locales/he";
import hiLocale from "@fullcalendar/core/locales/hi";
import hrLocale from "@fullcalendar/core/locales/hr";
import huLocale from "@fullcalendar/core/locales/hu";
import idLocale from "@fullcalendar/core/locales/id";
import isLocale from "@fullcalendar/core/locales/is";
import itLocale from "@fullcalendar/core/locales/it";
import jaLocale from "@fullcalendar/core/locales/ja";
import koLocale from "@fullcalendar/core/locales/ko";
import ltLocale from "@fullcalendar/core/locales/lt";
import lvLocale from "@fullcalendar/core/locales/lv";
import msLocale from "@fullcalendar/core/locales/ms";
import nbLocale from "@fullcalendar/core/locales/nb";
import neLocale from "@fullcalendar/core/locales/ne";
import nlLocale from "@fullcalendar/core/locales/nl";
import plLocale from "@fullcalendar/core/locales/pl";
import ptLocale from "@fullcalendar/core/locales/pt";
import roLocale from "@fullcalendar/core/locales/ro";
import ruLocale from "@fullcalendar/core/locales/ru";
import skLocale from "@fullcalendar/core/locales/sk";
import slLocale from "@fullcalendar/core/locales/sl";
import srLocale from "@fullcalendar/core/locales/sr";
import svLocale from "@fullcalendar/core/locales/sv";
import taInLocale from "@fullcalendar/core/locales/ta-in";
import thLocale from "@fullcalendar/core/locales/th";
import trLocale from "@fullcalendar/core/locales/tr";
import ukLocale from "@fullcalendar/core/locales/uk";
import viLocale from "@fullcalendar/core/locales/vi";
import zhCnLocale from "@fullcalendar/core/locales/zh-cn";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

const FULL_CALENDAR_LOCALES: Record<string, LocaleInput> = {
  af: afLocale,
  ar: arLocale,
  bn: bnLocale,
  bg: bgLocale,
  cs: csLocale,
  cy: cyLocale,
  da: daLocale,
  de: deLocale,
  el: elLocale,
  es: esLocale,
  et: etLocale,
  fa: faLocale,
  fi: fiLocale,
  fr: frLocale,
  he: heLocale,
  hi: hiLocale,
  hr: hrLocale,
  hu: huLocale,
  id: idLocale,
  is: isLocale,
  it: itLocale,
  ja: jaLocale,
  ko: koLocale,
  lt: ltLocale,
  lv: lvLocale,
  ms: msLocale,
  nb: nbLocale,
  ne: neLocale,
  nl: nlLocale,
  pl: plLocale,
  pt: ptLocale,
  ro: roLocale,
  ru: ruLocale,
  sk: skLocale,
  sl: slLocale,
  sr: srLocale,
  sv: svLocale,
  ta: taInLocale,
  th: thLocale,
  tr: trLocale,
  uk: ukLocale,
  vi: viLocale,
  zh: zhCnLocale,
};

function rainLikelyInNext24h(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  const list = payload.list as Array<{ pop?: number; dt?: number }> | undefined;
  if (!Array.isArray(list)) return false;
  const now = Date.now() / 1000;
  const horizon = now + 86400;
  const slice = list.filter((x) => x.dt != null && x.dt >= now && x.dt <= horizon);
  return slice.some((x) => (x.pop ?? 0) >= 0.45);
}

export function FarmCalendarPage(props: { db: FarmDotsDatabase }) {
  const { farmId } = useParams<{ farmId: string }>();
  const { t, i18n } = useTranslation("calendar");
  const fcLocale = useMemo<LocaleInput | string>(() => {
    const base = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().split("-")[0];
    return FULL_CALENDAR_LOCALES[base] ?? "en";
  }, [i18n.resolvedLanguage, i18n.language]);
  const events = useFarmEventsForFarm(props.db, farmId ?? null);

  const [range, setRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    return { start: now, end: now };
  });

  const [farmName, setFarmName] = useState<string>("");
  const [weatherHint, setWeatherHint] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createRange, setCreateRange] = useState<{ startMs: number; endMs: number } | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafts, setAiDrafts] = useState<DraftFarmEvent[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const voice = useVoiceWorkflow(props.db);
  const setVoiceSelection = useVoiceStore((s) => s.setSelection);

  useEffect(() => {
    setVoiceSelection({ farmId: farmId ?? null });
  }, [farmId, setVoiceSelection]);

  useEffect(() => {
    if (!farmId) return;
    void markMissedFarmEvents(props.db, farmId);
  }, [props.db, farmId]);

  useEffect(() => {
    if (!farmId) {
      setFarmName("");
      return;
    }
    const sub = props.db.farms.findOne(farmId).$.subscribe((doc) => {
      if (!doc) {
        setFarmName("");
        return;
      }
      try {
        setFarmName(farmFromDoc(doc.toJSON() as FarmDocument).name);
      } catch {
        setFarmName("");
      }
    });
    return () => sub.unsubscribe();
  }, [props.db, farmId]);

  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    void (async () => {
      const doc = await props.db.farms.findOne(farmId).exec();
      if (!doc || cancelled) return;
      try {
        const farm = farmFromDoc(doc.toJSON() as FarmDocument);
        const m = computeFarmPolygonMetrics(farm.polygon);
        const payload = await fetchFarmForecast(m.centroidLat, m.centroidLng);
        if (!cancelled) {
          setWeatherHint(rainLikelyInNext24h(payload) ? t("weatherHint.rain24h") : null);
        }
      } catch {
        if (!cancelled) setWeatherHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.db, farmId, t]);

  const fcEvents = useMemo(
    () => expandFarmEventsForFullCalendar(events, range.start, range.end),
    [events, range.start, range.end],
  );

  const openCreate = useCallback((startMs: number, endMs: number) => {
    setEditingId(null);
    setCreateRange({ startMs, endMs });
    setEditorOpen(true);
  }, []);

  const onSelect = useCallback(
    (arg: DateSelectArg) => {
      openCreate(arg.start.getTime(), arg.end.getTime());
    },
    [openCreate],
  );

  const onEventClick = useCallback((arg: EventClickArg) => {
    const xp = arg.event.extendedProps as {
      farmEvent?: FarmEvent;
      masterId?: string;
      isRecurringInstance?: boolean;
    };
    const masterId = xp.masterId ?? arg.event.id.split(":")[0];
    if (!masterId) return;
    setEditingId(masterId);
    setCreateRange(null);
    setEditorOpen(true);
  }, []);

  const onEventDrop = useCallback(
    async (arg: EventDropArg) => {
      const xp = arg.event.extendedProps as {
        farmEvent?: FarmEvent;
        masterId?: string;
        isRecurringInstance?: boolean;
        instanceStart?: number;
      };
      const masterFarmEventId = xp.masterId ?? arg.event.id.split(":")[0];
      const start = arg.event.start ? arg.event.start.getTime() : datetimeLocalToMs(arg.event.startStr ?? "");
      const end = arg.event.end ? arg.event.end.getTime() : start + 3600_000;
      try {
        await applyCalendarEventTimePatch(props.db, {
          masterFarmEventId,
          newStartMs: start,
          newEndMs: end,
          isRecurringInstance: Boolean(xp.isRecurringInstance),
          instanceStartMs: xp.instanceStart,
        });
      } catch {
        arg.revert();
        toast.error(t("toasts.moveEventFailed"));
      }
    },
    [props.db, t],
  );

  const onEventResize = useCallback(
    async (arg: EventResizeDoneArg) => {
      const xp = arg.event.extendedProps as {
        masterId?: string;
        isRecurringInstance?: boolean;
        instanceStart?: number;
      };
      if (xp.isRecurringInstance) {
        arg.revert();
        toast.message(t("toasts.resizeRecurringHint"));
        return;
      }
      const masterFarmEventId = xp.masterId ?? arg.event.id.split(":")[0];
      const start = arg.event.start!.getTime();
      const end = arg.event.end!.getTime();
      try {
        await applyCalendarEventTimePatch(props.db, {
          masterFarmEventId,
          newStartMs: start,
          newEndMs: end,
          isRecurringInstance: false,
        });
      } catch {
        arg.revert();
        toast.error(t("toasts.resizeEventFailed"));
      }
    },
    [props.db, t],
  );

  async function runAiDrafts() {
    if (!farmId || !aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      let farmContext: unknown;
      const doc = await props.db.farms.findOne(farmId).exec();
      if (doc) {
        const farm = farmFromDoc(doc.toJSON() as FarmDocument);
        farmContext = {
          name: farm.name,
          irrigationType: farm.irrigationType,
          valveCount: (await props.db.valves.find({ selector: { farmId } }).exec()).length,
        };
      }
      const res = await fetchCalendarDrafts(aiPrompt.trim(), farmContext);
      setAiDrafts(res.drafts ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toasts.aiRequestFailed"));
    } finally {
      setAiLoading(false);
    }
  }

  function textDraftToVoiceDraft(d: DraftFarmEvent): VoiceDraft {
    const parsedType = farmEventTypeSchema.safeParse(d.type);
    return {
      kind: "needs-confirm",
      transcript: aiPrompt,
      spokenLanguage: "en",
      intent: {
        type: "create_operation",
        operationType: parsedType.success ? parsedType.data : "other",
        farmId,
        valveIds: [],
        rowIds: [],
        plantIds: [],
        startIso: d.startIso,
        endIso: d.endIso,
        notes: d.description,
        confidence: 0.85,
      },
    };
  }

  async function insertDraft(d: DraftFarmEvent) {
    if (!farmId) return;
    const start = new Date(d.startIso).getTime();
    const end = new Date(d.endIso).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      toast.error(t("toasts.invalidDraftTimes"));
      return;
    }
    const parsedType = farmEventTypeSchema.safeParse(d.type);
    const evType: FarmEvent["type"] = parsedType.success ? parsedType.data : "other";
    const now = Date.now();
    await props.db.farm_events.insert({
      id: crypto.randomUUID(),
      farmId,
      title: d.title,
      type: evType,
      description: d.description,
      start,
      end,
      allDay: Boolean(d.allDay),
      status: "planned",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    toast.success(t("toasts.draftSaved"));
    setAiOpen(false);
  }

  if (!farmId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        {t("page.missingFarmId")}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:text-emerald-950 dark:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("page.map")}
        </Link>
        <Link
          to={`/farm/${farmId}/workspace`}
          className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
        >
          {t("page.workspace")}
        </Link>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{t("page.title")}</span>
        <span className="text-sm text-slate-600 dark:text-slate-400">{farmName}</span>
        <Button type="button" variant="secondary" size="sm" className="ml-auto gap-1" onClick={() => setAiOpen(true)}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("page.aiDrafts")}
        </Button>
        <MicButton onToggle={voice.toggle} />
      </header>

      {voice.transcript || voice.draft ? (
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
          {voice.transcript ? <VoiceTranscriptStrip className="max-w-2xl" /> : null}
          {voice.draft && voice.draft.kind !== "clarify" ? (
            <VoiceDraftCard
              draft={voice.draft}
              onConfirm={voice.confirmDraft}
              onDiscard={voice.discardDraft}
              className="max-w-2xl"
            />
          ) : null}
        </div>
      ) : null}

      {weatherHint ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {weatherHint}
        </div>
      ) : null}

      <InsightsFeed db={props.db} farmId={farmId} />

      <div className="min-h-0 flex-1 p-4">
        <div className="farm-calendar-shell fc-theme-standard h-[min(calc(100dvh-8rem),900px)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <FullCalendar
            plugins={[listPlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="listWeek"
            locale={fcLocale}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            editable
            selectable
            selectMirror
            dayMaxEvents
            height="auto"
            events={fcEvents}
            datesSet={(arg) => setRange({ start: arg.start, end: arg.end })}
            select={onSelect}
            eventClick={onEventClick}
            eventDrop={onEventDrop}
            eventResize={onEventResize}
          />
        </div>
      </div>

      <EventEditorDialog
        db={props.db}
        farmId={farmId}
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) {
            setEditingId(null);
            setCreateRange(null);
          }
        }}
        editingId={editingId}
        defaultRange={createRange}
      />

      <ClarificationModal
        draft={voice.draft}
        onSubmit={voice.submitClarification}
        onCancel={voice.discardDraft}
      />

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("page.aiDialogTitle")}</DialogTitle>
            <DialogDescription>{t("page.aiDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">{t("page.aiPromptLabel")}</Label>
              <textarea
                id="ai-prompt"
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder={t("page.aiPromptPlaceholder")}
              />
            </div>
            <Button type="button" disabled={aiLoading} onClick={() => void runAiDrafts()}>
              {aiLoading ? t("page.aiGenerating") : t("page.aiGenerate")}
            </Button>
            <ul className="space-y-2">
              {aiDrafts.map((d, i) => (
                <li key={i}>
                  <VoiceDraftCard
                    draft={textDraftToVoiceDraft(d)}
                    onConfirm={() => void insertDraft(d)}
                    onDiscard={() => setAiDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAiOpen(false)}>
              {t("page.aiClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

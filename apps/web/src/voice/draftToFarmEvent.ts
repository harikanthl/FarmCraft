import type { FarmEvent, VoiceIntent } from "@farmdots/shared";
import { farmEventTypeSchema } from "@farmdots/shared";
import i18n from "@/i18n";

/** Default per-operation duration in ms when Gemini does not specify `endIso`. */
const DEFAULT_DURATION_MS: Record<string, number> = {
  irrigation: 60 * 60 * 1000,
  spraying: 60 * 60 * 1000,
  fertilizer: 60 * 60 * 1000,
  pruning: 90 * 60 * 1000,
  harvest: 4 * 60 * 60 * 1000,
  disease_check: 30 * 60 * 1000,
  soil_test: 30 * 60 * 1000,
};

/**
 * Convert a Gemini-emitted {@link VoiceIntent} into a `farm_events`-shaped
 * document ready for `db.farm_events.insert(...)`. Title falls back to a
 * localized operation name when the model did not provide one.
 */
export function voiceIntentToFarmEventDoc(intent: VoiceIntent, farmId: string): Record<string, unknown> {
  const parsedType = farmEventTypeSchema.safeParse(intent.operationType ?? "other");
  const evType: FarmEvent["type"] = parsedType.success ? parsedType.data : "other";

  const now = Date.now();
  const start = parseIso(intent.startIso) ?? defaultStart(now);
  const fallbackDuration = DEFAULT_DURATION_MS[evType] ?? 60 * 60 * 1000;
  const end = parseIso(intent.endIso) ?? start + fallbackDuration;

  const tCalendar = i18n.getFixedT(null, "calendar");
  const localizedType = tCalendar(`operation.${evType}`, { defaultValue: evType });
  const title = intent.notes?.split("\n")[0]?.trim() || `${localizedType}`;

  return {
    id: crypto.randomUUID(),
    farmId,
    title,
    type: evType,
    description: intent.notes,
    start,
    end,
    allDay: false,
    recurrenceRule: intent.recurrence,
    rowIds: intent.rowIds.length ? intent.rowIds : undefined,
    valveIds: intent.valveIds.length ? intent.valveIds : undefined,
    plantIds: intent.plantIds.length ? intent.plantIds : undefined,
    status: "planned",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function parseIso(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** When Gemini omits a start, schedule for the next morning at 06:00 local time. */
function defaultStart(now: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}

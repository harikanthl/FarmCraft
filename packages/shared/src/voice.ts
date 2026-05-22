import { z } from "zod";
import { farmEventTypeSchema } from "./entities.js";

/**
 * High-level command intent emitted by the Gemini parse-intent worker for a voice
 * transcript. Operational intents map to FarmEvent drafts; contextual intents
 * (query/summary/alert/weather) route to the existing AI Q&A endpoints
 * (`ai.md` sections 7, 10, 20, 21).
 */
export const voiceIntentTypeSchema = z.enum([
  "create_operation",
  "edit_operation",
  "cancel_operation",
  "reschedule_operation",
  "mark_complete",
  "query",
  "summary",
  "alert",
  "weather",
  "clarify",
  "unknown",
]);

export type VoiceIntentType = z.infer<typeof voiceIntentTypeSchema>;

export const voiceIntentSchema = z.object({
  type: voiceIntentTypeSchema,
  /** Operational FarmEvent type when `type` is `create_operation` / edit / etc. */
  operationType: farmEventTypeSchema.optional(),
  farmId: z.string().optional(),
  valveIds: z.array(z.string()).default([]),
  rowIds: z.array(z.string()).default([]),
  plantIds: z.array(z.string()).default([]),
  /** RFC 5545 RRULE string when the user describes recurrence (e.g. "every 3 days"). */
  recurrence: z.string().optional(),
  startIso: z.string().optional(),
  endIso: z.string().optional(),
  notes: z.string().optional(),
  /** BCP-47 or short code returned by Sarvam STT (e.g. `te-IN` -> `te`). */
  spokenLanguage: z.string().optional(),
  /** Localized natural-language confirmation text Gemini wants spoken back. */
  spokenReply: z.string().optional(),
  /** 0..1 — drives PRD section 21 thresholds (>0.9 auto, 0.6-0.9 confirm, <0.6 clarify). */
  confidence: z.number().min(0).max(1),
  /** When confidence < 0.6 Gemini fills in a clarifying question to ask the user. */
  clarification: z.string().optional(),
});

export type VoiceIntent = z.infer<typeof voiceIntentSchema>;

/** Local-only RxDB row used as the offline replay queue (`ai.md` section 24). */
export const pendingVoiceOperationSchema = z.object({
  id: z.string(),
  farmId: z.string().optional(),
  transcript: z.string(),
  locale: z.string(),
  intentJson: z.string(),
  /** queued | synced | discarded */
  status: z.enum(["queued", "synced", "discarded"]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export type PendingVoiceOperation = z.infer<typeof pendingVoiceOperationSchema>;

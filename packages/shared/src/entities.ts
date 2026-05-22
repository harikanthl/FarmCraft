import { z } from "zod";
import { geoJsonPolygonSchema } from "./geojson.js";
import { syncMetaSchema } from "./sync.js";

export const irrigationTypeSchema = z.enum(["drip", "flood", "sprinkler", "other"]);

export const farmSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string(),
    name: z.string().min(1),
    polygon: geoJsonPolygonSchema,
    irrigationType: irrigationTypeSchema,
    /** Matches `@farmdots/crop-profiles` id when set (e.g. mango). */
    primaryCropId: z.string().max(64).optional(),
    createdAt: z.number().int().nonnegative(),
  })
  .merge(syncMetaSchema);

export type Farm = z.infer<typeof farmSchema>;

/** Row holds valveIds; Valve.connectedRows is derived for display/cache only */
export const rowSchema = z.object({
  id: z.string().uuid(),
  farmId: z.string().uuid(),
  name: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  valveIds: z.array(z.string().uuid()),
  createdAt: z.number().int().nonnegative(),
});

export type Row = z.infer<typeof rowSchema>;

export const healthStatusSchema = z.enum(["healthy", "waterIssue", "disease", "dripIssue", "unknown"]);

export const plantSchema = z
  .object({
    id: z.string().uuid(),
    farmId: z.string().uuid(),
    rowId: z.string().uuid(),
    label: z.string(),
    lat: z.number(),
    lng: z.number(),
    cropType: z.string(),
    plantedDate: z.number().int().optional(),
    age: z.number().optional(),
    yearlyYield: z.number().optional(),
    healthStatus: healthStatusSchema,
    wateringIssues: z.string().optional(),
    diseaseIssues: z.string().optional(),
    dripIssues: z.string().optional(),
    notes: z.string().optional(),
    createdAt: z.number().int().nonnegative(),
  })
  .merge(syncMetaSchema);

export type Plant = z.infer<typeof plantSchema>;

export const valveStatusSchema = z.enum(["open", "closed", "unknown", "fault"]);

export const valveSchema = z
  .object({
    id: z.string().uuid(),
    farmId: z.string().uuid(),
    name: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
    /** Derived cache — source of truth is Row.valveIds */
    connectedRows: z.array(z.string().uuid()),
    status: valveStatusSchema,
    notes: z.string().optional(),
    createdAt: z.number().int().nonnegative(),
  })
  .merge(syncMetaSchema);

export type Valve = z.infer<typeof valveSchema>;

export const irrigationEventSchema = z.object({
  id: z.string().uuid(),
  valveId: z.string().uuid(),
  farmId: z.string().uuid(),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative().optional(),
  issue: z.string().optional(),
  notes: z.string().optional(),
});

export type IrrigationEvent = z.infer<typeof irrigationEventSchema>;

export const diseaseEventSchema = z.object({
  id: z.string().uuid(),
  plantId: z.string().uuid(),
  diseaseType: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  treatment: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.number().int().nonnegative(),
});

export type DiseaseEvent = z.infer<typeof diseaseEventSchema>;

/** Planned farm operations (calendar). Historical irrigation runs stay in `irrigation_events`. */
export const farmEventTypeSchema = z.enum([
  "irrigation",
  "fertilizer",
  "spraying",
  "pruning",
  "harvest",
  "disease_check",
  "soil_test",
  "rainfall_alert",
  "heat_stress",
  "humidity_warning",
  "storm_warning",
  "irrigation_recommendation",
  "disease_risk_alert",
  "low_yield_inspection",
  "crop_advisory",
  "other",
]);

export const farmEventStatusSchema = z.enum([
  "planned",
  "in_progress",
  "completed",
  "skipped",
  "missed",
]);

export const farmEventSchema = z
  .object({
    id: z.string().uuid(),
    farmId: z.string().uuid(),
    type: farmEventTypeSchema,
    title: z.string().min(1),
    description: z.string().optional(),
    /** Unix ms */
    start: z.number().int(),
    /** Unix ms */
    end: z.number().int(),
    allDay: z.boolean(),
    /** RFC 5545 RRULE; expanded client-side only */
    recurrenceRule: z.string().optional(),
    rowIds: z.array(z.string().uuid()).optional(),
    valveIds: z.array(z.string().uuid()).optional(),
    plantIds: z.array(z.string().uuid()).optional(),
    cropType: z.string().optional(),
    weatherDependent: z.boolean().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    status: farmEventStatusSchema,
    completedAt: z.number().int().optional(),
    createdAt: z.number().int().nonnegative(),
  })
  .merge(syncMetaSchema);

export type FarmEvent = z.infer<typeof farmEventSchema>;

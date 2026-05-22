import { farmEventStatusSchema, farmEventTypeSchema } from "@farmdots/shared";
import { z } from "zod";

export const farmNameFormSchema = z.object({
  name: z
    .string()
    .min(1, "Farm name is required")
    .max(256, "Name must be 256 characters or less"),
});

export type FarmNameFormValues = z.infer<typeof farmNameFormSchema>;

export const plantMainFormSchema = z.object({
  yearlyYield: z.string().optional(),
  wateringIssues: z.string().optional(),
  diseaseIssues: z.string().optional(),
  dripIssues: z.string().optional(),
  notes: z.string().optional(),
});

export type PlantMainFormValues = z.infer<typeof plantMainFormSchema>;

export const diseaseQuickFormSchema = z.object({
  diseaseType: z.string().min(1, "Type required"),
  severity: z.enum(["low", "medium", "high"]),
  treatment: z.string().optional(),
  notes: z.string().optional(),
});

export type DiseaseQuickFormValues = z.infer<typeof diseaseQuickFormSchema>;

export const irrigationQuickFormSchema = z.object({
  irrigationIssue: z.string().optional(),
  irrigationNotes: z.string().optional(),
});

export type IrrigationQuickFormValues = z.infer<typeof irrigationQuickFormSchema>;

export const valveFormSchema = z.object({
  name: z.string().min(1, "Name required"),
  status: z.enum(["unknown", "open", "closed", "fault"]),
});

export type ValveFormValues = z.infer<typeof valveFormSchema>;

export const gridBearingSourceSchema = z.enum(["manual", "farmShape", "existingPlants"]);

export const gridFormSchema = z
  .object({
    /** Fill across the farm: row count = width ÷ row spacing (approx.). */
    autoRowCount: z.boolean(),
    rowCount: z.coerce.number().int().min(1).optional(),
    bearingSource: gridBearingSourceSchema,
    /** Used when bearing source is Manual. */
    bearingDeg: z.coerce.number(),
    rowSpacingM: z.coerce.number().min(0.5),
    plantSpacingM: z.coerce.number().min(0.5),
  })
  .superRefine((data, ctx) => {
    if (!data.autoRowCount && (data.rowCount == null || data.rowCount < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Row count required",
        path: ["rowCount"],
      });
    }
  });

export type GridFormValues = z.infer<typeof gridFormSchema>;

export const farmEventFormSchema = z.object({
  title: z.string().min(1),
  type: farmEventTypeSchema,
  description: z.string().optional(),
  /** `datetime-local` value */
  startLocal: z.string().min(1),
  endLocal: z.string().min(1),
  allDay: z.boolean(),
  recurrenceRule: z.string().optional(),
  valveIds: z.array(z.string()),
  rowIds: z.array(z.string()),
  status: farmEventStatusSchema,
});

export type FarmEventFormValues = z.infer<typeof farmEventFormSchema>;

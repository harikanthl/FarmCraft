import { z } from "zod";
import type { DiseaseEvent, Farm, IrrigationEvent, Plant, Row, Valve } from "./entities.js";

export const farmContextSummarySchema = z.object({
  farmId: z.string().uuid(),
  farmName: z.string(),
  plantCount: z.number().int().nonnegative(),
  byHealth: z.record(z.string(), z.number().int().nonnegative()),
  irrigationOpenIssues: z.number().int().nonnegative(),
  diseaseClusters: z.array(
    z.object({
      diseaseType: z.string(),
      affectedPlantCount: z.number().int().positive(),
    }),
  ),
  yieldTrend: z.array(
    z.object({
      period: z.string(),
      totalYield: z.number(),
    }),
  ),
});

export type FarmContextSummary = z.infer<typeof farmContextSummarySchema>;

export const farmContextSchema = z.object({
  farm: z.object({
    id: z.string(),
    name: z.string(),
    irrigationType: z.string(),
    primaryCropId: z.string().optional(),
  }),
  summary: farmContextSummarySchema,
  plantSamples: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      rowId: z.string(),
      healthStatus: z.string(),
      yearlyYield: z.number().optional(),
    }),
  ),
});

export type FarmContext = z.infer<typeof farmContextSchema>;

export const plantDetailSchema = z.object({
  plant: z.object({
    id: z.string(),
    label: z.string(),
    cropType: z.string(),
    lat: z.number(),
    lng: z.number(),
    healthStatus: z.string(),
    yearlyYield: z.number().optional(),
    notes: z.string().optional(),
    wateringIssues: z.string().optional(),
    diseaseIssues: z.string().optional(),
    dripIssues: z.string().optional(),
  }),
  row: z.object({ id: z.string(), name: z.string() }).optional(),
  valve: z.object({ id: z.string(), name: z.string(), status: z.string() }).optional(),
  irrigationEvents: z.array(
    z.object({
      id: z.string(),
      startedAt: z.number(),
      endedAt: z.number().optional(),
      issue: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  diseaseEvents: z.array(
    z.object({
      id: z.string(),
      diseaseType: z.string(),
      severity: z.string(),
      treatment: z.string().optional(),
      notes: z.string().optional(),
      createdAt: z.number(),
    }),
  ),
});

export type PlantDetail = z.infer<typeof plantDetailSchema>;

export type FarmContextInput = {
  farm: Farm;
  plants: Plant[];
  irrigationEvents: IrrigationEvent[];
  diseaseEvents: DiseaseEvent[];
};

export function buildFarmContext(input: FarmContextInput): FarmContext {
  const { farm, plants, irrigationEvents, diseaseEvents } = input;
  const farmPlants = plants.filter((p) => p.farmId === farm.id);
  const byHealth: Record<string, number> = {};
  for (const p of farmPlants) {
    byHealth[p.healthStatus] = (byHealth[p.healthStatus] ?? 0) + 1;
  }
  const diseaseByType = new Map<string, number>();
  for (const d of diseaseEvents) {
    const plant = farmPlants.find((x) => x.id === d.plantId);
    if (!plant || plant.farmId !== farm.id) continue;
    diseaseByType.set(d.diseaseType, (diseaseByType.get(d.diseaseType) ?? 0) + 1);
  }
  const diseaseClusters = [...diseaseByType.entries()].map(([diseaseType, affectedPlantCount]) => ({
    diseaseType,
    affectedPlantCount,
  }));
  const openIrrigation = irrigationEvents.filter(
    (e) => e.farmId === farm.id && e.issue && e.issue.length > 0,
  ).length;
  const yieldByMonth = aggregateYieldByPeriod(farmPlants);
  const summary: FarmContextSummary = {
    farmId: farm.id,
    farmName: farm.name,
    plantCount: farmPlants.length,
    byHealth,
    irrigationOpenIssues: openIrrigation,
    diseaseClusters,
    yieldTrend: yieldByMonth,
  };
  const plantSamples = farmPlants.slice(0, 50)
    .map((p) => ({
      id: p.id,
      label: p.label,
      rowId: p.rowId,
      healthStatus: p.healthStatus,
      yearlyYield: p.yearlyYield,
    }));
  return {
    farm: {
      id: farm.id,
      name: farm.name,
      irrigationType: farm.irrigationType,
      primaryCropId: farm.primaryCropId,
    },
    summary,
    plantSamples,
  };
}

function aggregateYieldByPeriod(plants: Plant[]): { period: string; totalYield: number }[] {
  const map = new Map<string, number>();
  for (const p of plants) {
    if (p.yearlyYield == null) continue;
    const period = "year";
    map.set(period, (map.get(period) ?? 0) + p.yearlyYield);
  }
  return [...map.entries()].map(([period, totalYield]) => ({ period, totalYield }));
}

export type PlantDetailInput = {
  plant: Plant;
  row?: Row;
  /** Valves linked via row.valveIds — used for summary display */
  valvesForRow: Valve[];
  irrigationEvents: IrrigationEvent[];
  diseaseEvents: DiseaseEvent[];
};

export function buildPlantDetail(input: PlantDetailInput): PlantDetail {
  const { plant, row, valvesForRow, irrigationEvents, diseaseEvents } = input;
  const valveIds = new Set(row?.valveIds ?? []);
  const irr = irrigationEvents.filter(
    (e) => e.farmId === plant.farmId && valveIds.has(e.valveId),
  );
  const valve = valvesForRow[0];
  const diseases = diseaseEvents.filter((d) => d.plantId === plant.id);
  return {
    plant: {
      id: plant.id,
      label: plant.label,
      cropType: plant.cropType,
      lat: plant.lat,
      lng: plant.lng,
      healthStatus: plant.healthStatus,
      yearlyYield: plant.yearlyYield,
      notes: plant.notes,
      wateringIssues: plant.wateringIssues,
      diseaseIssues: plant.diseaseIssues,
      dripIssues: plant.dripIssues,
    },
    row: row ? { id: row.id, name: row.name } : undefined,
    valve: valve ? { id: valve.id, name: valve.name, status: valve.status } : undefined,
    irrigationEvents: irr.map((e) => ({
      id: e.id,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      issue: e.issue,
      notes: e.notes,
    })),
    diseaseEvents: diseases.map((d) => ({
      id: d.id,
      diseaseType: d.diseaseType,
      severity: d.severity,
      treatment: d.treatment,
      notes: d.notes,
      createdAt: d.createdAt,
    })),
  };
}

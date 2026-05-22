import type { DiseaseEvent, IrrigationEvent, Plant } from "@farmdots/shared";
import type { WeatherCurrentPayload, WeatherForecastPayload } from "@/weather/weatherClient";

export type HealthBreakdown = {
  plantHealth: number;
  disease: number;
  irrigation: number;
  weather: number;
};

export type FarmHealthScore = {
  score: number;
  band: "good" | "watch" | "poor";
  breakdown: HealthBreakdown;
  /** Short human-readable rationale lines (3–5 max). */
  notes: string[];
};

const WEIGHTS = { plantHealth: 0.35, disease: 0.25, irrigation: 0.2, weather: 0.2 } as const;

const PLANT_HEALTH_POINTS: Record<string, number> = {
  healthy: 100,
  unknown: 70,
  waterIssue: 40,
  dripIssue: 40,
  disease: 20,
};

const IRRIGATION_FRESH_MS = 7 * 24 * 3600_000;
const DISEASE_RECENT_MS = 30 * 24 * 3600_000;
const HUMIDITY_RISK = 80;
const WIND_RISK = 12;
const RAIN_POP_RISK = 0.6;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function bandFor(score: number): FarmHealthScore["band"] {
  if (score >= 75) return "good";
  if (score >= 50) return "watch";
  return "poor";
}

export type HealthInputs = {
  farmId: string;
  plants: Plant[];
  diseaseEvents: DiseaseEvent[];
  irrigationEvents: IrrigationEvent[];
  current: WeatherCurrentPayload | null;
  forecast: WeatherForecastPayload | null;
  now?: number;
};

export function computeFarmHealthScore(input: HealthInputs): FarmHealthScore {
  const now = input.now ?? Date.now();
  const notes: string[] = [];

  // 1. Plant health — average of mapped points
  const farmPlants = input.plants.filter((p) => p.farmId === input.farmId);
  let plantHealth = 70;
  if (farmPlants.length > 0) {
    let total = 0;
    for (const p of farmPlants) total += PLANT_HEALTH_POINTS[p.healthStatus] ?? 60;
    plantHealth = clamp(total / farmPlants.length);
  } else {
    notes.push("No plants on file — plant-health component defaults to neutral.");
  }

  // 2. Disease pressure — recent disease events vs plant count
  const farmPlantIds = new Set(farmPlants.map((p) => p.id));
  const recentDisease = input.diseaseEvents.filter(
    (d) => farmPlantIds.has(d.plantId) && now - d.createdAt <= DISEASE_RECENT_MS,
  );
  const denom = Math.max(farmPlants.length, 1);
  const diseaseRatio = recentDisease.length / denom;
  // 0% → 100, 10% affected → 50, ≥20% → 0
  const disease = clamp(100 - diseaseRatio * 500);
  if (recentDisease.length > 0) {
    notes.push(
      `${recentDisease.length} disease event${recentDisease.length === 1 ? "" : "s"} in the last 30 days.`,
    );
  }

  // 3. Irrigation recency
  const recentIrrigation = input.irrigationEvents.filter(
    (e) => e.farmId === input.farmId && now - e.startedAt <= IRRIGATION_FRESH_MS,
  );
  let irrigation = 70;
  if (input.irrigationEvents.some((e) => e.farmId === input.farmId)) {
    irrigation = recentIrrigation.length > 0 ? 90 : 40;
  } else if (farmPlants.length > 0) {
    irrigation = 50;
    notes.push("No irrigation events logged yet — recency unknown.");
  }
  const openIssues = input.irrigationEvents.filter(
    (e) => e.farmId === input.farmId && e.issue && e.issue.length > 0,
  ).length;
  if (openIssues > 0) {
    irrigation = clamp(irrigation - openIssues * 8);
    notes.push(`${openIssues} open irrigation issue${openIssues === 1 ? "" : "s"}.`);
  }

  // 4. Weather pressure (worse number → lower score)
  let weather = 85;
  const humidity = input.current?.main?.humidity;
  const wind = input.current?.wind?.speed;
  if (typeof humidity === "number" && humidity >= HUMIDITY_RISK) {
    weather -= Math.min(20, (humidity - HUMIDITY_RISK) * 1.5);
    notes.push(`High humidity (${Math.round(humidity)}%) raising fungal pressure.`);
  }
  if (typeof wind === "number" && wind >= WIND_RISK) {
    weather -= Math.min(20, (wind - WIND_RISK) * 2);
    notes.push(`Strong wind (${wind.toFixed(1)} m/s) — physical risk for tall stands.`);
  }
  if (input.forecast?.list?.length) {
    const cutoff = Math.floor((now + 24 * 3600_000) / 1000);
    const nowS = Math.floor(now / 1000);
    const next24h = input.forecast.list.filter((x) => x.dt != null && x.dt >= nowS && x.dt <= cutoff);
    if (next24h.some((x) => (x.pop ?? 0) >= RAIN_POP_RISK)) {
      weather -= 5;
    }
  }
  weather = clamp(weather);

  const breakdown: HealthBreakdown = {
    plantHealth: Math.round(plantHealth),
    disease: Math.round(disease),
    irrigation: Math.round(irrigation),
    weather: Math.round(weather),
  };

  const score = Math.round(
    breakdown.plantHealth * WEIGHTS.plantHealth +
      breakdown.disease * WEIGHTS.disease +
      breakdown.irrigation * WEIGHTS.irrigation +
      breakdown.weather * WEIGHTS.weather,
  );

  return { score: clamp(score), band: bandFor(score), breakdown, notes: notes.slice(0, 5) };
}

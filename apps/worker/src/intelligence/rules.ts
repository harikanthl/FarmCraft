/**
 * Phase 3 operational rule engine — writes idempotent rows into `ai_insights`.
 */
import type { Env } from "../repo.js";

const DAY_MS = 86400_000;

function dayBucket(ts = Date.now()): number {
  return Math.floor(ts / DAY_MS);
}

function insightId(farmId: string, type: string, bucket: number): string {
  return `${farmId}:${type}:${bucket}`;
}

async function upsertInsight(
  env: Env,
  id: string,
  farmId: string,
  type: string,
  severity: string | null,
  summary: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO ai_insights (id, farm_id, type, severity, summary, payload_json, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       severity = excluded.severity,
       summary = excluded.summary,
       payload_json = excluded.payload_json,
       generated_at = excluded.generated_at`,
  )
    .bind(id, farmId, type, severity, summary, JSON.stringify(payload), now)
    .run();
}

/** Precipitation sum (mm) for forecast list entries whose `dt` is within the next `hours`. */
export function sumForecastPrecipMm(
  forecastList: Array<{ dt?: number; rain?: { "3h"?: number } }>,
  nowSec: number,
  hours: number,
): number {
  const end = nowSec + hours * 3600;
  let mm = 0;
  for (const item of forecastList) {
    const dt = item.dt;
    if (typeof dt !== "number") continue;
    if (dt < nowSec || dt > end) continue;
    const v = item.rain?.["3h"];
    if (typeof v === "number" && Number.isFinite(v)) mm += v;
  }
  return mm;
}

export async function runIntelligenceRules(env: Env): Promise<void> {
  const farms = await env.DB.prepare(
    `SELECT id FROM farms WHERE deleted_at IS NULL`,
  ).all();
  const rows = (farms.results ?? []) as { id: string }[];
  const bucket = dayBucket();

  for (const { id: farmId } of rows) {
    await runSkipIrrigationOnRain(env, farmId, bucket);
    await runFungalPressure(env, farmId, bucket);
    await runHeatStress(env, farmId, bucket);
    await runIrrigationDue(env, farmId, bucket);
  }
}

async function runSkipIrrigationOnRain(env: Env, farmId: string, bucket: number): Promise<void> {
  const now = Date.now();
  const horizon = now + 48 * 3600_000;
  const events = await env.DB.prepare(
    `SELECT id FROM farm_events
     WHERE farm_id = ?
       AND deleted_at IS NULL
       AND lower(type) = 'irrigation'
       AND event_start >= ?
       AND event_start <= ?`,
  )
    .bind(farmId, now, horizon)
    .all();
  if ((events.results ?? []).length === 0) return;

  const snap = await env.DB.prepare(
    `SELECT raw_json FROM weather_snapshots WHERE farm_id = ? ORDER BY captured_at DESC LIMIT 1`,
  )
    .bind(farmId)
    .first<{ raw_json: string | null }>();
  if (!snap?.raw_json) return;

  let raw: { forecast?: { list?: Array<{ dt?: number; rain?: { "3h"?: number } }> } };
  try {
    raw = JSON.parse(snap.raw_json) as typeof raw;
  } catch {
    return;
  }
  const list = raw.forecast?.list ?? [];
  const nowSec = Math.floor(now / 1000);
  const precip = sumForecastPrecipMm(list, nowSec, 48);
  if (precip <= 5) return;

  await upsertInsight(
    env,
    insightId(farmId, "irrigation_recommendation", bucket),
    farmId,
    "irrigation_recommendation",
    "info",
    `Rain likely in the next 48h (~${precip.toFixed(1)} mm). Consider skipping scheduled irrigation.`,
    { action: "skip", precipMm48h: precip },
  );
}

async function runFungalPressure(env: Env, farmId: string, bucket: number): Promise<void> {
  const snap = await env.DB.prepare(
    `SELECT raw_json FROM weather_snapshots WHERE farm_id = ? ORDER BY captured_at DESC LIMIT 1`,
  )
    .bind(farmId)
    .first<{ raw_json: string | null }>();
  if (!snap?.raw_json) return;
  let humidity: number | undefined;
  try {
    const raw = JSON.parse(snap.raw_json) as {
      current?: { main?: { humidity?: number } };
    };
    humidity = raw.current?.main?.humidity;
  } catch {
    return;
  }
  if (typeof humidity !== "number" || humidity < 80) return;

  const month = new Date().getUTCMonth() + 1;
  const plants = await env.DB.prepare(`SELECT crop_type FROM plants WHERE farm_id = ?`).bind(farmId).all();
  for (const row of plants.results ?? []) {
    const cropType = String((row as { crop_type: string }).crop_type);
    const profile = await env.DB.prepare(`SELECT high_humidity_risk_months FROM crop_profiles WHERE id = ?`)
      .bind(cropType)
      .first<{ high_humidity_risk_months: string }>();
    if (!profile) continue;
    let months: number[] = [];
    try {
      months = JSON.parse(profile.high_humidity_risk_months) as number[];
    } catch {
      continue;
    }
    if (!months.includes(month)) continue;

    await upsertInsight(
      env,
      insightId(farmId, `disease_risk_alert:${cropType}`, bucket),
      farmId,
      "disease_risk_alert",
      "warn",
      `High humidity (${Math.round(humidity)}%) aligns with ${cropType} fungal-pressure season.`,
      { cropType, humidity, month },
    );
    break;
  }
}

const HEAT_THRESH_C: Record<string, number> = {
  chili: 34,
  mango: 36,
  banana: 36,
  coconut: 36,
  guava: 36,
  papaya: 36,
};

async function runHeatStress(env: Env, farmId: string, bucket: number): Promise<void> {
  const snap = await env.DB.prepare(
    `SELECT raw_json FROM weather_snapshots WHERE farm_id = ? ORDER BY captured_at DESC LIMIT 1`,
  )
    .bind(farmId)
    .first<{ raw_json: string | null }>();
  if (!snap?.raw_json) return;
  let temp: number | undefined;
  try {
    const raw = JSON.parse(snap.raw_json) as { current?: { main?: { temp?: number } } };
    temp = raw.current?.main?.temp;
  } catch {
    return;
  }
  if (typeof temp !== "number") return;

  const plants = await env.DB.prepare(`SELECT DISTINCT crop_type FROM plants WHERE farm_id = ?`)
    .bind(farmId)
    .all();
  for (const row of plants.results ?? []) {
    const cropType = String((row as { crop_type: string }).crop_type);
    const thresh = HEAT_THRESH_C[cropType] ?? 38;
    if (temp < thresh) continue;
    await upsertInsight(
      env,
      insightId(farmId, `heat_stress:${cropType}`, bucket),
      farmId,
      "heat_stress",
      "warn",
      `Heat stress risk for ${cropType}: ${Math.round(temp)}°C (threshold ~${thresh}°C).`,
      { cropType, tempC: temp, thresholdC: thresh },
    );
  }
}

const IRR_DEADLINE_DAYS: Record<string, number> = {
  chili: 5,
  mango: 14,
  banana: 7,
  coconut: 14,
  guava: 10,
  papaya: 7,
};

async function runIrrigationDue(env: Env, farmId: string, bucket: number): Promise<void> {
  const valves = await env.DB.prepare(`SELECT id, name FROM valves WHERE farm_id = ?`).bind(farmId).all();
  for (const v of valves.results ?? []) {
    const valveId = String((v as { id: string }).id);
    const valveName = String((v as { name: string }).name);
    const last = await env.DB.prepare(
      `SELECT MAX(started_at) AS last FROM irrigation_events WHERE valve_id = ? AND farm_id = ?`,
    )
      .bind(valveId, farmId)
      .first<{ last: number | null }>();
    const lastAt = last?.last ?? 0;

    const rowsForValve = await env.DB.prepare(
      `SELECT DISTINCT p.crop_type FROM plants p
       INNER JOIN rows r ON r.id = p.row_id
       WHERE r.farm_id = ? AND r.valve_ids LIKE ?`,
    )
      .bind(farmId, `%${valveId}%`)
      .all();

    let maxDays = 7;
    for (const c of rowsForValve.results ?? []) {
      const ct = String((c as { crop_type: string }).crop_type);
      maxDays = Math.max(maxDays, IRR_DEADLINE_DAYS[ct] ?? 7);
    }

    const elapsedDays = lastAt > 0 ? (Date.now() - lastAt) / DAY_MS : 0;
    if (lastAt === 0) continue;
    if (elapsedDays < maxDays) continue;

    await upsertInsight(
      env,
      insightId(farmId, `irrigation_due:${valveId}`, bucket),
      farmId,
      "irrigation_recommendation",
      "info",
      `Valve "${valveName}" may be due for irrigation (${Math.floor(elapsedDays)} days since last event).`,
      { valveId, valveName, daysSince: Math.floor(elapsedDays), thresholdDays: maxDays },
    );
  }
}

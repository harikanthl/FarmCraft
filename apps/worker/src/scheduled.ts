import { getOpenMeteoAsOpenWeatherShapes } from "./openMeteo.js";
import type { Env } from "./repo.js";
import { centroidFromPolygonJson } from "./geoCentroid.js";
import { runIntelligenceRules } from "./intelligence/rules.js";

export const WEATHER_CRON_EXPRESSION = "0 */3 * * *";
export const OVERLAY_CRON_EXPRESSION = "0 19 * * *";

async function pruneWeatherSnapshots(env: Env): Promise<void> {
  const cutoff = Date.now() - 90 * 86400_000;
  await env.DB.prepare(`DELETE FROM weather_snapshots WHERE captured_at < ?`).bind(cutoff).run();
}

async function snapshotWeatherForAllFarms(env: Env): Promise<void> {
  let cursor: string | null = null;
  for (;;) {
    const q = cursor
      ? env.DB.prepare(`SELECT id, polygon_json FROM farms WHERE deleted_at IS NULL AND id > ? ORDER BY id ASC LIMIT 25`).bind(
          cursor,
        )
      : env.DB.prepare(`SELECT id, polygon_json FROM farms WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 25`);
    const batch = await q.all();
    const rows = (batch.results ?? []) as { id: string; polygon_json: string }[];
    if (rows.length === 0) break;
    for (const row of rows) {
      const centroid = centroidFromPolygonJson(row.polygon_json);
      if (!centroid) continue;
      try {
        const shapes = await getOpenMeteoAsOpenWeatherShapes(centroid.lat, centroid.lng);
        const raw_json = JSON.stringify(shapes);
        const cur = shapes.current as {
          main?: { temp?: number; humidity?: number };
          wind?: { speed?: number };
          weather?: { main?: string }[];
        };
        const temp_c = cur.main?.temp ?? null;
        const humidity = cur.main?.humidity ?? null;
        const wind_ms = cur.wind?.speed ?? null;
        const condition = cur.weather?.[0]?.main ?? null;
        const id = crypto.randomUUID();
        const captured = Date.now();
        await env.DB.prepare(
          `INSERT INTO weather_snapshots (id, farm_id, captured_at, temp_c, humidity, wind_ms, precipitation_mm, condition, source, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open-meteo', ?)`,
        )
          .bind(id, row.id, captured, temp_c, humidity, wind_ms, 0, condition, raw_json)
          .run();
      } catch (e) {
        console.error(`[weather-cron] farm ${row.id}`, e);
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < 25) break;
  }
}

export async function handleScheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  if (event.cron === OVERLAY_CRON_EXPRESSION) {
    console.log("[farmdots] nightly overlay cron stub — use `pnpm tiles:overlays` for local builds");
    return;
  }
  if (event.cron !== WEATHER_CRON_EXPRESSION) {
    console.warn("[farmdots] unknown cron", event.cron);
    return;
  }
  try {
    await pruneWeatherSnapshots(env);
    await snapshotWeatherForAllFarms(env);
    await runIntelligenceRules(env);
  } catch (e) {
    console.error("[scheduled] weather + intelligence failed", e);
  }
}

import { buildFarmContext, buildPlantDetail } from "@farmdots/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { FarmWorkspaceSnapshot } from "@farmdots/shared";
import {
  loadDiseaseForFarm,
  loadDiseaseForPlant,
  loadFarm,
  loadIrrigationForFarm,
  loadIrrigationForValves,
  loadPlant,
  loadPlantsForFarm,
  loadRow,
  loadRowsForFarm,
  loadValvesForFarm,
  type Env,
} from "./repo.js";
import { getOpenMeteoAsOpenWeatherShapes } from "./openMeteo.js";
import {
  localeInstruction,
  localeJsonInstruction,
  normalizeLocale,
  type AiLocale,
} from "./aiLocale.js";
import {
  fromSarvamLanguage,
  sarvamSpeak,
  sarvamTranscribe,
  sarvamTranslate,
  toSarvamLanguage,
} from "./sarvam.js";
import {
  assertFarmAccess,
  listMemberships,
  logout as endSession,
  recordFarmOwnership,
  requestLogin,
  resolveRequestUser,
  verifyLogin,
  type AuthUser,
} from "./auth.js";
import { handleScheduled } from "./scheduled.js";

type AppVariables = {
  user: AuthUser | null;
};

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("/*", cors({ origin: "*" }));

const PUBLIC_PATHS = new Set([
  "/api/v1/health",
  "/api/v1/auth/request-login",
  "/api/v1/auth/verify",
]);

app.use("/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path)) return next();
  const user = await resolveRequestUser(c.env, c.req.header("Authorization"));
  c.set("user", user);
  // We don't block here: the app is local-first and unauth callers may hit
  // some routes (`/farms/:id/context` etc.) — those routes assert auth/ownership
  // explicitly. Sync endpoints below require auth.
  return next();
});

function requireUser(c: { get: (k: "user") => AuthUser | null }):
  | { ok: true; user: AuthUser }
  | { ok: false } {
  const u = c.get("user");
  if (!u) return { ok: false };
  return { ok: true, user: u };
}

app.get("/api/v1/health", (c) => c.json({ ok: true }));

app.post("/api/v1/auth/request-login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: string };
  if (!body.email) return c.json({ error: "email required" }, 400);
  const res = await requestLogin(c.env, body.email);
  if (!res.ok) return c.json({ error: res.error }, res.status as 400 | 502);
  return c.json({ ok: true, ...(res.devCode ? { devCode: res.devCode } : {}) });
});

app.post("/api/v1/auth/verify", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    deviceLabel?: string;
  };
  if (!body.email || !body.code) return c.json({ error: "email + code required" }, 400);
  const res = await verifyLogin(c.env, body.email, body.code, body.deviceLabel);
  if (!res.ok) return c.json({ error: res.error }, res.status as 400 | 401 | 429);
  return c.json({ token: res.token, user: res.user });
});

app.get("/api/v1/auth/me", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const memberships = await listMemberships(c.env, auth.user.id);
  return c.json({ user: auth.user, memberships });
});

app.post("/api/v1/auth/logout", async (c) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token) await endSession(c.env, token);
  return c.json({ ok: true });
});

/** Phase 3 — canonical crop registry from D1 (static fallback on web when offline). */
app.get("/api/v1/crops", async (c) => {
  const res = await c.env.DB.prepare(`SELECT * FROM crop_profiles ORDER BY id ASC`).all();
  const docs = (res.results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      name: r.name,
      idealPlantSpacingM: r.ideal_plant_spacing_m,
      idealRowSpacingM: r.ideal_row_spacing_m,
      wateringHint: r.watering_hint,
      highHumidityRiskMonths: JSON.parse(String(r.high_humidity_risk_months)),
      diseaseRisks: JSON.parse(String(r.disease_risks)),
      expectedYieldRange: r.expected_yield_range,
      visualTheme: r.visual_theme,
      updatedAt: r.updated_at,
    };
  });
  return c.json({ crops: docs });
});

app.get("/api/v1/farms/:farmId/weather-history", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const farmId = c.req.param("farmId");
  const ok = await assertFarmAccess(c.env, auth.user.id, farmId);
  if (!ok.ok) return c.json({ error: ok.error }, ok.status as 403 | 404);
  const days = Math.min(Number(c.req.query("days") ?? "30"), 90);
  const since = Date.now() - days * 86400_000;
  const res = await c.env.DB.prepare(
    `SELECT captured_at, temp_c, humidity, wind_ms, precipitation_mm, condition
     FROM weather_snapshots WHERE farm_id = ? AND captured_at >= ? ORDER BY captured_at ASC`,
  )
    .bind(farmId, since)
    .all();
  return c.json({ points: res.results ?? [] });
});

app.get("/api/v1/farms/:farmId/insights", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const farmId = c.req.param("farmId");
  const ok = await assertFarmAccess(c.env, auth.user.id, farmId);
  if (!ok.ok) return c.json({ error: ok.error }, ok.status as 403 | 404);
  const since = Number(c.req.query("since") ?? "0");
  const res = await c.env.DB.prepare(
    `SELECT id, farm_id, type, severity, summary, payload_json, generated_at
     FROM ai_insights WHERE farm_id = ? AND generated_at > ? ORDER BY generated_at DESC LIMIT 100`,
  )
    .bind(farmId, since)
    .all();
  const insights = (res.results ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    let payload: Record<string, unknown> | undefined;
    try {
      payload = r.payload_json ? (JSON.parse(String(r.payload_json)) as Record<string, unknown>) : undefined;
    } catch {
      payload = undefined;
    }
    return {
      id: r.id,
      farmId: r.farm_id,
      type: r.type,
      severity: r.severity ?? undefined,
      summary: r.summary,
      payload,
      generatedAt: r.generated_at,
    };
  });
  return c.json({ insights });
});

function parseBytesRange(header: string | null | undefined): { offset: number; length: number } | undefined {
  if (!header?.startsWith("bytes=")) return undefined;
  const spec = header.slice(6).split(",")[0]?.trim();
  if (!spec) return undefined;
  const [startStr, endStr] = spec.split("-");
  if (endStr === undefined || startStr === undefined) return undefined;
  const start = Number(startStr);
  const end = Number(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return { offset: start, length: end - start + 1 };
}

/** Phase 4 — byte-range capable tile hosting from R2 for PMTiles / MapLibre. */
app.get("/tiles/:file", async (c) => {
  const file = c.req.param("file") ?? "";
  if (!file || file.includes("..") || file.includes("/")) return c.body(null, 400);
  const key = `tiles/${file}`;
  const range = parseBytesRange(c.req.header("range"));
  const obj = await c.env.ASSETS.get(key, range ? { range } : undefined);
  if (!obj) return c.body(null, 404);

  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=86400, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  if (obj.httpMetadata?.contentType) headers.set("Content-Type", obj.httpMetadata.contentType);

  if (
    range &&
    obj.range &&
    typeof obj.size === "number" &&
    "offset" in obj.range &&
    typeof obj.range.offset === "number"
  ) {
    const offset = obj.range.offset;
    const length = obj.range.length ?? obj.size - offset;
    const end = offset + length - 1;
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Range", `bytes ${offset}-${end}/${obj.size}`);
    headers.set("Content-Length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }

  if (typeof obj.size === "number") headers.set("Content-Length", String(obj.size));
  headers.set("Accept-Ranges", "bytes");
  return new Response(obj.body, { status: 200, headers });
});

type PushOp = {
  op: "upsert" | "delete";
  docId: string;
  doc: Record<string, unknown>;
};

app.post("/api/v1/sync/push", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const body = (await c.req.json()) as {
    collection: string;
    deviceId?: string;
    docs?: Record<string, unknown>[];
    ops?: PushOp[];
  };
  const db = c.env.DB;
  const ownedFarmIds = await loadOwnedFarmIds(c.env, auth.user.id);

  // Phase 2 callers send `ops`; legacy callers send `docs` (treated as upserts).
  const ops: PushOp[] = body.ops
    ? body.ops
    : (body.docs ?? []).map((doc) => ({
        op: "upsert" as const,
        docId: String(doc.id ?? ""),
        doc,
      }));

  for (const op of ops) {
    const access = await assertCollectionAccessForPush(
      c.env,
      auth.user.id,
      ownedFarmIds,
      body.collection,
      op.doc,
    );
    if (!access.ok) return c.json({ error: access.error }, access.status as 400 | 403 | 404);

    const doc = op.doc;
    const isDelete = op.op === "delete";
    switch (body.collection) {
      case "farms":
        await upsertFarm(db, doc, auth.user.id, isDelete);
        if (!isDelete) {
          await recordFarmOwnership(c.env, String(doc.id), auth.user.id);
          ownedFarmIds.add(String(doc.id));
        }
        break;
      case "rows":
        await upsertRow(db, doc, isDelete);
        break;
      case "plants":
        await upsertPlant(db, doc, isDelete);
        break;
      case "valves":
        await upsertValve(db, doc, isDelete);
        break;
      case "irrigation_events":
        await upsertIrrigation(db, doc, isDelete);
        break;
      case "disease_events":
        await upsertDisease(db, doc, isDelete);
        break;
      case "farm_events":
        await upsertFarmEvent(db, doc, isDelete);
        break;
      default:
        return c.json({ error: `Unknown collection ${body.collection}` }, 400);
    }
  }

  // Update sync_state watermark for the device so future pulls can be incremental.
  if (body.deviceId) {
    const nowMs = Date.now();
    await db
      .prepare(
        `INSERT INTO sync_state (device_id, user_id, last_pushed_at, last_pulled_at, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(device_id) DO UPDATE SET last_pushed_at = excluded.last_pushed_at, updated_at = excluded.updated_at`,
      )
      .bind(body.deviceId, auth.user.id, nowMs, nowMs)
      .run();
  }

  return c.json({ ok: true, pushed: ops.length });
});

app.get("/api/v1/sync/pull", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const collection = c.req.query("collection");
  if (!collection) return c.json({ error: "collection required" }, 400);
  const since = Number(c.req.query("since") ?? "0");
  const limit = Math.min(Number(c.req.query("limit") ?? "500"), 1000);

  // D1 Sessions API for read replication (r.md §9). The client echoes the
  // previous bookmark via `x-d1-bookmark` so subsequent reads land on the
  // same (or newer) replica.
  const inboundBookmark = c.req.header("x-d1-bookmark") ?? "first-unconstrained";
  const session = (c.env.DB as unknown as {
    withSession: (b: string) => D1Database & { getBookmark?: () => string | null };
  }).withSession(inboundBookmark);

  const farmIds = Array.from(await loadOwnedFarmIds(c.env, auth.user.id));
  if (farmIds.length === 0) {
    return jsonWithBookmark(c, session, { docs: [], nextCursor: since });
  }
  const placeholders = farmIds.map(() => "?").join(",");

  const cursorScope = `updated_at > ? AND updated_at <= strftime('%s','now') * 1000`;

  switch (collection) {
    case "farms": {
      const res = await session
        .prepare(
          `SELECT * FROM farms WHERE id IN (${placeholders}) AND ${cursorScope} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(farmRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    case "rows": {
      const res = await session
        .prepare(
          `SELECT * FROM rows WHERE farm_id IN (${placeholders}) AND ${cursorScope} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(rowRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    case "plants": {
      const res = await session
        .prepare(
          `SELECT * FROM plants WHERE farm_id IN (${placeholders}) AND ${cursorScope} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(plantRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    case "valves": {
      const res = await session
        .prepare(
          `SELECT * FROM valves WHERE farm_id IN (${placeholders}) AND ${cursorScope} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(valveRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    case "irrigation_events": {
      const res = await session
        .prepare(
          `SELECT * FROM irrigation_events WHERE farm_id IN (${placeholders}) AND ${cursorScope} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(irrRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    case "disease_events": {
      const res = await session
        .prepare(
          `SELECT d.* FROM disease_events d INNER JOIN plants p ON p.id = d.plant_id WHERE p.farm_id IN (${placeholders}) AND d.updated_at > ? AND d.updated_at <= strftime('%s','now') * 1000 ORDER BY d.updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(disRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    case "farm_events": {
      const res = await session
        .prepare(
          `SELECT * FROM farm_events WHERE farm_id IN (${placeholders}) AND ${cursorScope} ORDER BY updated_at ASC LIMIT ?`,
        )
        .bind(...farmIds, since, limit)
        .all();
      const docs = (res.results ?? []).map(farmEventRowToClientDoc);
      const nextCursor = docs.length > 0 ? Number(docs[docs.length - 1].updatedAt ?? since) : since;
      return jsonWithBookmark(c, session, { docs, nextCursor });
    }
    default:
      return c.json({ error: `Unknown collection ${collection}` }, 400);
  }
});

function jsonWithBookmark(
  c: {
    header: (k: string, v: string) => void;
    json: (b: unknown) => Response;
  },
  session: { getBookmark?: () => string | null },
  body: { docs: Record<string, unknown>[]; nextCursor: number },
): Response {
  const bm = typeof session.getBookmark === "function" ? session.getBookmark() : null;
  if (bm) c.header("x-d1-bookmark", bm);
  return c.json(body);
}

/** Returns the set of farm ids the user can read (owner or any member role). */
async function loadOwnedFarmIds(env: Env, userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const dev = userId === "dev-user";
  if (dev) {
    const res = await env.DB.prepare("SELECT id FROM farms").all();
    for (const row of res.results ?? []) ids.add(String((row as Record<string, unknown>).id));
    return ids;
  }
  const own = await env.DB.prepare("SELECT id FROM farms WHERE owner_id = ?")
    .bind(userId)
    .all();
  for (const row of own.results ?? []) ids.add(String((row as Record<string, unknown>).id));
  const mem = await env.DB.prepare("SELECT farm_id FROM farm_members WHERE user_id = ?")
    .bind(userId)
    .all();
  for (const row of mem.results ?? []) ids.add(String((row as Record<string, unknown>).farm_id));
  return ids;
}

async function assertCollectionAccessForPush(
  env: Env,
  userId: string,
  ownedFarmIds: Set<string>,
  collection: string,
  doc: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (userId === "dev-user") return { ok: true };
  switch (collection) {
    case "farms": {
      const id = String(doc.id ?? "");
      if (!id) return { ok: false, status: 400, error: "farm id required" };
      const existing = await env.DB.prepare("SELECT owner_id FROM farms WHERE id = ?")
        .bind(id)
        .first<{ owner_id: string }>();
      if (existing && existing.owner_id !== userId) {
        const member = await env.DB.prepare(
          "SELECT role FROM farm_members WHERE farm_id = ? AND user_id = ?",
        )
          .bind(id, userId)
          .first<{ role: string }>();
        if (!member || (member.role !== "owner" && member.role !== "manager")) {
          return { ok: false, status: 403, error: "forbidden" };
        }
      }
      // New farms are claimed by the signed-in user regardless of the
      // ownerId the client sent (e.g. legacy "local"). Existing farms keep
      // their canonical owner_id (handled in upsertFarm).
      return { ok: true };
    }
    case "rows":
    case "plants":
    case "valves":
    case "irrigation_events":
    case "farm_events": {
      const farmId = String(doc.farmId ?? "");
      if (!farmId) return { ok: false, status: 400, error: "farmId required" };
      if (!ownedFarmIds.has(farmId)) {
        const access = await assertFarmAccess(env, userId, farmId, "worker");
        if (!access.ok) return access;
        ownedFarmIds.add(farmId);
      }
      return { ok: true };
    }
    case "disease_events": {
      const plantId = String(doc.plantId ?? "");
      if (!plantId) return { ok: false, status: 400, error: "plantId required" };
      const plant = await env.DB.prepare("SELECT farm_id FROM plants WHERE id = ?")
        .bind(plantId)
        .first<{ farm_id: string }>();
      if (!plant) return { ok: false, status: 404, error: "plant not found" };
      if (!ownedFarmIds.has(plant.farm_id)) {
        const access = await assertFarmAccess(env, userId, plant.farm_id, "worker");
        if (!access.ok) return access;
        ownedFarmIds.add(plant.farm_id);
      }
      return { ok: true };
    }
    default:
      return { ok: false, status: 400, error: `Unknown collection ${collection}` };
  }
}

app.get("/api/v1/farms/:id/context", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  const access = await assertFarmAccess(c.env, auth.user.id, id);
  if (!access.ok) return c.json({ error: access.error }, access.status as 403 | 404);
  const db = c.env.DB;
  const farm = await loadFarm(db, id);
  if (!farm) return c.json({ error: "Not found" }, 404);
  const plants = await loadPlantsForFarm(db, id);
  const irrigationEvents = await loadIrrigationForFarm(db, id);
  const diseaseEvents = await loadDiseaseForFarm(db, id);
  const ctx = buildFarmContext({
    farm,
    plants,
    irrigationEvents,
    diseaseEvents,
  });
  return c.json(ctx);
});

app.get("/api/v1/farms/:id/workspace", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  const access = await assertFarmAccess(c.env, auth.user.id, id);
  if (!access.ok) return c.json({ error: access.error }, access.status as 403 | 404);
  const db = c.env.DB;
  const farm = await loadFarm(db, id);
  if (!farm) return c.json({ error: "Not found" }, 404);
  const [rows, plants, valves] = await Promise.all([
    loadRowsForFarm(db, id),
    loadPlantsForFarm(db, id),
    loadValvesForFarm(db, id),
  ]);
  const snapshot: FarmWorkspaceSnapshot = {
    farm,
    rows,
    plants: plants.map((p) => ({
      id: p.id,
      farmId: p.farmId,
      rowId: p.rowId,
      label: p.label,
      lat: p.lat,
      lng: p.lng,
      healthStatus: p.healthStatus,
    })),
    valves: valves.map((v) => ({
      id: v.id,
      farmId: v.farmId,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      status: v.status,
    })),
  };
  return c.json(snapshot);
});

app.get("/api/v1/plants/:id", async (c) => {
  const auth = requireUser(c);
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  const db = c.env.DB;
  const plant = await loadPlant(db, id);
  if (!plant) return c.json({ error: "Not found" }, 404);
  const access = await assertFarmAccess(c.env, auth.user.id, plant.farmId);
  if (!access.ok) return c.json({ error: access.error }, access.status as 403 | 404);
  const row = plant.rowId ? ((await loadRow(db, plant.rowId)) ?? undefined) : undefined;
  const valvesForRow =
    row != null
      ? (await loadValvesForFarm(db, plant.farmId)).filter((v) => row.valveIds.includes(v.id))
      : [];
  const irrigationEvents =
    row != null ? await loadIrrigationForValves(db, plant.farmId, row.valveIds) : [];
  const diseaseEvents = await loadDiseaseForPlant(db, plant.id);
  const detail = buildPlantDetail({
    plant,
    row,
    valvesForRow,
    irrigationEvents,
    diseaseEvents,
  });
  return c.json(detail);
});

app.get("/api/v1/weather/forecast", async (c) => {
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");
  if (!lat || !lng) return c.json({ error: "lat and lng required" }, 400);
  try {
    const { forecast } = await getOpenMeteoAsOpenWeatherShapes(Number(lat), Number(lng));
    return c.json(forecast);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "open-meteo failed" }, 502);
  }
});

app.get("/api/v1/weather/current", async (c) => {
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");
  if (!lat || !lng) return c.json({ error: "lat and lng required" }, 400);
  try {
    const { current } = await getOpenMeteoAsOpenWeatherShapes(Number(lat), Number(lng));
    return c.json(current);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "open-meteo failed" }, 502);
  }
});

app.post("/api/v1/ai/calendar-draft", async (c) => {
  const geminiKey = c.env.GEMINI_API_KEY;
  if (!geminiKey) return c.json({ error: "GEMINI_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as { prompt: string; farmContext?: unknown; locale?: string };
  const locale = normalizeLocale(body.locale);
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
  const jsonPreamble = localeJsonInstruction(locale);
  const instruction = `${jsonPreamble ? `${jsonPreamble}\n\n` : ""}You help farmers schedule operations. Respond with ONLY valid JSON, no markdown, no prose.
Schema: {"drafts":[{"title":"string","type":"irrigation|harvest|disease_check|fertilizer|spraying|pruning|soil_test|other","startIso":"ISO8601 datetime","endIso":"ISO8601 datetime","allDay":boolean,"description":"optional string"}]}
Maximum 5 drafts. Times must be realistic for the next 14 days.\n\nUser request:\n${body.prompt}`;
  const ctx =
    body.farmContext != null ? `\n\nFarm context JSON:\n${JSON.stringify(body.farmContext)}` : "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: instruction + ctx }] }],
    }),
  });
  if (!res.ok) return c.json({ error: await res.text() }, 502);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(text.trim()) as { drafts?: unknown };
    const drafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];
    return c.json({ drafts });
  } catch {
    return c.json({ drafts: [], raw: text });
  }
});

app.post("/api/v1/ai/chat", async (c) => {
  const key = c.env.GEMINI_API_KEY;
  if (!key) return c.json({ error: "GEMINI_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as { prompt: string; farmContext?: unknown; locale?: string };
  const locale = normalizeLocale(body.locale);
  const reply = await geminiText(key, body.prompt, body.farmContext, locale);
  return c.json({ reply });
});

/** Short farm summary (3–5 bullets) grounded in the provided FarmContext. */
app.post("/api/v1/ai/summary", async (c) => {
  const key = c.env.GEMINI_API_KEY;
  if (!key) return c.json({ error: "GEMINI_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as { farmContext: unknown; locale?: string };
  const locale = normalizeLocale(body.locale);
  const instruction = [
    "You write a concise 3–5 bullet summary for a farmer about the state of their farm.",
    "Use plain language, no markdown headings, no preamble.",
    "Focus on plant health distribution, recent disease/irrigation events, and current weather risk if present.",
  ].join("\n");
  const reply = await geminiText(key, instruction, body.farmContext, locale);
  return c.json({ reply });
});

/** Grounded farm Q&A — model is restricted to the provided context. */
app.post("/api/v1/ai/qa", async (c) => {
  const key = c.env.GEMINI_API_KEY;
  if (!key) return c.json({ error: "GEMINI_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as { question: string; farmContext?: unknown; locale?: string };
  const locale = normalizeLocale(body.locale);
  const instruction = [
    "Answer the user's question using only the Farm context JSON below.",
    "If the context lacks the info, say so explicitly — do not invent values.",
    "Reply in 1–3 sentences.",
    "",
    `Question: ${body.question}`,
  ].join("\n");
  const reply = await geminiText(key, instruction, body.farmContext, locale);
  return c.json({ reply });
});

/**
 * Plant-health vision endpoint — optional. Accepts an R2 image key or an
 * inline base64 PNG/JPEG plus context, and asks Gemini for a structured
 * `{diagnosis, confidence, recommendations[]}` reply.
 */
app.post("/api/v1/ai/plant-health", async (c) => {
  const key = c.env.GEMINI_API_KEY;
  if (!key) return c.json({ error: "GEMINI_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as {
    imageBase64?: string;
    mimeType?: string;
    imageKey?: string;
    farmContext?: unknown;
    note?: string;
    locale?: string;
  };
  const locale = normalizeLocale(body.locale);
  let imageB64 = body.imageBase64 ?? null;
  let mime = body.mimeType ?? "image/jpeg";
  if (!imageB64 && body.imageKey) {
    const obj = await c.env.ASSETS.get(body.imageKey);
    if (!obj) return c.json({ error: "image not found" }, 404);
    const buf = await obj.arrayBuffer();
    imageB64 = arrayBufferToBase64(buf);
    mime = obj.httpMetadata?.contentType ?? mime;
  }
  if (!imageB64) return c.json({ error: "imageBase64 or imageKey required" }, 400);

  const instruction = [
    localeJsonInstruction(locale),
    "You analyse a single photograph of a plant leaf or canopy.",
    "Respond with ONLY valid JSON, no markdown.",
    'Schema: {"diagnosis":"short label","confidence":0-1,"recommendations":["string"]}',
    body.note ? `Farmer note: ${body.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Array<Record<string, unknown>> = [{ text: instruction }];
  if (body.farmContext) parts.push({ text: `Farm context JSON:\n${JSON.stringify(body.farmContext)}` });
  parts.push({ inlineData: { mimeType: mime, data: imageB64 } });

  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) return c.json({ error: await res.text() }, 502);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return c.json(JSON.parse(text.trim()));
  } catch {
    return c.json({ diagnosis: "unknown", confidence: 0, recommendations: [], raw: text });
  }
});

/**
 * Voice routes (`ai.md`).
 *
 * Three Sarvam-backed proxies plus a Gemini structured-output intent parser.
 * All return 503 when the relevant key is missing so the client can degrade
 * gracefully (PRD section 8 idle state stays visible).
 */
app.post("/api/v1/voice/transcribe", async (c) => {
  const key = c.env.SARVAM_API_KEY;
  if (!key) return c.json({ error: "SARVAM_API_KEY not configured" }, 503);
  const form = await c.req.formData();
  const audio = form.get("audio") as unknown as Blob | null;
  if (!audio || typeof (audio as Blob).arrayBuffer !== "function")
    return c.json({ error: "audio blob required" }, 400);
  const languageCode = (form.get("language_code") ?? "auto") as string;
  const mode = ((form.get("mode") ?? "transcribe") as string) === "translate" ? "translate" : "transcribe";
  try {
    const result = await sarvamTranscribe(key, {
      audio,
      languageCode: languageCode === "auto" ? undefined : languageCode,
      mode,
    });
    return c.json({
      transcript: result.transcript,
      language: fromSarvamLanguage(result.languageCode),
      languageCode: result.languageCode,
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "stt failed" }, 502);
  }
});

app.post("/api/v1/voice/parse-intent", async (c) => {
  const key = c.env.GEMINI_API_KEY;
  if (!key) return c.json({ error: "GEMINI_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as {
    transcript: string;
    locale?: string;
    workspaceContext?: {
      farmId?: string;
      selectedValveIds?: string[];
      selectedRowIds?: string[];
      selectedPlantIds?: string[];
    };
    farmContext?: unknown;
  };
  const locale = normalizeLocale(body.locale);
  const responseSchema = {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: [
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
        ],
      },
      operationType: {
        type: "string",
        enum: [
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
        ],
        nullable: true,
      },
      farmId: { type: "string", nullable: true },
      valveIds: { type: "array", items: { type: "string" } },
      rowIds: { type: "array", items: { type: "string" } },
      plantIds: { type: "array", items: { type: "string" } },
      recurrence: { type: "string", nullable: true },
      startIso: { type: "string", nullable: true },
      endIso: { type: "string", nullable: true },
      notes: { type: "string", nullable: true },
      spokenLanguage: { type: "string", nullable: true },
      spokenReply: { type: "string", nullable: true },
      confidence: { type: "number" },
      clarification: { type: "string", nullable: true },
    },
    required: ["type", "valveIds", "rowIds", "plantIds", "confidence"],
  };

  const ctxParts: string[] = [];
  if (body.workspaceContext) {
    ctxParts.push(`Workspace selection JSON:\n${JSON.stringify(body.workspaceContext)}`);
  }
  if (body.farmContext) {
    ctxParts.push(`Farm context JSON:\n${JSON.stringify(body.farmContext)}`);
  }
  const localeNote = localeJsonInstruction(locale);

  const instruction = [
    localeNote,
    "You convert a farmer's spoken transcript into a structured FarmDots voice intent.",
    "Operational intents map to FarmEvent drafts (irrigation, fertilizer, spraying, pruning, harvest, disease_check, soil_test, other).",
    "Contextual intents are query / summary / alert / weather.",
    "Prefer entity IDs from the workspace selection when the user references 'this valve', 'these rows', etc.",
    "Resolve relative dates (tomorrow, next Monday) to startIso/endIso in ISO 8601, defaulting to early morning if no time is given.",
    "Encode recurrence as an RFC 5545 RRULE string (e.g. FREQ=DAILY;INTERVAL=3).",
    "Set `confidence` between 0 and 1: above 0.9 only if you are sure of the operation and targets; 0.6-0.9 if minor ambiguity; below 0.6 must also populate `clarification` with a short question to ask the user.",
    "Populate `spokenReply` with one short calm sentence to read back (PRD section 16) — for create_operation use a confirmation phrase like 'Irrigation scheduled.'",
    "Reply with ONLY a valid JSON object matching the response schema.",
    ctxParts.join("\n\n"),
    `Transcript: ${body.transcript}`,
  ]
    .filter(Boolean)
    .join("\n");

  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });
  if (!res.ok) return c.json({ error: await res.text() }, 502);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
    const intent = {
      type: parsed.type ?? "unknown",
      operationType: parsed.operationType ?? undefined,
      farmId: parsed.farmId ?? body.workspaceContext?.farmId,
      valveIds: Array.isArray(parsed.valveIds) ? parsed.valveIds : [],
      rowIds: Array.isArray(parsed.rowIds) ? parsed.rowIds : [],
      plantIds: Array.isArray(parsed.plantIds) ? parsed.plantIds : [],
      recurrence: parsed.recurrence ?? undefined,
      startIso: parsed.startIso ?? undefined,
      endIso: parsed.endIso ?? undefined,
      notes: parsed.notes ?? undefined,
      spokenLanguage: parsed.spokenLanguage ?? locale,
      spokenReply: parsed.spokenReply ?? undefined,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      clarification: parsed.clarification ?? undefined,
    };
    return c.json({ intent });
  } catch {
    return c.json({
      intent: {
        type: "unknown",
        valveIds: [],
        rowIds: [],
        plantIds: [],
        confidence: 0,
        clarification: "Sorry — could you repeat that?",
      },
      raw: text,
    });
  }
});

app.post("/api/v1/voice/speak", async (c) => {
  const key = c.env.SARVAM_API_KEY;
  if (!key) return c.json({ error: "SARVAM_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as { text: string; language?: string; speaker?: string; pace?: number };
  if (!body.text) return c.json({ error: "text required" }, 400);
  try {
    const result = await sarvamSpeak(key, {
      text: body.text,
      targetLanguageCode: toSarvamLanguage(body.language),
      speaker: body.speaker,
      pace: body.pace,
    });
    return c.json({ audioBase64: result.audioBase64, mimeType: result.mimeType });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "tts failed" }, 502);
  }
});

app.post("/api/v1/voice/translate", async (c) => {
  const key = c.env.SARVAM_API_KEY;
  if (!key) return c.json({ error: "SARVAM_API_KEY not configured" }, 503);
  const body = (await c.req.json()) as { text: string; source?: string; target?: string };
  if (!body.text) return c.json({ error: "text required" }, 400);
  try {
    const result = await sarvamTranslate(key, {
      input: body.text,
      sourceLanguageCode: body.source ? toSarvamLanguage(body.source) : "auto",
      targetLanguageCode: toSarvamLanguage(body.target ?? "en"),
    });
    return c.json({ translatedText: result.translatedText });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "translate failed" }, 502);
  }
});

/**
 * Proxy to the R Plumber analytics service.
 *
 * Frontend never talks to the R host directly. Endpoints are passed through
 * verbatim and the Worker decorates with the service token + CORS protection.
 */
app.post("/api/v1/analytics/:endpoint{.+}", async (c) => {
  const base = c.env.ANALYTICS_R_URL;
  if (!base) return c.json({ error: "ANALYTICS_R_URL not configured", configured: false }, 503);
  const endpoint = c.req.param("endpoint");
  if (!endpoint || endpoint.includes("..")) return c.json({ error: "invalid endpoint" }, 400);
  const body = await c.req.text();
  const url = `${base.replace(/\/$/, "")}/${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (c.env.ANALYTICS_R_TOKEN) headers["Authorization"] = `Bearer ${c.env.ANALYTICS_R_TOKEN}`;
  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) return c.json({ error: await res.text() }, 502);
  return c.json(await res.json());
});

/** Upload raw bytes to R2 (Worker-mediated; avoids client-side signing). */
app.put("/api/v1/uploads/:farmId/:filename", async (c) => {
  const farmId = c.req.param("farmId");
  const filename = c.req.param("filename");
  const bucket = c.env.ASSETS;
  const key = `${farmId}/${crypto.randomUUID()}-${filename}`;
  const buf = await c.req.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: { contentType: c.req.header("content-type") ?? "application/octet-stream" },
  });
  return c.json({ key });
});

export { app };
export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};

async function geminiText(
  key: string,
  prompt: string,
  farmContext?: unknown,
  locale: AiLocale = "en",
): Promise<string> {
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const parts: Array<{ text: string }> = [];
  const preamble = localeInstruction(locale);
  if (preamble) parts.push({ text: preamble });
  if (farmContext != null) parts.push({ text: `Farm context JSON:\n${JSON.stringify(farmContext)}` });
  parts.push({ text: prompt });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) return "";
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function upsertFarm(
  db: D1Database,
  doc: Record<string, unknown>,
  userId: string,
  isDelete = false,
) {
  const deletedAt = isDelete ? (doc.deletedAt ?? Date.now()) : (doc.deletedAt ?? null);
  await db
    .prepare(
      `INSERT INTO farms (id, owner_id, name, polygon_json, irrigation_type, primary_crop_id, created_at, updated_at, version, source_device_id, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         polygon_json = excluded.polygon_json,
         irrigation_type = excluded.irrigation_type,
         primary_crop_id = excluded.primary_crop_id,
         updated_at = excluded.updated_at,
         version = excluded.version,
         source_device_id = excluded.source_device_id,
         deleted_at = excluded.deleted_at,
         last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      userId,
      doc.name,
      doc.polygonJson,
      doc.irrigationType,
      doc.primaryCropId ?? null,
      doc.createdAt,
      doc.updatedAt,
      doc.version,
      doc.sourceDeviceId ?? null,
      deletedAt,
      Date.now(),
    )
    .run();
}

function delMs(doc: Record<string, unknown>, isDelete: boolean): number | null {
  if (isDelete) return Number(doc.deletedAt ?? Date.now());
  return doc.deletedAt == null ? null : Number(doc.deletedAt);
}

async function upsertRow(db: D1Database, doc: Record<string, unknown>, isDelete = false) {
  await db
    .prepare(
      `INSERT INTO rows (id, farm_id, name, order_index, valve_ids, created_at, updated_at, version, source_device_id, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         order_index = excluded.order_index,
         valve_ids = excluded.valve_ids,
         updated_at = excluded.updated_at,
         version = excluded.version,
         source_device_id = excluded.source_device_id,
         deleted_at = excluded.deleted_at,
         last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      doc.farmId,
      doc.name,
      doc.orderIndex,
      JSON.stringify(doc.valveIds ?? []),
      doc.createdAt,
      doc.updatedAt ?? Date.now(),
      doc.version ?? 1,
      doc.sourceDeviceId ?? null,
      delMs(doc, isDelete),
      Date.now(),
    )
    .run();
}

async function upsertPlant(db: D1Database, doc: Record<string, unknown>, isDelete = false) {
  await db
    .prepare(
      `INSERT INTO plants (id, farm_id, row_id, label, lat, lng, crop_type, planted_date, age, yearly_yield,
        health_status, watering_issues, disease_issues, drip_issues, notes, created_at, updated_at, version, source_device_id, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         farm_id = excluded.farm_id,
         row_id = excluded.row_id,
         label = excluded.label,
         lat = excluded.lat,
         lng = excluded.lng,
         crop_type = excluded.crop_type,
         planted_date = excluded.planted_date,
         age = excluded.age,
         yearly_yield = excluded.yearly_yield,
         health_status = excluded.health_status,
         watering_issues = excluded.watering_issues,
         disease_issues = excluded.disease_issues,
         drip_issues = excluded.drip_issues,
         notes = excluded.notes,
         updated_at = excluded.updated_at,
         version = excluded.version,
         source_device_id = excluded.source_device_id,
         deleted_at = excluded.deleted_at,
         last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      doc.farmId,
      doc.rowId,
      doc.label,
      doc.lat,
      doc.lng,
      doc.cropType,
      doc.plantedDate ?? null,
      doc.age ?? null,
      doc.yearlyYield ?? null,
      doc.healthStatus,
      doc.wateringIssues ?? null,
      doc.diseaseIssues ?? null,
      doc.dripIssues ?? null,
      doc.notes ?? null,
      doc.createdAt,
      doc.updatedAt,
      doc.version,
      doc.sourceDeviceId ?? null,
      delMs(doc, isDelete),
      Date.now(),
    )
    .run();
}

async function upsertValve(db: D1Database, doc: Record<string, unknown>, isDelete = false) {
  await db
    .prepare(
      `INSERT INTO valves (id, farm_id, name, lat, lng, connected_rows, status, notes, created_at, updated_at, version, source_device_id, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         farm_id = excluded.farm_id,
         name = excluded.name,
         lat = excluded.lat,
         lng = excluded.lng,
         connected_rows = excluded.connected_rows,
         status = excluded.status,
         notes = excluded.notes,
         updated_at = excluded.updated_at,
         version = excluded.version,
         source_device_id = excluded.source_device_id,
         deleted_at = excluded.deleted_at,
         last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      doc.farmId,
      doc.name,
      doc.lat,
      doc.lng,
      JSON.stringify(doc.connectedRows ?? []),
      doc.status,
      doc.notes ?? null,
      doc.createdAt,
      doc.updatedAt,
      doc.version,
      doc.sourceDeviceId ?? null,
      delMs(doc, isDelete),
      Date.now(),
    )
    .run();
}

async function upsertIrrigation(db: D1Database, doc: Record<string, unknown>, isDelete = false) {
  await db
    .prepare(
      `INSERT INTO irrigation_events (id, valve_id, farm_id, started_at, ended_at, issue, notes, updated_at, version, source_device_id, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         valve_id = excluded.valve_id,
         farm_id = excluded.farm_id,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         issue = excluded.issue,
         notes = excluded.notes,
         updated_at = excluded.updated_at,
         version = excluded.version,
         source_device_id = excluded.source_device_id,
         deleted_at = excluded.deleted_at,
         last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      doc.valveId,
      doc.farmId,
      doc.startedAt,
      doc.endedAt ?? null,
      doc.issue ?? null,
      doc.notes ?? null,
      doc.updatedAt ?? Date.now(),
      doc.version ?? 1,
      doc.sourceDeviceId ?? null,
      delMs(doc, isDelete),
      Date.now(),
    )
    .run();
}

async function upsertDisease(db: D1Database, doc: Record<string, unknown>, isDelete = false) {
  await db
    .prepare(
      `INSERT INTO disease_events (id, plant_id, disease_type, severity, treatment, notes, created_at, updated_at, version, source_device_id, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         plant_id = excluded.plant_id,
         disease_type = excluded.disease_type,
         severity = excluded.severity,
         treatment = excluded.treatment,
         notes = excluded.notes,
         updated_at = excluded.updated_at,
         version = excluded.version,
         source_device_id = excluded.source_device_id,
         deleted_at = excluded.deleted_at,
         last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      doc.plantId,
      doc.diseaseType,
      doc.severity,
      doc.treatment ?? null,
      doc.notes ?? null,
      doc.createdAt,
      doc.updatedAt ?? Date.now(),
      doc.version ?? 1,
      doc.sourceDeviceId ?? null,
      delMs(doc, isDelete),
      Date.now(),
    )
    .run();
}

async function upsertFarmEvent(db: D1Database, doc: Record<string, unknown>, isDelete = false) {
  await db
    .prepare(
      `INSERT INTO farm_events (
        id, farm_id, type, title, description, event_start, event_end, all_day,
        recurrence_rule, row_ids, valve_ids, plant_ids, crop_type, weather_dependent,
        priority, status, completed_at, created_at, updated_at, version, source_device_id, deleted_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        farm_id = excluded.farm_id,
        type = excluded.type,
        title = excluded.title,
        description = excluded.description,
        event_start = excluded.event_start,
        event_end = excluded.event_end,
        all_day = excluded.all_day,
        recurrence_rule = excluded.recurrence_rule,
        row_ids = excluded.row_ids,
        valve_ids = excluded.valve_ids,
        plant_ids = excluded.plant_ids,
        crop_type = excluded.crop_type,
        weather_dependent = excluded.weather_dependent,
        priority = excluded.priority,
        status = excluded.status,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at,
        version = excluded.version,
        source_device_id = excluded.source_device_id,
        deleted_at = excluded.deleted_at,
        last_synced_at = excluded.last_synced_at`,
    )
    .bind(
      doc.id,
      doc.farmId,
      doc.type,
      doc.title,
      doc.description ?? null,
      doc.start,
      doc.end,
      doc.allDay ? 1 : 0,
      doc.recurrenceRule ?? null,
      JSON.stringify(doc.rowIds ?? []),
      JSON.stringify(doc.valveIds ?? []),
      JSON.stringify(doc.plantIds ?? []),
      doc.cropType ?? null,
      doc.weatherDependent == null ? null : doc.weatherDependent ? 1 : 0,
      doc.priority ?? null,
      doc.status,
      doc.completedAt ?? null,
      doc.createdAt,
      doc.updatedAt,
      doc.version,
      doc.sourceDeviceId ?? null,
      delMs(doc, isDelete),
      Date.now(),
    )
    .run();
}

function syncMeta(r: Record<string, unknown>) {
  return {
    updatedAt: r.updated_at,
    version: r.version,
    sourceDeviceId: r.source_device_id ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
    lastSyncedAt: r.last_synced_at ?? undefined,
  };
}

function farmRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    polygonJson: r.polygon_json,
    irrigationType: r.irrigation_type,
    primaryCropId: r.primary_crop_id ?? undefined,
    createdAt: r.created_at,
    ...syncMeta(r),
  };
}

function rowRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    farmId: r.farm_id,
    name: r.name,
    orderIndex: r.order_index,
    valveIds: JSON.parse(String(r.valve_ids)),
    createdAt: r.created_at,
    ...syncMeta(r),
  };
}

function plantRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    farmId: r.farm_id,
    rowId: r.row_id,
    label: r.label,
    lat: r.lat,
    lng: r.lng,
    cropType: r.crop_type,
    plantedDate: r.planted_date ?? undefined,
    age: r.age ?? undefined,
    yearlyYield: r.yearly_yield ?? undefined,
    healthStatus: r.health_status,
    wateringIssues: r.watering_issues ?? undefined,
    diseaseIssues: r.disease_issues ?? undefined,
    dripIssues: r.drip_issues ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    ...syncMeta(r),
  };
}

function valveRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    farmId: r.farm_id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    connectedRows: JSON.parse(String(r.connected_rows)),
    status: r.status,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    ...syncMeta(r),
  };
}

function irrRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    valveId: r.valve_id,
    farmId: r.farm_id,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? undefined,
    issue: r.issue ?? undefined,
    notes: r.notes ?? undefined,
    ...syncMeta(r),
  };
}

function disRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    plantId: r.plant_id,
    diseaseType: r.disease_type,
    severity: r.severity,
    treatment: r.treatment ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    ...syncMeta(r),
  };
}

function farmEventRowToClientDoc(r: Record<string, unknown>) {
  return {
    id: r.id,
    farmId: r.farm_id,
    type: r.type,
    title: r.title,
    description: r.description ?? undefined,
    start: r.event_start,
    end: r.event_end,
    allDay: Boolean(r.all_day),
    recurrenceRule: r.recurrence_rule ?? undefined,
    rowIds: JSON.parse(String(r.row_ids ?? "[]")),
    valveIds: JSON.parse(String(r.valve_ids ?? "[]")),
    plantIds: JSON.parse(String(r.plant_ids ?? "[]")),
    cropType: r.crop_type ?? undefined,
    weatherDependent:
      r.weather_dependent == null ? undefined : Boolean(r.weather_dependent),
    priority: r.priority ?? undefined,
    status: r.status,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at,
    ...syncMeta(r),
  };
}

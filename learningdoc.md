# FarmCraft (FarmDots) — Learning Guide

A study-oriented map of **algorithms**, **data structures**, and **system design** used in this repo. FarmCraft is an offline-first, map-based farm operating system: draw farm boundaries, lay out rows and plants, log irrigation and disease, sync to the cloud, and layer AI/voice on top.

Primary code lives in:

| Path | Role |
|------|------|
| `apps/web` | React + Vite client (RxDB, Leaflet/Konva, sync, intelligence UI) |
| `apps/worker` | Cloudflare Worker (Hono API, D1, cron, AI/voice proxies) |
| `packages/shared` | Zod entities, GeoJSON types, AI context builders |
| `packages/crop-profiles` | Crop templates (spacing, defaults) |

---

## 1. System design (big picture)

### 1.1 Local-first operational runtime

```
User (browser)
    → RxDB (IndexedDB)
    → Mutation gateway (hooks → pending_sync_operations)
    → SyncEngine (push batches + pull by cursor)
    → Cloudflare Worker (/api/v1/sync/*)
    → Cloudflare D1 (canonical SQL)
```

**Design choice:** The UI reads and writes **locally first**. Network sync is asynchronous. The app stays usable on poor connectivity (typical for farms).

- **Local DB:** RxDB collections mirror domain entities (`farms`, `rows`, `plants`, `valves`, events, sync queues).
- **Cloud DB:** D1 stores the same entities normalized for multi-device access and server-side jobs (weather cron, intelligence rules).

See: `apps/web/src/db/init.ts`, `apps/web/src/hooks/useDatabase.ts`, `FEATURES.md`.

### 1.2 Monorepo boundaries

| Layer | Responsibility |
|-------|----------------|
| **Web** | UX, geospatial editing, Konva workspace, conflict UI, client-side scoring |
| **Worker** | Auth, ownership checks, sync upsert/pull, Gemini/Sarvam proxies, scheduled weather + rules |
| **Shared** | Single source of truth for entity shapes and AI JSON snapshots |

This split keeps **heavy geospatial work on the client** and **authoritative persistence + batch jobs on the edge**.

### 1.3 API surface (worker)

Hono app on Cloudflare Workers (`apps/worker/src/index.ts`):

| Area | Endpoints (examples) |
|------|----------------------|
| Health | `GET /api/v1/health` |
| Auth | Magic-code login, session Bearer tokens |
| Sync | `POST /api/v1/sync/push`, `GET /api/v1/sync/pull` |
| AI | Farm/plant context JSON, `POST /api/v1/ai/chat` |
| Voice | Sarvam STT/TTS orchestration (when configured) |

**Auth model:** Session token per user; sync and farm APIs scoped via `farm_members` (owner/manager/worker/viewer). Legacy dev token still supported for local testing.

### 1.4 Read replication (D1 Sessions)

Pull requests accept `x-d1-bookmark` and echo an updated bookmark. The client stores this in `localStorage` so repeated pulls hit a consistent replica view—important when D1 read replication is enabled.

See: `apps/web/src/sync/cursors.ts`, worker `GET /api/v1/sync/pull`.

### 1.5 Scheduled edge jobs

Cron handlers (`apps/worker/src/scheduled.ts`):

- **Weather (every 3h):** Paginate farms → centroid from polygon → Open-Meteo → insert `weather_snapshots` → prune >90 days.
- **Intelligence:** Run rule engine after weather data exists.
- **Overlays:** Stub for PMTiles nightly builds (local script: `pnpm tiles:overlays`).

### 1.6 Voice + AI pipeline (when enabled)

```
Mic → Sarvam STT → Gemini intent JSON → VoiceDraft → user confirm
    → farm_events (RxDB) → optional Sarvam TTS
```

Offline path: queue in `pending_voice_operations`, replay when online.

See: `apps/web/src/voice/useVoiceWorkflow.ts`, `ai.md` (product spec).

### 1.7 Analytics (optional R service)

R + Plumber is **analytics-only** (not the sync path): worker can call `ANALYTICS_R_URL` for heavier stats. Client-side intelligence (health score, spatial bands) runs in TypeScript today.

---

## 2. Data structures

### 2.1 Domain graph (in-memory model)

Entities form a **farm-scoped hierarchy**:

```
Farm (GeoJSON polygon)
  ├── Row[] (orderIndex, valveIds[])
  │     └── Plant[] (lat/lng, health, yield, issues)
  ├── Valve[] (lat/lng, connectedRows[] derived)
  ├── IrrigationEvent[] (valveId, time range, issue)
  ├── DiseaseEvent[] (plantId, severity)
  └── FarmEvent[] (calendar: irrigation, harvest, etc.)
```

**Important invariant:** `Row.valveIds` is the **source of truth** for irrigation topology; `Valve.connectedRows` is a **derived cache** rebuilt by scanning rows (`refreshValveConnectionsForFarm`).

### 2.2 RxDB collections (client)

| Collection | Purpose |
|------------|---------|
| `farms`, `rows`, `plants`, `valves` | Core spatial + topology |
| `irrigation_events`, `disease_events`, `farm_events` | Operational logs + calendar |
| `pending_sync_operations` | Outbound sync queue |
| `pending_conflicts` | Manual-merge queue for geometry conflicts |
| `pending_voice_operations` | Offline voice intents |

Schemas: `apps/web/src/db/schemas.ts`. Types: `packages/shared/src/entities.ts` (Zod).

### 2.3 Sync queue record

Each pending op is keyed by `collection:docId` and stores:

- `op`: `upsert` | `delete`
- `snapshotJson`: full document at enqueue time
- `deviceId`, `createdAt`, `attempts`, `nextAttemptAt`, `lastError`

### 2.4 Maps and indexes (client-side)

| Structure | Use |
|-----------|-----|
| `Map<rowId, Plant[]>` | Group plants per row (row guides, spatial bands) |
| `Map<string, number>` | Disease counts, yield aggregates, valve last-irrigation times |
| `Set<string>` | Dedupe plant grid slots; farm plant IDs for disease filtering |
| GeoJSON `Polygon` | Farm boundary; point-in-polygon tests |

### 2.5 Cloud tables (D1)

Normalized mirrors of entities plus:

- `users`, `sessions`, `login_codes`, `farm_members`
- `weather_snapshots`, `crop_profiles`, `ai_insights`
- `sync_state` (per-device push/pull watermarks)

Migrations under `apps/worker/migrations/`.

### 2.6 AI context DTOs

`buildFarmContext` / `buildPlantDetail` (`packages/shared/src/context.ts`) compress DB state into **bounded JSON** for Gemini:

- Health histograms, disease clusters (`Map` → array)
- Yield trend buckets
- Up to 50 plant samples per farm context

This is a **serialization/view model**, not a separate database.

---

## 3. Algorithms (by domain)

### 3.1 Orchard grid generation (`apps/web/src/geo/grid.ts`)

**Problem:** Given a farm polygon, row spacing, plant spacing, and row bearing, place parallel rows and plants inside the boundary.

**Techniques:**

1. **Local metric projection** — Convert lng/lat deltas to meters using:
   - `METERS_PER_DEG_LAT ≈ 111320`
   - `metersPerDegLng(lat) = 111320 * cos(lat)`

2. **Bearing inference**
   - *Farm shape:* longer bbox axis → row direction (0° or 90°).
   - *Existing plants (≥2):* Turf `bearing` for two points; for more, **2×2 covariance matrix** → dominant eigenvector → row axis (PCA-style, without a full linear algebra library).

3. **Perpendicular extent** — Project polygon vertices onto axis ⊥ to row bearing; `floor(extent / rowSpacing) + 1` → auto row count.

4. **Row placement** — Turf `centroid` + `destination` along bearing ± 90° for row offsets; step along row axis by `plantSpacingM`.

5. **Clipping** — `turf.booleanPointInPolygon` drops plants outside the farm.

6. **Dedup** — `Set` of rounded lng/lat keys avoids duplicate slots on shared vertices.

**Complexity:** O(rows × plants_per_row) point-in-polygon checks; row count bounded by farm width / spacing.

Tests: `apps/web/src/geo/grid.test.ts`.

### 3.2 Workspace projection (`apps/web/src/workspace/geoTransform.ts`)

**Problem:** Draw geo entities on a Konva canvas with pan/zoom.

**Algorithm:** Axis-aligned **bounding box** of the polygon → uniform scale to fit viewport (preserve aspect ratio) → linear map:

- `lng → x`, `lat → y` with Y flipped (screen coordinates)
- Inverse `canvasToLngLat` for click-to-place tools

This is a **equirectangular local projection**, accurate enough for single-farm extents (not a full UTM pipeline).

### 3.3 Row guide polylines (`apps/web/src/workspace/rowGuides.ts`)

For each row with ≥2 plants:

1. Compute cluster centroid.
2. Find farthest plant from centroid → axis direction.
3. **Sort plants by projection** onto that axis (1D ordering along “row direction”).
4. Emit polyline for Konva overlay.

### 3.4 Point-in-polygon guards (workspace + grid)

`turf.booleanPointInPolygon` enforces:

- New plants/valves must land inside the farm polygon.
- Drag-outside snaps back (invalid drop rejected).

Marquee selection (`FarmWorkspaceCanvas.tsx`): axis-aligned rectangle in canvas space → test each entity’s lng/lat inside box **and** inside farm polygon.

### 3.5 Valve–row graph sync (`apps/web/src/valves/syncConnectedRows.ts`)

**Algorithm:** For each valve on a farm, `connectedRows = rows.filter(r => r.valveIds.includes(valveId))`.

- **Time:** O(valves × rows) per refresh; fine for orchard scale.
- **Pattern:** Derived view / materialized field for fast UI and irrigation heatmaps.

### 3.6 Cascade delete (`apps/web/src/db/deleteFarm.ts`)

**Order:** disease_events (by plant id chunks) → irrigation_events → plants → rows → valves → farm.

**Why:** Avoid sync races where child rows reference a deleted farm. Uses `withinBulkMutation` to batch queue entries (500-op chunks).

### 3.7 Sync engine (`apps/web/src/sync/SyncEngine.ts`)

**Push:**

1. Load `pending_sync_operations`; filter `nextAttemptAt <= now`.
2. Sort by `createdAt` (FIFO).
3. Group by `collection`; batches of 50 to `/api/v1/sync/push`.
4. On success: stamp `lastSyncedAt`, remove queue rows inside `withinSyncWrite`.
5. On failure: **exponential backoff** `[1s, 5s, 15s, 1m, 5m]` capped at last step.

**Pull:**

1. Per collection: `since` cursor + optional D1 bookmark header.
2. Apply each doc via `applyPullDoc` inside `withinSyncWrite` (no re-enqueue).

**Coalescing:** Concurrent `runOnce()` calls collapse to one run + optional rerun flag.

### 3.8 Mutation gateway (`apps/web/src/sync/mutationGateway.ts`)

**Pattern:** RxDB `postSave` / `preRemove` hooks enqueue sync ops automatically.

- `syncWriteDepth` — suppress hooks during server pull.
- `withinBulkMutation` — accumulate ops in a `Map`, flush in 500-chunks (grid replace, farm delete).

**Data structure:** `Map<pendingKey, PendingOp>` for bulk coalescing (last write per doc wins in batch).

### 3.9 Conflict resolution (`apps/web/src/sync/conflict.ts`)

**Detection:** Both sides “dirty” if `updatedAt > lastSyncedAt` locally and remotely.

| Collection kind | Strategy |
|-----------------|----------|
| farms, plants | Merge non-geometry from remote; **geometry → manual** (`pending_conflicts`) |
| valves | Same + **overlay** fields (`connectedRows`) stay local-first |
| events, rows, farm_events | **Field-level merge** + status lattice |
| (overlays) | Keep local, only bump `lastSyncedAt` |

**Status merge:** Ordered FSM — `planned < in_progress < completed|skipped|missed`; take max order.

**Tombstones:** `deletedAt != null` → hard delete local doc.

### 3.10 Farm health score (`apps/web/src/intelligence/healthScore.ts`)

**Weighted linear model** (0–100):

| Component | Weight | Logic |
|-----------|--------|--------|
| Plant health | 35% | Average of per-status points (healthy=100 … disease=20) |
| Disease pressure | 25% | Recent events / plant count → penalty curve |
| Irrigation recency | 20% | Events in last 7 days; open issues reduce score |
| Weather risk | 20% | Humidity, wind, rain probability thresholds |

Output: `score`, `band` (`good` / `watch` / `poor`), `breakdown`, human `notes`.

### 3.11 Spatial row/valve bands (`apps/web/src/intelligence/spatialAggregates.ts`)

**Per-row normalization** for map overlays:

- **Yield:** min–max normalize average `yearlyYield` per row → score 0..1 → color band.
- **Disease:** weighted severity counts (high=3, medium=2, low=1) / plant count.
- **Irrigation:** propagate valve last-event time → connected rows; fresh (&lt;7d) vs stale (&gt;21d).

Uses `clamp01` and threshold bands (`good` / `watch` / `bad`).

### 3.12 Server intelligence rules (`apps/worker/src/intelligence/rules.ts`)

**Idempotent daily insights** keyed `farmId:type:dayBucket`:

- **Skip irrigation on rain:** Sum forecast `rain.3h` mm in next 48h; if &gt;5mm and irrigation events scheduled → recommendation insight.
- **Fungal pressure, heat stress, irrigation due:** Weather snapshot thresholds + farm event queries (see file for thresholds).

`sumForecastPrecipMm` — filter forecast list by Unix `dt` window, accumulate precipitation.

### 3.13 Calendar recurrence (`apps/web/src/calendar/expandFarmEvents.ts`)

- Parse **RFC 5545 RRULE** via `rrule` library (`rrulestr` + `dtstart`).
- Expand recurring `FarmEvent` masters into FullCalendar instances for visible range.
- Synthetic instance IDs for recurring occurrences; single events pass through if intersecting range.

Related: `markMissedFarmEvents.ts`, `completeFarmEvent.ts` for status transitions.

### 3.14 AI context aggregation (`packages/shared/src/context.ts`)

- **O(n)** scans: health histogram, disease clustering by type, open irrigation issues.
- **Yield trend:** `Map<period, totalYield>` (currently coarse `"year"` bucket).
- **Plant detail:** filter irrigation by valve IDs linked to plant’s row.

### 3.15 Geo utilities elsewhere

| File | Technique |
|------|-----------|
| `apps/worker/src/geoCentroid.ts` | Arithmetic mean of polygon ring vertices (weather lookup) |
| `packages/shared/src/geojson.ts` | Zod-validated GeoJSON Polygon |
| Turf.js (throughout) | `bbox`, `centroid`, `destination`, `bearing`, `area`, `booleanPointInPolygon` |
| Nominatim search | External geocoding; display name dedup for picker UX |

### 3.16 Map tiles (partial)

`maplibreSetup.ts` registers **PMTiles** custom protocol for MapLibre. Global map page may still use Leaflet in places—check `FEATURES.md` for current map stack per route.

---

## 4. Design patterns worth studying

| Pattern | Where | Lesson |
|---------|-------|--------|
| **Outbox / queue** | `pending_sync_operations` | Reliable async sync without blocking UI |
| **Hook-based cross-cutting** | `mutationGateway` | One place to make all writes sync-aware |
| **Reentrancy guards** | `withinSyncWrite`, `withinBulkMutation` | Prevent feedback loops |
| **Derived cache** | `connectedRows` | Normalize on write path from authoritative `valveIds` |
| **Strategy per entity type** | `conflict.ts` | Not all conflicts should LWW—geometry needs human merge |
| **Bounded AI context** | `buildFarmContext` | LLM inputs need caps and stable schema |
| **Cron pagination** | `scheduled.ts` | `id > cursor LIMIT 25` avoids loading all farms at once |
| **Soft delete + tombstones** | `deletedAt` on pull | Replicas converge on deletes |

---

## 5. Key files (reading order)

1. `packages/shared/src/entities.ts` — domain model  
2. `apps/web/src/geo/grid.ts` — hardest client algorithm  
3. `apps/web/src/sync/mutationGateway.ts` + `SyncEngine.ts` + `conflict.ts` — distributed data path  
4. `apps/worker/src/index.ts` (sync + auth sections) — server contract  
5. `apps/web/src/intelligence/healthScore.ts` + `spatialAggregates.ts` — analytics UX  
6. `apps/worker/src/intelligence/rules.ts` — server-side rules  
7. `FEATURES.md` — what is actually shipped vs planned  

---

## 6. Planned / not fully wired (honest gaps)

From `FEATURES.md` and PRDs—useful so you do not confuse **design docs** with **code**:

| Item | Status |
|------|--------|
| Full OAuth (Google/Apple) | Magic-code auth only |
| MapLibre + PMTiles everywhere | Partial; Leaflet still on some routes |
| Durable Objects realtime | Not in current sync path |
| Vector search (Vectorize) | Future |
| R analytics in production loop | Optional sidecar |
| Map screenshot export | Not implemented |

---

## 7. Suggested exercises

1. **Grid:** Change `inferRowBearingFromPlants` to use Turf `lineString` + `bbox`—compare bearing error on a skewed parcel.  
2. **Sync:** Simulate two devices editing the same plant’s `lat` offline—trace into `pending_conflicts`.  
3. **Health:** Add a fifth component (e.g. fertilizer events) to `computeFarmHealthScore` and rebalance weights to sum to 1.  
4. **Rules:** Add a rule “frost warning” using `weather_snapshots.temp_c` in `runIntelligenceRules`.  
5. **Complexity:** Estimate worst-case `pending_sync_operations` size after “Fill farm” on a 10 ha orchard at 3m plant spacing.

---

## 8. External concepts to study alongside this repo

- **Local-first software** (Martin Kleppmann — sync, CRDTs; this app uses simpler LWW + manual geometry merge).  
- **Computational geometry** — point-in-polygon, polygon centroid, covariance/eigenvectors for orientation.  
- **Geodesy basics** — small-area flat-earth approximations vs UTM for large farms.  
- **Edge computing** — Cloudflare Workers, D1, R2, cron triggers.  
- **RFC 5545** — recurrence for farm operations calendar.  

---

*Generated from the FarmCraft codebase. Update this doc when adding major subsystems (e.g. full CRDT sync, NDVI rasters, or simulation engine).*

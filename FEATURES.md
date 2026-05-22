# FarmDots — Feature status

Snapshot of **implemented** functionality in this repository (web app, local DB, worker API). Last aligned with the codebase structure under `apps/web`, `apps/worker`, and `packages/shared`.

---

## Application shell

| Feature | Status | Notes |
|--------|--------|--------|
| Route: global map (`/`) | Implemented | `GlobalMapPage` |
| Route: farm workspace (`/farm/:farmId/workspace`) | Implemented | `FarmWorkspace` |
| Theme (light / dark / system) | Implemented | `next-themes`, `ThemeToggle` |
| Units (metric / imperial) | Implemented | `UnitsContext`; used for area/length display |
| Local database bootstrap | Implemented | RxDB + IndexedDB via `useDatabase`; error UI if storage unavailable |
| PWA | Implemented | `vite-plugin-pwa` — manifest, offline shell, `navigateFallbackDenylist` for `/api` |
| Command palette | Implemented | `⌘K` / `Ctrl+K` — farms, navigate to workspace, actions (`CommandPalette`) |

---

## Data model (local & sync)

Collections stored locally (RxDB) and mirrored to cloud when syncing:

| Collection | Purpose |
|------------|---------|
| `farms` | Farm boundary (GeoJSON polygon string), name, irrigation type, sync metadata |
| `rows` | Named rows, order, `valveIds` |
| `plants` | Per-plant geometry, label, crop, health, yield, issue flags, notes |
| `valves` | Position, name, status, cached `connectedRows` |
| `irrigation_events` | Valve-scoped irrigation logs (time, issue, notes) |
| `disease_events` | Per-plant disease log entries |

Shared Zod types live in `packages/shared` (`entities.ts`, etc.).

---

## Global map (`/`)

| Feature | Status | Notes |
|--------|--------|--------|
| Farm list & active farm | Implemented | Dropdown; auto-select first farm when list changes |
| Draw new farm polygon | Implemented | “Add farm” mode; tap vertices; Enter / Esc |
| Edit farm boundary | Implemented | Leaflet draw–style editor when farm selected (`FarmPolygonEditor`) |
| Fly to place search | Implemented | Nominatim search; multi-hit picker; **display names deduplicated** for duplicate locality spellings (`simplifyNominatimDisplayName`) |
| Geolocate | Implemented | Browser geolocation → fly to |
| Map layers | Implemented | OSM, Esri imagery, OpenTopoMap |
| Plants & valves on map | Implemented | Circle markers; plant tap opens sheet |
| Row/farm metrics strip | Implemented | Area, perimeter, centroid, reverse-geocoded place (when farm selected) |
| Fill farm (grid wizard) | Implemented | Opens `GridGenerateDialog` from map |
| Export | Implemented | Plants XLSX, rows CSV, irrigation CSV, disease CSV (farm-scoped) |
| Sync cloud | Implemented | Push + pull all collections (`sync/client.ts`) |
| Delete farm | Implemented | Cascade delete (`deleteFarmCascade`) |
| Plant detail sheet (overlay) | Implemented | `PlantSheet` when a plant is selected on the map |

---

## Plant details (`PlantSheet`)

Applies on **map** (overlay) and **workspace** (side panel when exactly one plant selected).

| Feature | Status | Notes |
|--------|--------|--------|
| Main fields save | Implemented | Yield, watering / disease / drip issue text, notes → **`plants`** via `savePlantMainFields` (`incrementalModify`; clears optional fields correctly; updates **healthStatus** from issues) |
| Disease events | Implemented | Append to **`disease_events`** |
| Irrigation events | Implemented | Append to **`irrigation_events`** (valve picker; row-linked valves explained in UI) |
| Replicate fields to other plants | Implemented | Checklist of other plants on farm → **Save & apply** writes same main fields to current + selected others |

Bulk edit on workspace (see below) uses **`BulkPlantDetailsDialog`** + same persistence helper.

---

## Farm workspace (`/farm/:farmId/workspace`)

| Feature | Status | Notes |
|--------|--------|--------|
| Konva canvas over farm polygon | Implemented | Pan, zoom, fit farm |
| Tools | Implemented | Select, pan, add plant, add valve, delete |
| Plant / valve placement | Implemented | Inside-polygon validation |
| Drag plants / valves | Implemented | Snap back if dropped outside boundary |
| Selection | Implemented | Click (replace), **Shift / ⌘ / Ctrl + click** (toggle), marquee box select |
| Row guides | Implemented | Derived polylines from plants + rows (`rowGuides`) |
| Sidebar stats | Implemented | Row/plant/valve counts, health alerts, disease counts (`WorkspaceSidebar`) |
| Single plant panel | Implemented | `PlantSheet` in sheet when one plant selected |
| Single valve panel | Implemented | `ValvePanel` |
| Bulk plant field edit | Implemented | Header **“Edit N plants…”** when ≥2 plants selected (no valves) → dialog |
| Fill farm dialog | Implemented | Same grid wizard as map |

---

## Irrigation & valves

| Feature | Status | Notes |
|--------|--------|--------|
| Valve ↔ row linking | Implemented | `refreshValveConnectionsForFarm` keeps `Valve.connectedRows` in sync |
| Valve CRUD in workspace | Implemented | `ValvePanel`, map placement |

---

## Export

| Format | Contents |
|--------|----------|
| `plants.xlsx` | Plant columns including ids, geo, yield, health, issues, notes, versions |
| `rows.csv` | Row metadata + `valveIds` |
| `irrigation.csv` | Irrigation events |
| `disease.csv` | Disease events for plants on the farm |

---

## Cloud sync & backend (`apps/worker`)

| Feature | Status | Notes |
|--------|--------|--------|
| HTTP API (Hono on Cloudflare Workers) | Implemented | CORS; session tokens + legacy `AUTH_DEV_TOKEN` |
| Sync push / pull | Implemented | Owner-scoped per-collection upsert into D1 (see worker `repo`) |
| Health check | Implemented | `/api/v1/health` |
| Farm / plant JSON for AI context | Implemented | Endpoints assemble snapshots via `@farmdots/shared` (`buildFarmContext`, `buildPlantDetail`) |
| AI chat proxy | Implemented | `/api/v1/ai/chat` (worker wires Gemini when configured) |
| Magic-code auth (r.md §6) | Implemented | `/api/v1/auth/{request-login,verify,me,logout}` — Mailchannels delivery + dev-code fallback |
| Farm ownership / roles | Implemented | `farm_members` table; sync push/pull + farm context routes scoped to caller |
| Canonical D1 schema (r.md §7) | Implemented | Migration 0004 adds `users`, `sessions`, `login_codes`, `farm_members`, `weather_snapshots`, `crop_profiles`, `ai_insights`, `sync_state` (crop_profiles seeded) |

Web client wrappers: `apps/web/src/ai/client.ts` (`fetchFarmContextJson`, `fetchPlantDetailJson`, `chatWithGemini`).

## Auth (web)

| Feature | Status | Notes |
|--------|--------|--------|
| Magic-code sign-in dialog | Implemented | `apps/web/src/auth/SignInDialog.tsx` — two-step email → 6-digit code |
| AuthContext + session token | Implemented | `AuthProvider` rehydrates `farmdots_token`, listens for cross-tab changes |
| Account chip / sign-out | Implemented | `AccountMenu` in global map header |
| Auth-aware sync | Implemented | `Sync cloud` calls `requireSignIn()` first; 401s reopen the dialog |

---

## Testing & quality

| Area | Status |
|------|--------|
| Unit tests | Partial | `geo/grid.test.ts`, `workspace/geoTransform.test.ts` (Vitest) |
| Lint script | Placeholder | `package.json` lint may be `"skip"` |

---

## Not implemented (or not present in repo)

| Item | Notes |
|------|--------|
| Map screenshot / camera export | Discussed; **no** `html2canvas` or capture UI in current source |
| Dedicated mobile native apps | Web / PWA only |
| OAuth providers (Google / Apple) | Auth currently magic-code only; OAuth provider integration is future work |
| Real sync engine (queue + conflict resolution) | r.md Phase 2 — `sync_state` table exists, queue + LWW/manual-merge logic not yet wired |
| MapLibre + PMTiles | r.md Phase 4 — Leaflet still in place; PMTiles archives not yet hosted |

---

## Monorepo layout (reference)

- `apps/web` — Vite + React + Leaflet/Konva client  
- `apps/worker` — Cloudflare Worker + D1 sync/API  
- `packages/shared` — Shared entities, context builders, workspace types  

---

*This file is descriptive only; behavior is defined by the source. Update when adding major features.*

# FarmDots

**FarmDots** is an offline-first, map-based farm operating system. Draw farm boundaries on a map, lay out rows and plants, manage drip irrigation by valve, log disease and irrigation events, export operational data, and sync to the cloud when you are back online.

Built for orchard and permanent-crop farms (mango, citrus, berries, vineyards, drip blocks), with optional AI assistance and multilingual voice workflows.

<p align="center">
  <strong>Map · Workspace · Calendar · Sync · Intelligence</strong>
</p>

---

## Features

| Area | What you get |
|------|----------------|
| **Global map** | Draw/edit farm polygons, satellite & topo layers, plant & valve markers, area metrics |
| **Farm workspace** | Konva canvas: pan/zoom, place/drag plants & valves, marquee selection, row guides |
| **Grid wizard** | Auto-generate parallel rows and plants from spacing + bearing inside the boundary |
| **Operations** | Per-plant health, yield, issues; irrigation & disease event logs |
| **Calendar** | Farm events with recurrence (irrigation, harvest, scouting, etc.) |
| **Export** | `plants.xlsx`, `rows.csv`, `irrigation.csv`, `disease.csv` |
| **Offline-first** | RxDB + IndexedDB; PWA installable; works without network |
| **Cloud sync** | Push/pull to Cloudflare D1 via Workers API; conflict handling for geometry |
| **Auth** | Magic-code email sign-in; farm roles (owner / manager / worker / viewer) |
| **Weather & rules** | Scheduled weather snapshots; server-side operational insights |
| **AI (optional)** | Gemini farm context, chat, voice intent (requires API keys) |

See [`FEATURES.md`](./FEATURES.md) for an implementation snapshot and [`learningdoc.md`](./learningdoc.md) for architecture and algorithms.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web — React + Vite + RxDB + MapLibre/Konva (PWA)      │
└────────────────────────────┬────────────────────────────────┘
                             │ /api (dev proxy → :8787)
┌────────────────────────────▼────────────────────────────────┐
│  apps/worker — Hono on Cloudflare Workers                   │
│    D1 (SQL) · R2 (assets) · cron (weather, intelligence)    │
└────────────────────────────┬────────────────────────────────┘
                             │ optional
┌────────────────────────────▼────────────────────────────────┐
│  apps/analytics-r — R Plumber stats (optional sidecar)      │
└─────────────────────────────────────────────────────────────┘

packages/shared       — Zod entities, GeoJSON, AI context builders
packages/crop-profiles — Crop spacing templates
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | **20+** |
| [pnpm](https://pnpm.io/) | **9.15+** (see `packageManager` in root `package.json`) |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | Installed via `apps/worker` devDependencies when you run `pnpm install` |

Optional (only if you use those features):

- **Google Gemini API key** — AI chat, summaries, voice intent parsing
- **Sarvam API key** — Indian-language STT/TTS/translate for voice
- **R 4.x** — [`apps/analytics-r`](./apps/analytics-r/README.md) analytics sidecar

---

## Quick start (local development)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/FarmCraft.git
cd FarmCraft

corepack enable   # optional; enables the pnpm version from package.json
pnpm install
```

Build workspace packages (their `dist/` folders are not committed):

```bash
pnpm --filter @farmdots/shared --filter @farmdots/crop-profiles build
```

### 2. Configure the API worker

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Edit `apps/worker/.dev.vars` if you want AI or voice (all optional for core mapping/sync):

```bash
# GEMINI_API_KEY=your_key
# SARVAM_API_KEY=your_key
```

For **easy local auth**, set a dev bearer token in `apps/worker/wrangler.toml`:

```toml
AUTH_DEV_TOKEN = "local-dev-secret"
AUTH_DEV_MODE = "true"
```

Apply D1 migrations to the **local** SQLite database:

```bash
cd apps/worker
pnpm wrangler d1 migrations apply farmdots --local
cd ../..
```

### 3. Run web + worker together

From the repo root:

```bash
pnpm dev:web+worker
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:5173 |
| Worker API | http://127.0.0.1:8787 (proxied as `/api` from Vite) |

### 4. Sign in (development)

**Option A — Dev bearer token (fastest)**

1. Set `AUTH_DEV_TOKEN` in `wrangler.toml` as above.
2. Open http://localhost:5173
3. In the browser devtools console:

   ```js
   localStorage.setItem("farmdots_token", "local-dev-secret");
   location.reload();
   ```

**Option B — Magic code (mirrors production)**

1. Open the sign-in dialog (e.g. when you tap **Sync cloud**).
2. Enter any email → submit.
3. With `AUTH_DEV_MODE=true`, the UI shows the **6-digit code** returned by the API (no email required locally).
4. Enter the code to receive a session token.

---

## Using the app

### First-time flow

1. **Open the map** at `/` — search for a place or use geolocate.
2. **Add a farm** — enter draw mode, tap polygon vertices, press **Enter** to finish.
3. **Fill the farm** — use the grid wizard to generate rows and plants from spacing settings.
4. **Open workspace** — navigate to `/farm/:farmId/workspace` to edit plants/valves on the Konva canvas.
5. **Log operations** — select a plant → sheet for yield, issues, disease & irrigation events.
6. **Calendar** — `/farm/:farmId/calendar` for scheduled/recurring operations.
7. **Export** — download spreadsheets from the map page for sharing or analysis.
8. **Sync** — sign in, then **Sync cloud** (header or `⌘K` / `Ctrl+K` command palette) to push local changes and pull remote updates.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Command palette (farms, navigation, sync) |

### Units & theme

Use the header controls for **metric / imperial** and **light / dark / system** theme.

### Offline / PWA

The app caches static assets via the service worker. Operational data lives in **IndexedDB** through RxDB. Install from the browser’s “Add to Home Screen” / install prompt where supported.

### Sync conflicts

If the same plant geometry is edited on two devices while offline, merges may land in **Conflicts** (`/conflicts`) for manual resolution.

---

## npm scripts (root)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run **all** workspace `dev` scripts in parallel |
| `pnpm dev:web+worker` | Web + API only (recommended) |
| `pnpm dev:web` | Vite frontend only (local-only DB; no sync/API) |
| `pnpm dev:worker` | Wrangler dev API only |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run Vitest in all packages |
| `pnpm i18n:generate` | Bootstrap translations (MyMemory script) |
| `pnpm tiles:overlays` | Build PMTiles overlay assets (see `scripts/build-pmtiles/`) |

---

## Environment variables

### Worker — `apps/worker/wrangler.toml` `[vars]`

| Variable | Purpose |
|----------|---------|
| `AUTH_DEV_TOKEN` | Bearer token that maps to a synthetic dev user (local testing) |
| `AUTH_DEV_MODE` | `"true"` → login API returns `devCode` in JSON (no email) |
| `EMAIL_FROM` | Verified sender for magic-code email (Mailchannels) |
| `ANALYTICS_R_URL` / `ANALYTICS_R_TOKEN` | Optional R Plumber BFF |

### Worker secrets — `apps/worker/.dev.vars` (gitignored)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | `/api/v1/ai/*`, voice intent |
| `SARVAM_API_KEY` | `/api/v1/voice/*` STT/TTS/translate |

Weather uses [Open-Meteo](https://open-meteo.com/) — **no API key**.

Production: use `wrangler secret put GEMINI_API_KEY` (and similar) instead of committing secrets.

---

## Testing

```bash
pnpm test
```

Package-specific examples:

```bash
pnpm --filter @farmdots/web test
pnpm --filter @farmdots/worker test
```

---

## Deployment (overview)

1. **Worker** — `cd apps/worker && pnpm wrangler deploy`  
   - Create a real D1 database and R2 bucket in Cloudflare; update `wrangler.toml` IDs.  
   - Run migrations on remote D1: `wrangler d1 migrations apply farmdots --remote`  
   - Set secrets and set `AUTH_DEV_MODE` to `"false"` in production.

2. **Web** — build `apps/web` (`pnpm --filter @farmdots/web build`) and deploy `dist/` to Cloudflare Pages (or any static host).  
   - Configure the host to proxy `/api/*` to your Worker, **or** set the Vite/API base URL accordingly.

3. **Analytics (optional)** — deploy `apps/analytics-r` and point `ANALYTICS_R_URL` at it.

---

## Repository layout

```
FarmCraft/
├── apps/
│   ├── web/              # React PWA client
│   ├── worker/           # Cloudflare Worker + D1 migrations
│   └── analytics-r/      # Optional R Plumber service
├── packages/
│   ├── shared/           # Shared types & context builders
│   └── crop-profiles/    # Crop templates
├── scripts/              # i18n, PMTiles build helpers
├── FEATURES.md           # Feature inventory
├── learningdoc.md        # Algorithms & system design notes
└── README.md             # This file
```

---

## Contributing

Contributions are welcome — issues, docs, bug fixes, and new integrations (US crop profiles, equipment APIs, compliance exports, etc.).

1. Fork the repository and create a branch from `main`.
2. Run `pnpm install`, build shared packages, apply local D1 migrations, and `pnpm dev:web+worker`.
3. Keep user-visible strings i18n-ready (`apps/web/src/i18n/locales/en/*.json`) — see [`.cursor/rules/i18n-no-raw-ui.mdc`](./.cursor/rules/i18n-no-raw-ui.mdc).
4. Add or update tests when changing sync, geo, or auth behavior.
5. Open a pull request with a clear description and screenshots for UI changes.

**Ideas for contributors**

- MapLibre/PMTiles overlays and NDVI layers  
- OAuth providers (Google / Apple)  
- US & EU crop profile packs  
- Scout photos attached to plants  
- Integrations with irrigation controllers or machinery telematics  
- Improved mobile field UX  

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

## Acknowledgments

- [Turf.js](https://turfjs.org/) — geospatial operations  
- [RxDB](https://rxdb.info/) — local-first data  
- [MapLibre GL](https://maplibre.org/) — maps  
- [Cloudflare Workers](https://workers.cloudflare.com/) — edge API  
- [Open-Meteo](https://open-meteo.com/) — weather data  

If this project helps your farm or fork, consider starring the repo and sharing what you build.

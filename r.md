# 🌱 FarmDots Spatial Intelligence & Analytics Platform PRD

## Version 2.0 — Cloudflare + PMTiles + R Analytics Architecture

Built for:

* spatial farm intelligence
* multilingual operations
* irrigation analytics
* weather-aware operations
* geospatial overlays
* future NDVI + satellite intelligence

Core stack:

* React + Vite
* RxDB
* Cloudflare Workers
* Cloudflare D1
* Cloudflare R2
* MapLibre GL
* PMTiles
* R Analytics Engine
* Gemini + Sarvam orchestration

PMTiles is specifically designed for cloud-native serverless tile hosting and works directly with MapLibre GL. ([docs.protomaps.com][1])

Cloudflare D1 supports global read replication using Sessions API for low-latency global reads. ([Cloudflare Docs][2])

---

# 1. 🎯 PRODUCT GOAL

Transform FarmDots into:

# 🌱 “Spatial Operational Intelligence Platform”

NOT:

* simple farm CRUD app
* static dashboard
* spreadsheet replacement

The platform becomes:

* geospatial
* operational
* analytics-driven
* multilingual
* AI-assisted
* weather-aware
* spatially intelligent

---

# 2. 🧠 CORE PRODUCT PRINCIPLES

---

# Principle 1 — Local-first Runtime

```text id="wini100"
RxDB = operational runtime
```

App must:

* work offline
* sync later
* stay responsive in farms

---

# Principle 2 — D1 as Canonical Cloud Store

```text id="wini101"
D1 = canonical cloud operational database
```

D1 stores:

* normalized operational data
* analytics snapshots
* AI insights
* synchronization state

Cloudflare D1 is optimized for Worker-native serverless SQL applications. ([Cloudflare Docs][3])

---

# Principle 3 — PMTiles for Spatial Infrastructure

```text id="wini102"
PMTiles = spatial intelligence delivery layer
```

PMTiles powers:

* overlays
* offline maps
* thematic layers
* geospatial rendering

PMTiles supports direct browser rendering through MapLibre GL with static hosting on R2. ([docs.protomaps.com][1])

---

# Principle 4 — R is Analytics Layer ONLY

R is NOT:

* backend runtime
* sync engine
* operational API layer

R IS:

# analytics compute engine

---

# 3. 🏗️ HIGH-LEVEL SYSTEM ARCHITECTURE

```text id="wini103"
React App
    ↓
RxDB Local Runtime
    ↓
Sync Engine
    ↓
Cloudflare Workers
    ↓
D1 + R2
    ↓
Analytics Snapshot Pipeline
    ↓
R Analytics Engine
    ↓
Insights + Forecasts
    ↓
D1 Insights Tables
```

---

# 4. 🧱 CORE STACK

| Layer          | Technology    |
| -------------- | ------------- |
| Frontend       | React + Vite  |
| Local DB       | RxDB          |
| Edge APIs      | Hono Workers  |
| Cloud DB       | Cloudflare D1 |
| Object storage | Cloudflare R2 |
| Maps           | MapLibre GL   |
| Tile format    | PMTiles       |
| Analytics      | R + Plumber   |
| AI reasoning   | Gemini        |
| Voice          | Sarvam        |

---

# 5. ☁️ CLOUD ARCHITECTURE

---

# Frontend

```text id="wini104"
Cloudflare Pages
```

---

# APIs

```text id="wini105"
Cloudflare Workers
```

---

# Database

```text id="wini106"
Cloudflare D1
```

---

# Blob Storage

```text id="wini107"
Cloudflare R2
```

---

# Maps

```text id="wini108"
PMTiles on R2
```

PMTiles archives can be hosted directly from Cloudflare R2 using HTTP range requests. ([palewire][4])

---

# 6. 🌍 AUTH & IDENTITY SYSTEM

---

# Goal

Secure:

* farm ownership
* sync
* collaboration
* AI operations

---

# Providers

| Provider         |
| ---------------- |
| Google           |
| Apple            |
| Email magic link |

---

# Roles

| Role    |
| ------- |
| owner   |
| manager |
| worker  |
| viewer  |

---

# Tables

```sql id="wini109"
users
sessions
farm_members
```

---

# 7. ☁️ D1 DATABASE ARCHITECTURE

Cloudflare D1 provides globally replicated SQL semantics using SQLite-compatible APIs. ([Cloudflare Docs][3])

---

# Core Tables

```sql id="wini110"
users
farms
rows
plants
valves
operations
weather_snapshots
disease_events
crop_profiles
ai_insights
sync_state
```

---

# Relationships

```text id="wini111"
farm
  ↓
rows
  ↓
plants
```

```text id="wini112"
farm
  ↓
valves
```

---

# 8. 🔄 SYNC ENGINE

CRITICAL SYSTEM.

---

# Architecture

```text id="wini113"
RxDB
   ↓
pending_sync_operations
   ↓
Worker sync APIs
   ↓
D1 canonical store
```

---

# Sync Metadata

Every entity stores:

```ts id="wini114"
updatedAt
deletedAt
version
deviceId
lastSyncedAt
```

---

# Conflict Resolution

| Entity     | Strategy     |
| ---------- | ------------ |
| notes      | latest wins  |
| geometry   | manual merge |
| operations | merge        |
| overlays   | local-first  |

---

# 9. 🌍 D1 READ REPLICATION

Enable:

# D1 Sessions API

for:

* low-latency global reads
* scalable dashboards
* fast overlays

Cloudflare D1 read replication requires Sessions API usage for replica routing. ([Cloudflare Docs][2])

---

# 10. 🗺️ PMTILES SPATIAL STACK

---

# Core Architecture

```text id="wini115"
OSM Extracts
   ↓
Planetiler / Tippecanoe
   ↓
PMTiles
   ↓
Cloudflare R2
   ↓
MapLibre GL
```

PMTiles enables serverless vector tile hosting directly from object storage. ([docs.protomaps.com][1])

---

# 11. 🗺️ MAP STACK

---

# Renderer

```text id="wini116"
MapLibre GL
```

---

# Spatial Layers

| Layer      |
| ---------- |
| basemap    |
| satellite  |
| terrain    |
| irrigation |
| disease    |
| yield      |
| NDVI       |
| weather    |

---

# 12. 🗺️ PMTILES STRATEGY

IMPORTANT.

DO NOT start planet-scale.

---

# Start With:

| Region         |
| -------------- |
| Andhra Pradesh |
| Telangana      |
| Karnataka      |

---

# Benefits

| Benefit          |
| ---------------- |
| smaller archives |
| faster deploys   |
| cheaper storage  |
| easier updates   |

---

# 13. 🌦️ WEATHER DATA LAYER

---

# Sources

| Dataset     |
| ----------- |
| OpenWeather |
| ERA5        |
| NASA POWER  |
| IMD India   |

---

# Features

| Feature                 |
| ----------------------- |
| rainfall history        |
| humidity trends         |
| irrigation intelligence |
| heat stress             |
| fungal pressure         |

---

# 14. 🌱 CROP REGISTRY SYSTEM

---

# Canonical Crop Profiles

```ts id="wini117"
CropProfile {
  id

  idealSpacing
  wateringFrequency

  idealHumidity
  idealTemperature

  diseaseRisks

  lifecycle
}
```

---

# Initial Crops

| Crop    |
| ------- |
| mango   |
| banana  |
| coconut |
| chili   |
| papaya  |
| guava   |

---

# 15. 🧪 SOIL DATASETS

---

# Sources

| Dataset        |
| -------------- |
| SoilGrids      |
| ISRIC          |
| NBSS&LUP India |

---

# Features

| Feature          |
| ---------------- |
| pH               |
| water retention  |
| nutrient quality |
| drainage         |
| crop suitability |

---

# 16. 🛰️ SATELLITE + NDVI SYSTEM

Future phase.

---

# Sources

| Dataset    |
| ---------- |
| Sentinel-2 |
| Landsat    |
| Copernicus |

---

# Features

| Feature              |
| -------------------- |
| vegetation health    |
| crop stress          |
| irrigation anomalies |
| yield prediction     |

---

# 17. 📊 R ANALYTICS ENGINE

R becomes:

# analytics compute layer

---

# Deployment Model

```text id="wini118"
Workers
   ↓
Analytics Queue
   ↓
R Plumber API
   ↓
Results → D1
```

---

# 18. 📊 WHAT R SHOULD HANDLE

| Analytics              |
| ---------------------- |
| yield forecasting      |
| rainfall analysis      |
| anomaly detection      |
| disease probability    |
| crop health regression |
| clustering             |
| seasonal forecasting   |

---

# 19. 🚫 WHAT R SHOULD NOT HANDLE

| System              |
| ------------------- |
| auth                |
| sync                |
| realtime operations |
| voice runtime       |
| calendar logic      |
| overlay rendering   |

---

# 20. 📊 ANALYTICS SNAPSHOT PIPELINE

VERY IMPORTANT.

R processes:

# snapshots

NOT live runtime state.

---

# Example

```text id="wini119"
Nightly Farm Snapshot
    ↓
R Analytics
    ↓
Insights
    ↓
D1 ai_insights
```

---

# 21. 🧠 AI INSIGHTS SYSTEM

---

# Tables

```sql id="wini120"
ai_insights
```

---

# Fields

```sql id="wini121"
farm_id
type
severity
summary
generated_at
```

---

# 22. 🤖 GEMINI RESPONSIBILITIES

Gemini handles:

* operational reasoning
* weather synthesis
* crop intelligence
* voice intent parsing
* multilingual summaries

---

# Gemini DOES NOT:

* manage sync
* own analytics truth
* directly mutate operations

---

# 23. 🎙️ SARVAM RESPONSIBILITIES

Sarvam handles:

* speech-to-text
* translation
* text-to-speech
* multilingual speech workflows

---

# 24. 🌱 SPATIAL OVERLAYS

MOST IMPORTANT VISUAL SYSTEM.

---

# Overlays

| Overlay            |
| ------------------ |
| yield bands        |
| disease pressure   |
| irrigation recency |
| NDVI               |
| rainfall           |
| soil quality       |

---

# 25. 🚰 IRRIGATION INTELLIGENCE

Core operational moat.

---

# Features

| Feature                  |
| ------------------------ |
| irrigation history       |
| valve analytics          |
| flow consistency         |
| irrigation forecasting   |
| weather-aware scheduling |

---

# 26. 📈 FARM HEALTH ENGINE

Deterministic scoring engine.

---

# Inputs

| Signal     |
| ---------- |
| weather    |
| irrigation |
| disease    |
| yield      |
| operations |

---

# Output

```text id="wini122"
Farm Health: 82/100
```

---

# 27. 🔐 SECURITY HARDENING

CRITICAL PHASE.

---

# Requirements

| Requirement          |
| -------------------- |
| Worker-side API keys |
| Zod validation       |
| ownership validation |
| rate limiting        |
| upload validation    |
| auth middleware      |

---

# 28. ☁️ R2 STORAGE STRATEGY

R2 stores:

* images
* disease photos
* exports
* audio
* PMTiles
* satellite snapshots

---

# D1 NEVER stores:

* blobs
* large media
* PMTiles archives

---

# 29. 🚀 IMPLEMENTATION ROADMAP

---

# PHASE 1 — AUTH + D1

Build:

* auth
* ownership
* migrations
* normalized schema

---

# PHASE 2 — REAL SYNC ENGINE

Build:

* sync queue
* replication
* conflict resolution

---

# PHASE 3 — WEATHER + CROP ENGINE

Build:

* weather snapshots
* crop registry
* operational intelligence

---

# PHASE 4 — PMTILES STACK

Build:

* regional PMTiles
* MapLibre integration
* overlay layers

---

# PHASE 5 — R ANALYTICS

Build:

* Plumber analytics API
* forecasting
* anomaly detection

---

# PHASE 6 — NDVI + SATELLITE

Build:

* Sentinel integration
* vegetation overlays
* stress analysis

---

# 30. 🧠 MOST IMPORTANT PRODUCT PRINCIPLE

You are NOT building:

> “farm dashboard.”

You are building:

# 🌱 multilingual spatial operational intelligence platform

That distinction is critical.

---

# 31. 🏆 FINAL PLATFORM POSITIONING

FarmDots becomes:

> 🌍 “Multilingual geospatial operating system for agriculture”

Core differentiators:

* local-first runtime
* multilingual voice workflows
* spatial operational intelligence
* PMTiles-powered overlays
* weather-aware operations
* irrigation intelligence
* analytics-driven insights
* AI-assisted farm workflows

---

# 32. 📚 REFERENCES

Cloudflare D1 supports global read replication via Sessions API. ([Cloudflare Docs][2])

PMTiles is designed for direct browser rendering and static object-storage hosting. ([docs.protomaps.com][1])

Cloudflare R2 + PMTiles is a common serverless spatial hosting architecture. ([GitHub][5])

[1]: https://docs.protomaps.com/pmtiles/maplibre?utm_source=chatgpt.com "PMTiles for MapLibre GL"
[2]: https://developers.cloudflare.com/d1/best-practices/read-replication/?utm_source=chatgpt.com "Global read replication - D1"
[3]: https://developers.cloudflare.com/d1/?utm_source=chatgpt.com "Overview · Cloudflare D1 docs"
[4]: https://palewi.re/docs/first-pmtiles-map/what-you-will-make.html?utm_source=chatgpt.com "1. What you will make — First PMTiles Map documentation"
[5]: https://github.com/thomasgauvin/protomaps-on-cloudflare?utm_source=chatgpt.com "Simple Map Application using Protomaps on Cloudflare ..."

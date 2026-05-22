# 🌱 FarmDots — Product Requirements Document (PRD)

## Version 1.0 — Cloudflare + AI-Ready Architecture

---

# 1. 🎯 PRODUCT VISION

FarmDots is a:

> **visual, map-based, offline-first farm operating system**

that allows farmers to:

* map farms visually
* manage rows/plants/valves
* track irrigation + disease + yield
* export operational data
* prepare structured farm intelligence for AI agents and Gemini integration

The app should feel:

* interactive
* visual
* game-like
* operationally useful

---

# 2. 🧠 CORE PRODUCT PHILOSOPHY

FarmDots is NOT:

* a spreadsheet
* a boring dashboard
* generic farm ERP

FarmDots IS:

> 🌱 “A visual spatial operating system for farms”

Everything revolves around:

* maps
* rows
* plants
* irrigation topology
* events

---

# 3. 👤 TARGET USERS

## Primary

* Orchard farmers
* Mango farms
* Banana farms
* Coconut farms
* Drip irrigation farms

## Secondary

* Agri startups
* Farm supervisors
* Researchers
* Agricultural consultants

---

# 4. 🏗️ FINAL TECH STACK (LOCKED)

## FRONTEND

| Layer                | Tech                    |
| -------------------- | ----------------------- |
| Framework            | React + TypeScript      |
| Build Tool           | Vite                    |
| Styling              | TailwindCSS             |
| Maps                 | Leaflet + React Leaflet |
| Geo Engine           | Turf.js                 |
| Local DB             | RxDB                    |
| Local Storage Engine | IndexedDB               |
| Charts               | Recharts                |
| Export               | xlsx                    |
| PWA                  | vite-plugin-pwa         |

---

## BACKEND (CLOUDFLARE)

| Layer                | Tech                 |
| -------------------- | -------------------- |
| API Layer            | Cloudflare Workers   |
| Relational DB        | Cloudflare D1        |
| File Storage         | Cloudflare R2        |
| Realtime Engine      | Durable Objects      |
| Hosting              | Cloudflare Pages     |
| Future Vector Search | Cloudflare Vectorize |
| AI Layer             | Gemini API           |

---

# 5. 📱 APPLICATION TYPE

## Type

PWA (Progressive Web App)

## Requirements

* Installable on Android
* Fullscreen experience
* Offline capable
* Fast loading
* Mobile-first UI

---

# 6. 🧩 CORE ENTITIES

---

# 6.1 🌍 FARM

Represents an entire mapped farm.

## Fields

```ts id="0v3mfc"
Farm {
  id
  ownerId

  name
  polygon

  irrigationType

  createdAt
  updatedAt
}
```

---

# 6.2 🌱 ROW

Represents a row/section in farm.

## Fields

```ts id="7zw4q0"
Row {
  id
  farmId

  name
  orderIndex

  valveIds

  createdAt
}
```

---

# 6.3 🌳 PLANT

Core operational entity.

## Fields

```ts id="tb5jij"
Plant {
  id
  farmId
  rowId

  label

  lat
  lng

  cropType

  plantedDate
  age

  yearlyYield

  healthStatus

  wateringIssues
  diseaseIssues
  dripIssues

  notes

  createdAt
  updatedAt
}
```

---

# 6.4 🚰 VALVE

Represents irrigation gate/valve.

## Fields

```ts id="f88m1j"
Valve {
  id
  farmId

  name

  lat
  lng

  connectedRows

  status

  notes

  createdAt
}
```

---

# 6.5 💧 IRRIGATION EVENT

Tracks watering events/issues.

## Fields

```ts id="fg7h9i"
IrrigationEvent {
  id

  valveId
  farmId

  startedAt
  endedAt

  issue

  notes
}
```

---

# 6.6 🦠 DISEASE EVENT

Tracks disease occurrences.

## Fields

```ts id="y7ff4y"
DiseaseEvent {
  id

  plantId

  diseaseType
  severity

  treatment

  notes

  createdAt
}
```

---

# 7. 🌍 MAP ENGINE

---

# 7.1 FARM CREATION

## User Flow

1. User opens map
2. User clicks exactly 4 points
3. Polygon generated
4. Farm boundary saved

---

# 7.2 GRID GENERATION

## Inputs

* Row count
* Row spacing (meters)
* Plant spacing (meters)

---

## Logic

Use Turf.js to:

* calculate polygon bounds
* generate rows
* generate plants
* ensure plants remain inside polygon

---

# 7.3 VISUAL LAYER

Plants displayed as:

* colored markers initially
* future cartoon/pixel sprites

---

# 8. 🌳 PLANT INTERACTION

---

# 8.1 TAP ACTION

When plant clicked:

* open bottom sheet/modal

---

# 8.2 USER INPUTS

User can enter:

* yearly yield
* watering issue
* disease issue
* drip issue
* notes

---

# 8.3 VISUAL STATES

| State       | Visual |
| ----------- | ------ |
| Healthy     | Green  |
| Water issue | Blue   |
| Disease     | Red    |
| Drip issue  | Orange |
| No data     | Gray   |

---

# 9. 🚰 VALVE MANAGEMENT

---

# 9.1 VALVE CREATION

User clicks map:

* places valve

---

# 9.2 VALVE FEATURES

Valve can:

* connect to rows
* track irrigation issues
* maintain event history

---

# 9.3 FUTURE

Valve later connects to:

* IoT
* ESP32
* LoRa systems

---

# 10. 💾 LOCAL-FIRST ARCHITECTURE

---

# 10.1 RXDB REQUIREMENTS

Use RxDB for:

* offline operation
* local caching
* reactive updates

---

# 10.2 SYNC STRATEGY

Future:

* sync local data to D1
* conflict resolution
* realtime collaboration

---

# 11. ☁️ CLOUDLFARE BACKEND

---

# 11.1 WORKERS

Responsibilities:

* APIs
* auth
* sync
* AI requests

---

# 11.2 D1

Stores:

* canonical farm records
* users
* plant history
* irrigation events

---

# 11.3 R2

Stores:

* disease images
* farm photos
* exports
* reports

---

# 11.4 DURABLE OBJECTS

Future use:

* realtime collaboration
* live irrigation sessions
* websocket sync
* live operational state

---

# 12. 🤖 AI-READY ARCHITECTURE

VERY IMPORTANT.

The app MUST be architected so Gemini/RAG can plug in later without restructuring.

---

# 12.1 CONTEXT API

Create APIs like:

```http id="0u5v5m"
GET /api/farms/:id/context
```

Returns:

* plant summaries
* irrigation state
* disease clusters
* yield trends

---

# 12.2 PLANT API

```http id="7qpjya"
GET /api/plants/:id
```

Returns:

* plant history
* irrigation issues
* connected valve
* disease history

---

# 12.3 AI GOAL

Gemini later receives:

* structured farm context
* not raw database dumps

---

# 13. 📁 EXPORT SYSTEM

---

# Features

Export:

* plants
* rows
* irrigation logs
* disease logs

Formats:

* Excel (.xlsx)
* CSV

---

# 14. 🎨 UI/UX REQUIREMENTS

---

# Design Principles

* visual-first
* mobile-first
* fast
* minimal
* smooth interactions

---

# Main UI

## Fullscreen Farm Map

---

# Floating Controls

* Add Farm
* Generate Grid
* Add Valve
* Export

---

# Plant Modal

Bottom sheet style.

---

# 15. 🔥 FUTURE FEATURES (POST-MVP)

---

# 15.1 🌍 Global Farm Map

Public farms viewable worldwide.

---

# 15.2 🤖 Gemini Assistant

Ask:

```text id="x13r6y"
Why is Row B underperforming?
```

---

# 15.3 🦠 Disease Detection

Upload leaf image.

---

# 15.4 📊 Yield Analytics

* row comparisons
* trends
* heatmaps

---

# 15.5 🚰 IoT Integration

ESP32 + LoRa support.

---

# 15.6 🌦️ Weather Integration

Rainfall + humidity context.

---

# 16. 📂 PROJECT STRUCTURE

```bash id="5r0j81"
src/
  components/
  pages/
  maps/
  geo/
  db/
  workers/
  irrigation/
  plants/
  valves/
  ai/
  export/
  hooks/
  ui/
```

---

# 17. 🚀 MVP DEVELOPMENT PHASES

---

# PHASE 1 — CORE ENGINE

Build:

* map
* farm polygon
* row generation
* plant generation
* valve placement

---

# PHASE 2 — OPERATIONS

Build:

* plant interactions
* irrigation logs
* disease logs
* export

---

# PHASE 3 — CLOUD

Build:

* Workers APIs
* D1 sync
* R2 uploads

---

# PHASE 4 — AI

Build:

* Gemini integration
* farm context APIs
* RAG pipeline

---

# 18. 🧠 FINAL PRODUCT DIRECTION

FarmDots is evolving toward:

> 🌱 “A local-first, AI-ready, spatial operating system for farms”

Core moat:

* structured farm entities
* irrigation topology
* plant-level operational intelligence
* spatial visualization
* AI-ready context architecture

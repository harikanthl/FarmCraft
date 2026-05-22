# 🌱 FarmDots — Farm Workspace PRD Expansion

## Version 2.0 — Interactive Farm Workspace System

---

# 1. 🎯 NEW PRODUCT DIRECTION

FarmDots is evolving from:

```text
Map + markers
```

into:

```text
Interactive Farm Workspace
```

The application now has two distinct operating modes:

| Mode                   | Purpose                                 |
| ---------------------- | --------------------------------------- |
| 🌍 Global Map Mode     | Locate, create, and browse farms        |
| 🌱 Farm Workspace Mode | Operational farm editing and management |

---

# 2. 🧠 CORE UX PHILOSOPHY

The Farm Workspace should feel like:

* Figma
* SimCity
* CAD-lite
* Strategy game editor
* Interactive planning software

NOT:

* raw Google Maps
* GIS dashboard
* spreadsheet software

---

# 3. 🏗️ UPDATED ARCHITECTURE

---

# 🌍 MODE 1 — GLOBAL MAP MODE

## Purpose

* Discover farms
* Create farm polygons
* Provide satellite/geospatial context

---

## Technologies

| Layer            | Tech                 |
| ---------------- | -------------------- |
| Map Engine       | Leaflet              |
| Satellite Layers | OpenStreetMap / ESRI |
| Polygon Drawing  | React Leaflet Draw   |
| Geo Processing   | Turf.js              |

---

# 🌱 MODE 2 — FARM WORKSPACE MODE

## Purpose

Dedicated operational editing environment for:

* plants
* rows
* valves
* irrigation
* diseases
* yield management

---

## Technologies

| Layer             | Tech               |
| ----------------- | ------------------ |
| Canvas Engine     | React Konva        |
| Rendering         | HTML5 Canvas       |
| Interaction Layer | Konva Nodes        |
| State             | RxDB + React State |

---

# 4. 🌱 FARM WORKSPACE SCREEN

---

# Layout

```text
┌──────────────────────────────────────┐
│ Toolbar                              │
├──────────────────┬───────────────────┤
│                  │                   │
│                  │ Properties Panel  │
│ Farm Canvas      │                   │
│                  │                   │
│                  │                   │
├──────────────────┴───────────────────┤
│ Bottom Status Bar                    │
└──────────────────────────────────────┘
```

---

# 5. 🗺️ GLOBAL MAP MODE FEATURES

---

# 5.1 Farm Creation

## User Flow

1. User searches location
2. User zooms into farm
3. User selects exactly 4 points
4. Polygon created
5. Farm metadata calculated

---

# 5.2 Farm Metadata

System automatically calculates:

| Metric      | Description       |
| ----------- | ----------------- |
| Area        | Acres + hectares  |
| Perimeter   | Meters + feet     |
| Latitude    | Center coordinate |
| Longitude   | Center coordinate |
| Address     | Reverse geocoded  |
| Plant Count | Generated count   |
| Row Count   | Generated count   |

---

# 5.3 Unit System

Global unit toggle:

```text
Metric
Imperial
```

Supports:

* meters ↔ feet
* hectares ↔ acres

---

# 6. 🌱 FARM WORKSPACE MODE

---

# 6.1 Canvas Rendering

Farm polygon rendered as:

* simplified clean shape
* scalable vector polygon

NOT:

* heavy satellite imagery

---

# 6.2 Coordinate System

Workspace uses:

* normalized internal coordinates
* transformed from geographic coordinates

This allows:

* smooth dragging
* zooming
* editing

---

# 6.3 Layers

Canvas supports layers:

| Layer            | Purpose            |
| ---------------- | ------------------ |
| Polygon Layer    | Farm boundaries    |
| Row Layer        | Row guides         |
| Plant Layer      | Interactive plants |
| Valve Layer      | Irrigation valves  |
| Irrigation Layer | Future pipes/flows |
| Analytics Layer  | Heatmaps/issues    |

---

# 7. 🌳 PLANT SYSTEM

---

# 7.1 Plant Rendering

Plants rendered as:

* Konva nodes
* SVG icons initially
* future sprites later

---

# 7.2 Plant Interactions

User can:

* click
* drag
* recolor
* relabel
* delete
* duplicate

---

# 7.3 Plant States

| State       | Visual |
| ----------- | ------ |
| Healthy     | Green  |
| Water issue | Blue   |
| Disease     | Red    |
| Drip issue  | Orange |
| Empty       | Gray   |

---

# 7.4 Plant Properties

Each plant stores:

```ts
Plant {
  id
  rowId

  x
  y

  cropType
  label

  yearlyYield

  wateringIssues
  diseaseIssues
  dripIssues

  notes
}
```

---

# 8. 🌱 ROW SYSTEM

---

# 8.1 Row Visualization

Rows visually rendered as:

* guides
* lanes
* labeled zones

---

# 8.2 Row Naming

Rows support:

* manual names
* auto labels

Examples:

```text
Row A
North Mango Line
South Orchard Zone
```

---

# 8.3 Row Operations

User can:

* rename
* recolor
* hide/show
* reorder

---

# 9. 🚰 VALVE SYSTEM

---

# 9.1 Valve Rendering

Valves rendered as:

* infrastructure nodes
* draggable icons

---

# 9.2 Valve Interactions

User can:

* place valve
* rename valve
* connect rows
* track issues

---

# 9.3 Valve Properties

```ts
Valve {
  id

  x
  y

  connectedRows

  status

  notes
}
```

---

# 10. 💧 IRRIGATION VISUALIZATION

---

# 10.1 Irrigation Zones

Rows connected to valves become:

* visually grouped
* highlighted

---

# 10.2 Future Irrigation Layer

Future support:

* pipes
* water flow
* irrigation simulation

---

# 11. 🎨 CANVAS TOOL SYSTEM

---

# Toolbar Tools

| Tool        | Function           |
| ----------- | ------------------ |
| Select      | Select nodes       |
| Move        | Pan workspace      |
| Plant Tool  | Add plants         |
| Valve Tool  | Add valves         |
| Delete Tool | Remove objects     |
| Paint Tool  | Change colors      |
| Label Tool  | Rename rows/plants |

---

# 12. 📏 GRID GENERATION ENGINE

IMPORTANT CHANGE.

---

# OLD APPROACH

Bounding-box dot distribution.

---

# NEW APPROACH

## Pipeline

```text
Farm Polygon
   ↓
Generate Reference Lines
   ↓
Generate Rows
   ↓
Generate Plant Points Along Rows
```

---

# Requirements

Use Turf.js:

* lineChunk
* along
* destination
* booleanPointInPolygon

---

# 13. 🧭 WORKSPACE NAVIGATION

---

# Features

* zoom
* pan
* minimap
* reset view
* fit-to-farm

---

# 14. 📊 FARM SIDEBAR PANEL

---

# Shows

| Metric            | Description    |
| ----------------- | -------------- |
| Area              | Acres/hectares |
| Rows              | Count          |
| Plants            | Count          |
| Valves            | Count          |
| Yield Avg         | Aggregate      |
| Disease Alerts    | Count          |
| Irrigation Alerts | Count          |

---

# 15. 🧠 AI-READY CONTEXT UPDATES

Workspace state should support future AI analysis.

---

# 15.1 Workspace Context API

```http
GET /api/v1/farms/:id/workspace
```

Returns:

* rows
* valves
* plant states
* irrigation topology

---

# 15.2 Future AI Features

AI can:

* analyze row performance
* identify irrigation clusters
* detect disease spread patterns

---

# 16. 💾 LOCAL-FIRST REQUIREMENTS

Workspace must:

* function offline
* save instantly
* sync later

RxDB remains:

* source of truth locally

---

# 17. 🚀 UPDATED DEVELOPMENT PRIORITIES

---

# PHASE 1 — WORKSPACE ENGINE

Build:

* FarmWorkspace.tsx
* Konva integration
* polygon rendering
* row rendering
* plant rendering
* valve rendering

---

# PHASE 2 — INTERACTION

Build:

* drag/drop
* selection tools
* editing
* labels
* colors

---

# PHASE 3 — ANALYTICS

Build:

* heatmaps
* irrigation overlays
* row metrics

---

# PHASE 4 — AI

Build:

* workspace context APIs
* Gemini integration
* operational insights

---

# 18. 📂 UPDATED PROJECT STRUCTURE

```bash
src/
  workspace/
    canvas/
    tools/
    layers/
    rendering/
    interactions/

  maps/
  geo/
  db/
  plants/
  rows/
  valves/
  irrigation/
  ai/
```

---

# 19. 🏆 FINAL PRODUCT DIRECTION

FarmDots is evolving into:

> 🌱 “Interactive spatial operating system for farms”

Core differentiators:

* interactive farm canvas
* irrigation-aware operations
* plant-level intelligence
* local-first architecture
* AI-ready operational context
* game-like visual UX

---

# 20. 🧠 MOST IMPORTANT PRODUCT PRINCIPLE

Global map is:

> navigation layer

Farm Workspace is:

> the actual product.

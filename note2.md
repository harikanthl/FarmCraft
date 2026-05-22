# 🌱 FarmDots Calendar & Timeline System PRD

## Version 1.0 — Operational Farm Calendar Engine

Built for:

* Global Map View
* Workspace View
* Irrigation Scheduling
* Crop Lifecycle Intelligence
* Weather-Aware Operations
* Future Google Calendar Sync

Uses:

* React
* RxDB
* Cloudflare Workers
* FullCalendar
* PixiJS workspace integration

FullCalendar supports React integration, recurring events, drag/drop scheduling, and multiple calendar views well-suited for operational workflows. ([fullcalendar.io][1])

---

# 1. 🎯 PRODUCT GOAL

Create:

# 🌱 “Farm Operations Calendar”

NOT:

* generic meeting scheduler
* business calendar
* embedded Google Calendar clone

The calendar becomes:

> the temporal operating system for the farm.

---

# 2. 🧠 CORE PRODUCT PHILOSOPHY

The calendar should feel:

* operational
* agricultural
* environmental
* spatial
* lifecycle-aware

NOT:

* corporate
* enterprise-heavy
* office-like

---

# 3. 🏗️ SYSTEM ARCHITECTURE

```text
React App
   ↓
Calendar Engine
   ↓
RxDB Local Persistence
   ↓
Cloudflare Worker Sync
   ↓
Google Calendar Sync (optional)
```

---

# 4. 🧱 CORE STACK

| Layer                   | Tech               |
| ----------------------- | ------------------ |
| Calendar UI             | FullCalendar       |
| State                   | Zustand            |
| Persistence             | RxDB               |
| Sync                    | Cloudflare Workers |
| Background Intelligence | Gemini             |
| Weather APIs            | OpenWeatherMap     |
| Analytics               | R + Plumber        |
| Workspace Integration   | PixiJS             |

FullCalendar provides recurring events, React integration, drag/drop scheduling, and extensible views. ([fullcalendar.io][1])

---

# 5. 🌍 CALENDAR ENTRY POINTS

The calendar exists in BOTH:

| Location         | Purpose                           |
| ---------------- | --------------------------------- |
| Main Global View | farm-wide planning                |
| Workspace View   | contextual operational scheduling |

---

# 6. 🌍 GLOBAL CALENDAR VIEW

## Purpose

Macro operational planning across:

* farms
* crops
* seasons
* irrigation
* harvests

---

# Layout

```text
┌────────────────────────────────┐
│ FarmDots Calendar              │
├────────────────────────────────┤
│ Sidebar      │ Calendar        │
│              │                 │
│ Farms        │ Month/Week      │
│ Crops        │ Timeline        │
│ Irrigation   │                 │
│ Disease      │                 │
│ Harvest      │                 │
└────────────────────────────────┘
```

---

# 7. 🌱 WORKSPACE CALENDAR VIEW

## Purpose

Contextual operational scheduling inside farm workspace.

---

# Features

| Feature             |
| ------------------- |
| Row-specific events |
| Valve schedules     |
| Plant reminders     |
| Disease inspections |
| Irrigation cycles   |
| Harvest windows     |

---

# Example

User taps:

```text
Valve B
```

Sees:

```text
Next Irrigation:
Tomorrow — 6:00 AM
```

---

# 8. 📅 CORE EVENT MODEL

---

# FarmEvent

```ts
FarmEvent {
  id

  farmId

  type

  title
  description

  start
  end

  allDay

  recurrenceRule

  rowIds
  valveIds
  plantIds

  cropType

  weatherDependent

  priority

  status

  createdAt
  updatedAt
}
```

---

# 9. 🌾 EVENT TYPES

---

# Operational Events

| Type          | Example             |
| ------------- | ------------------- |
| irrigation    | Valve schedule      |
| fertilizer    | NPK cycle           |
| spraying      | pesticide event     |
| pruning       | orchard maintenance |
| harvest       | harvest window      |
| disease_check | fungal inspection   |
| soil_test     | lab testing         |

---

# Environmental Events

| Type             |
| ---------------- |
| rainfall alert   |
| heat stress      |
| humidity warning |
| storm warning    |

---

# AI Events

| Type                      |
| ------------------------- |
| irrigation recommendation |
| disease risk alert        |
| low-yield inspection      |
| crop advisory             |

---

# 10. 🔁 RECURRING EVENTS

CRITICAL FEATURE.

Recurring schedules are essential for:

* irrigation
* spraying
* inspections
* fertilization

FullCalendar supports recurring events and RRULE-based recurrence patterns. ([fullcalendar.io][1])

---

# Examples

```text
Every 3 days
Every Monday
Every month
Seasonal recurrence
```

---

# Recurrence Model

```ts
RecurrenceRule {
  frequency
  interval

  byWeekDay
  byMonth

  until
}
```

---

# 11. 🚰 IRRIGATION CALENDAR ENGINE

THIS becomes one of the most important systems.

---

# Features

| Feature                           |
| --------------------------------- |
| valve schedules                   |
| irrigation reminders              |
| irrigation completion tracking    |
| missed irrigation alerts          |
| weather-aware irrigation skipping |

---

# Example

```text
Rain forecast detected.
Skip Valve A irrigation tomorrow?
```

---

# Spatial Integration

Tap valve:

* upcoming schedule shown
* rows highlighted
* water cycle visible

---

# 12. 🌦️ WEATHER-AWARE CALENDAR

## Goal

Make schedules climate-aware.

---

# Features

| Feature                   |
| ------------------------- |
| rain-aware irrigation     |
| humidity warnings         |
| storm alerts              |
| heat stress alerts        |
| spray timing optimization |

---

# Example

```text
High humidity forecast.
Schedule fungal inspection?
```

---

# Weather APIs

Use:

* [OpenWeatherMap API](https://openweathermap.org/api?utm_source=chatgpt.com)
* OR [Tomorrow.io Weather API](https://www.tomorrow.io/weather-api/?utm_source=chatgpt.com)

---

# 13. 🌱 CROP LIFECYCLE CALENDAR

VERY important.

---

# Crop Lifecycle Phases

| Phase     |
| --------- |
| planting  |
| flowering |
| fruiting  |
| pruning   |
| harvest   |
| dormancy  |

---

# Example

```text
Mango flowering starts in 12 days.
```

---

# AI-generated seasonal schedules

Generated from:

* crop profile
* location
* weather
* planting date

---

# 14. 🧠 AI CALENDAR INTELLIGENCE

Gemini becomes:

# 🌱 scheduling intelligence layer

---

# Features

| Feature                     |
| --------------------------- |
| smart scheduling            |
| operational summaries       |
| event recommendations       |
| irrigation optimization     |
| disease reminder generation |

---

# Example Queries

```text
When should I irrigate next?
```

```text
Which rows need inspection this week?
```

```text
What operational tasks are overdue?
```

---

# 15. 🌍 SPATIAL CALENDAR VISUALIZATION

THIS is CRITICAL.

Events should visually appear inside workspace.

---

# Examples

| Event         | Spatial Effect    |
| ------------- | ----------------- |
| irrigation    | water animation   |
| disease check | orange row glow   |
| harvest       | fruit overlays    |
| spraying      | mist effect       |
| pruning       | highlighted trees |

---

# 16. 🎮 SIM MODE CALENDAR INTEGRATION

Calendar should influence simulation mode.

---

# Examples

| Calendar Event    | Sim Effect             |
| ----------------- | ---------------------- |
| rain forecast     | rain animation         |
| irrigation active | flowing water          |
| harvest period    | fruit-heavy trees      |
| disease alert     | affected plant visuals |

---

# 17. 📆 CALENDAR VIEWS

---

# Main Views

| View     | Purpose              |
| -------- | -------------------- |
| Month    | overview             |
| Week     | operational planning |
| Day      | detailed schedules   |
| Agenda   | task list            |
| Timeline | seasonal operations  |

---

# Future Premium Views

| View                    |
| ----------------------- |
| valve timeline          |
| row scheduling          |
| crop lifecycle timeline |

Timeline/resource scheduling exists in FullCalendar Premium if needed later. ([fullcalendar.io][2])

---

# 18. 🧭 FARM TIMELINE MODE

This should become your signature view.

---

# Example

```text
Today
  🚰 Irrigate Valve A
  🌾 Mango flowering begins
  🦠 Inspect Row C
```

---

# 19. 📲 NOTIFICATIONS

Future support:

| Notification         |
| -------------------- |
| irrigation reminders |
| disease alerts       |
| weather warnings     |
| missed schedules     |
| harvest reminders    |

---

# 20. ☁️ GOOGLE CALENDAR SYNC

OPTIONAL feature.

Google Calendar API supports recurring event synchronization and external integrations. ([fullcalendar.io][1])

---

# Sync Direction

```text
FarmDots Event
      ↓
Google Calendar Event
```

NOT vice versa initially.

---

# Syncable Events

| Event       |
| ----------- |
| irrigation  |
| harvest     |
| inspections |
| spraying    |
| maintenance |

---

# Architecture

```text
React
   ↓
Worker API
   ↓
Google Calendar API
```

---

# 21. 💾 LOCAL-FIRST REQUIREMENTS

Calendar must:

* work offline
* sync later
* instantly persist

RxDB remains:

* source of truth locally

---

# 22. 📂 UPDATED PROJECT STRUCTURE

```bash
calendar/
  components/
  views/
  recurrence/
  scheduling/
  weather/
  sync/
  ai/
```

---

# 23. 🚀 IMPLEMENTATION ROADMAP

---

# PHASE 1 — CORE CALENDAR ENGINE

Build:

* FarmEvent model
* RxDB storage
* FullCalendar integration
* month/week/day views

---

# PHASE 2 — OPERATIONAL EVENTS

Build:

* irrigation schedules
* crop lifecycle events
* disease reminders
* recurring events

---

# PHASE 3 — WEATHER INTELLIGENCE

Build:

* weather-aware scheduling
* rain-aware irrigation
* humidity alerts

---

# PHASE 4 — SPATIAL INTEGRATION

Build:

* workspace overlays
* valve schedule visualization
* row highlighting

---

# PHASE 5 — AI INTELLIGENCE

Build:

* Gemini scheduling assistant
* operational summaries
* smart recommendations

---

# PHASE 6 — GOOGLE CALENDAR SYNC

Build:

* OAuth
* event sync
* export/import

---

# 24. 🏆 FINAL PRODUCT POSITIONING

FarmDots Calendar becomes:

> 🌱 “Temporal Operating System for Farms”

Core differentiators:

* crop-aware scheduling
* irrigation intelligence
* weather-aware operations
* spatial calendar visualization
* simulation-integrated timelines
* AI-generated operational planning

---

# 25. 🧠 MOST IMPORTANT PRODUCT PRINCIPLE

The calendar should always:

* connect to farm geometry
* connect to rows/plants/valves
* visually appear in workspace
* feel agricultural and operational

NOT:

> generic business scheduling software.

[1]: https://fullcalendar.io/docs/recurring-events?utm_source=chatgpt.com "Recurring Events - Docs"
[2]: https://fullcalendar.io/docs/timeline-view?utm_source=chatgpt.com "Docs Timeline View"

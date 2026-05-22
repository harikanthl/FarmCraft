# 🌱 FarmDots Voice Operations System PRD

## Version 1.0 — Multilingual Voice-Native Farm Operations

Built for:

* Telugu
* Hindi
* Tamil
* Marathi
* Kannada
* Malayalam
* mixed Indian language workflows

Powered by:

* [Sarvam AI APIs](https://docs.sarvam.ai/api-reference-docs/introduction?utm_source=chatgpt.com)
* Gemini structured reasoning
* RxDB local-first architecture
* Workspace + Calendar integration

Sarvam supports:

* 22 Indian languages
* automatic language detection
* code-mixing
* streaming speech recognition
* multilingual TTS. ([Sarvam AI Developer Documentation][1])

---

# 1. 🎯 PRODUCT GOAL

Create:

# 🌱 “Voice-Native Farm Operations Platform”

The user should:

* speak naturally
* create operations instantly
* manage irrigation by voice
* interact in their own language
* operate farms hands-free

---

# 2. 🧠 CORE PRODUCT PHILOSOPHY

The system is NOT:

* generic chatbot
* Alexa clone
* voice assistant toy

The system IS:

# 🌱 operational voice workflow engine

---

# 3. 🏗️ SYSTEM ARCHITECTURE

```text id="jlwm81"
User Speech
     ↓
Sarvam Speech-to-Text
     ↓
Gemini Intent Extraction
     ↓
Structured Draft Operation
     ↓
User Confirmation
     ↓
Calendar + Workspace Update
     ↓
Sarvam Text-to-Speech Confirmation
```

Sarvam STT supports multilingual Indian-language transcription and code-mixed speech workflows. ([Sarvam AI Developer Documentation][1])

---

# 4. 🧱 CORE STACK

| Layer             | Tech               |
| ----------------- | ------------------ |
| Speech-to-text    | Sarvam Saaras v3   |
| Intent reasoning  | Gemini             |
| Voice feedback    | Sarvam Bulbul v3   |
| Local persistence | RxDB               |
| API orchestration | Cloudflare Workers |
| UI                | React              |
| State             | Zustand            |

---

# 5. 🎙️ PRIMARY UX MODEL

---

# Push-to-Talk Workflow

User taps:
🎙️

Speaks naturally:

```text id="jlwm82"
Water Valve B every 3 days
```

OR:

```text id="jlwm83"
రేపు వాల్వ్ B కి నీళ్లు పెట్టు
```

---

# System Flow

```text id="jlwm84"
Speech
  ↓
Transcription
  ↓
Intent extraction
  ↓
Draft card
  ↓
User confirmation
  ↓
Save operation
```

---

# 6. 🌍 SUPPORTED LANGUAGES

Initial rollout:

| Language | Support |
| -------- | ------- |
| English  | ✅       |
| Telugu   | ✅       |
| Hindi    | ✅       |
| Tamil    | ✅       |

Future:

* Kannada
* Marathi
* Malayalam
* Bengali

Sarvam supports 22 Indian languages with automatic language detection. ([Sarvam AI Developer Documentation][1])

---

# 7. 🧠 VOICE COMMAND TYPES

---

# Operational Commands

| Intent     | Example                  |
| ---------- | ------------------------ |
| irrigation | irrigate Valve B         |
| spraying   | spray rows 2–4           |
| fertilizer | add NPK next Monday      |
| pruning    | prune southern rows      |
| harvest    | schedule mango harvest   |
| inspection | inspect disease in Row C |

---

# Contextual Commands

| Intent  | Example                   |
| ------- | ------------------------- |
| query   | how is irrigation health? |
| alert   | show disease issues       |
| summary | summarize this farm       |
| weather | rain expected tomorrow?   |

---

# 8. 🎙️ MICROPHONE SYSTEM

---

# Locations

Voice mic available in:

* workspace
* calendar
* mobile floating dock

---

# UI States

| State        | UI               |
| ------------ | ---------------- |
| idle         | mic icon         |
| recording    | pulsing waveform |
| transcribing | spinner          |
| parsing      | AI badge         |
| ready        | draft card       |

---

# 9. 🌱 SARVAM STT INTEGRATION

Use:

# Saaras v3

Supports:

* multilingual transcription
* code mixing
* automatic language detection
* timestamps
* streaming. ([Sarvam AI Developer Documentation][1])

---

# Worker Endpoint

```http id="jlwm85"
POST /api/v1/voice/transcribe
```

---

# Request

```json id="jlwm86"
{
  "audio": "...",
  "language": "auto"
}
```

---

# Response

```json id="jlwm87"
{
  "transcript": "Water Valve B tomorrow morning",
  "language": "en"
}
```

---

# 10. 🤖 GEMINI INTENT EXTRACTION

CRITICAL layer.

Gemini converts:

* natural speech
  → structured operational intent.

Gemini structured JSON outputs are ideal for this workflow orchestration style. ([Sarvam AI Developer Documentation][2])

---

# Worker Endpoint

```http id="jlwm88"
POST /api/v1/voice/parse-intent
```

---

# Input

```json id="jlwm89"
{
  "transcript": "Water Valve B every 3 days",
  "farmContext": {...}
}
```

---

# Output

```json id="jlwm90"
{
  "intent": "create_operation",

  "operationType": "irrigation",

  "target": {
    "valveIds": ["valve-b"]
  },

  "schedule": {
    "frequency": "daily",
    "interval": 3
  },

  "draft": true
}
```

---

# 11. 📋 DRAFT OPERATIONS SYSTEM

VERY IMPORTANT.

Voice NEVER writes directly to DB.

All voice-generated actions become:

# draft operations

---

# Draft Card Example

```text id="jlwm91"
🚰 Irrigation Draft

Valve B
Every 3 days
6:00 AM

[Confirm]
[Edit]
[Discard]
```

---

# 12. 🧠 CONTEXTUAL VOICE MODE

CRITICAL feature.

Voice commands inherit workspace context.

---

# Example

User selects:

```text id="jlwm92"
Valve B
```

Then says:

```text id="jlwm93"
schedule irrigation tomorrow
```

System already knows:

* target valve
* current farm
* selected rows

This creates:

# extremely fast workflows.

---

# 13. 📅 CALENDAR INTEGRATION

Confirmed drafts become:

* FarmEvents
* recurring operations
* irrigation schedules

---

# Supported Voice Calendar Operations

| Operation     |
| ------------- |
| create        |
| edit          |
| reschedule    |
| cancel        |
| mark complete |

---

# Example

```text id="jlwm94"
Move irrigation to Friday
```

---

# 14. 🌍 MULTILINGUAL RESPONSE SYSTEM

Voice responses occur in:

* selected UI language
* detected speech language

---

# Example

User speaks Telugu.

System replies:

```text id="jlwm95"
వాల్వ్ B నీటిపారుదల షెడ్యూల్ చేయబడింది
```

Sarvam Bulbul v3 supports multilingual Indian-language TTS generation. ([Sarvam AI][3])

---

# 15. 🔊 SARVAM TTS INTEGRATION

Use:

# Bulbul v3

Features:

* expressive speech
* Indian accents
* multilingual voices
* streaming support. ([Sarvam AI][3])

---

# Worker Endpoint

```http id="jlwm96"
POST /api/v1/voice/speak
```

---

# Input

```json id="jlwm97"
{
  "text": "Irrigation scheduled",
  "language": "te"
}
```

---

# Response

```json id="jlwm98"
{
  "audioUrl": "..."
}
```

---

# 16. 🌱 OPERATIONAL VOICE FEEDBACK

Keep responses:

* short
* operational
* calm

---

# GOOD

```text id="jlwm99"
Irrigation scheduled.
```

---

# BAD

Long AI assistant speeches.

---

# 17. 🚰 VOICE + IRRIGATION ENGINE

This becomes:

# signature workflow

---

# Examples

```text id="jlwm100"
Water rows 3 to 6 tomorrow
```

```text id="jlwm101"
Stop irrigation on Valve C
```

```text id="jlwm102"
Repeat irrigation every other morning
```

---

# 18. 🦠 DISEASE VOICE WORKFLOWS

Examples:

```text id="jlwm103"
Mark fungal issue in Row D
```

```text id="jlwm104"
Inspect all trees near Valve A
```

---

# 19. 🌾 HARVEST VOICE WORKFLOWS

Examples:

```text id="jlwm105"
Schedule mango harvest next Monday
```

```text id="jlwm106"
Mark southern rows harvested
```

---

# 20. 📦 VOICE INTENT MODEL

---

# Intent Schema

```ts id="jlwm107"
VoiceIntent {
  type

  operationType

  farmId

  valveIds
  rowIds
  plantIds

  recurrence

  startDate
  endDate

  notes

  confidence
}
```

---

# 21. ⚠️ CONFIDENCE THRESHOLDS

CRITICAL.

---

# Rules

| Confidence | Action            |
| ---------- | ----------------- |
| >0.9       | direct draft      |
| 0.6–0.9    | ask confirmation  |
| <0.6       | ask clarification |

---

# Example

```text id="jlwm108"
Did you mean Valve B or Valve D?
```

---

# 22. 🌍 TRANSLATION SUPPORT

Use Sarvam translation APIs for:

* cross-language operations
* normalized AI parsing
* multilingual summaries

Sarvam supports Indic↔Indic and Indic↔English translation workflows. ([Sarvam AI Developer Documentation][4])

---

# Example

Telugu speech:
↓
English normalized intent
↓
Gemini parsing
↓
localized Telugu response

---

# 23. 🧠 GEMINI RESPONSIBILITIES

Gemini handles:

* intent extraction
* reasoning
* scheduling interpretation
* contextual understanding

---

# Gemini DOES NOT:

* transcribe speech
* generate audio
* directly modify DB

---

# 24. 💾 LOCAL-FIRST REQUIREMENTS

Voice workflows must:

* work offline partially
* queue drafts locally
* sync later

---

# Local Queue

```text id="jlwm109"
pendingVoiceOperations
```

stored in RxDB.

---

# 25. 🚀 IMPLEMENTATION ROADMAP

---

# PHASE 1 — STT FOUNDATION

Build:

* mic recording
* Sarvam STT
* transcription UI

---

# PHASE 2 — INTENT EXTRACTION

Build:

* Gemini parsing
* structured JSON
* draft cards

---

# PHASE 3 — OPERATION CREATION

Build:

* calendar integration
* workspace integration
* recurring ops

---

# PHASE 4 — MULTILINGUAL TTS

Build:

* Sarvam Bulbul
* localized confirmations
* operational responses

---

# PHASE 5 — CONTEXTUAL VOICE

Build:

* selected entity awareness
* contextual scheduling
* row/valve-aware commands

---

# PHASE 6 — ADVANCED AGENTIC WORKFLOWS

Build:

* conversational operations
* AI summaries
* operational copilots

---

# 26. 🏆 SUCCESS CRITERIA

A Telugu farmer should be able to:

```text id="jlwm110"
Speak naturally
↓
Create irrigation schedule
↓
Confirm operation
↓
Hear Telugu confirmation
↓
See spatial update in workspace
```

within:

* seconds
* without typing

---

# 27. 🧠 MOST IMPORTANT PRODUCT PRINCIPLE

You are NOT building:

> “voice chatbot.”

You are building:

# 🌱 “voice-native farm operations platform”

That is the moat.

---

# 28. 🏆 FINAL POSITIONING

FarmDots Voice becomes:

> 🌍 “Multilingual voice operating system for farms”

Core differentiators:

* Indian-language-native workflows
* spatial operational context
* irrigation-aware voice control
* multilingual AI operations
* calendar-integrated voice scheduling
* culturally-native UX

---

# 29. 📚 REFERENCES

Sarvam supports multilingual speech-to-text and code-mixed Indian-language transcription. ([Sarvam AI Developer Documentation][1])

Sarvam supports multilingual Indian-language text-to-speech generation. ([Sarvam AI][3])

Sarvam translation APIs support Indic↔Indic and Indic↔English workflows. ([Sarvam AI Developer Documentation][4])

[1]: https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/overview?utm_source=chatgpt.com "Speech-to-Text APIs"
[2]: https://docs.sarvam.ai/api-reference-docs/introduction?utm_source=chatgpt.com "Welcome to Sarvam AI API Reference Documentation"
[3]: https://www.sarvam.ai/apis/text-to-speech?utm_source=chatgpt.com "Text to Speech API for Indian Languages"
[4]: https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/text-processing/translation?utm_source=chatgpt.com "Text Translation API"

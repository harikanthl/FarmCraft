# 🌍 FarmDots Internationalization (i18n) PRD

## Version 1.0 — Multilingual Architecture for Indian & Global Farmers

Supports:

* English
* Telugu
* Hindi
* Tamil
* Kannada
* Malayalam
* future languages

Built for:

* React + TypeScript + Vite
* RxDB
* Cloudflare stack
* Gemini multilingual AI
* future voice workflows

Uses:

* react-i18next
* ICU Message Format
* namespace-based translation architecture

`react-i18next` is one of the most widely used React localization systems and supports ICU formatting via `i18next-icu`. ([react-i18next][1])

---

# 1. 🎯 PRODUCT GOAL

Create:

# 🌱 “Language-native Farm Operating System”

The app should:

* instantly switch languages
* support Indian scripts correctly
* localize operational workflows
* localize AI outputs
* support future voice interactions

---

# 2. 🧠 CORE PRODUCT PRINCIPLES

---

# Principle 1 — Language Agnostic Core

Internal system logic NEVER changes by language.

Only:

* display labels
* UI text
* AI responses
* voice interactions

change.

---

# Principle 2 — Canonical Internal IDs

Backend/database values remain stable.

Example:

```json id="jlwm11"
{
  "cropId": "mango"
}
```

NOT:

```json id="jlwm12"
{
  "cropId": "మామిడి"
}
```

This is CRITICAL architecture.

---

# Principle 3 — Localize Everything User-Facing

All visible UI text:

* buttons
* overlays
* alerts
* weather
* calendar ops
* assistant responses

must go through i18n.

---

# Principle 4 — AI Must Respect User Language

Gemini responses must:

* detect user-selected locale
* answer in that language
* use localized agricultural terminology

---

# 3. 🏗️ SYSTEM ARCHITECTURE

```text id="jlwm13"
React App
   ↓
react-i18next
   ↓
ICU Translation Engine
   ↓
Localized UI
   ↓
Gemini Multilingual Responses
```

---

# 4. 🧱 CORE STACK

| Layer               | Tech                             |
| ------------------- | -------------------------------- |
| React i18n          | react-i18next                    |
| ICU support         | i18next-icu                      |
| Locale detection    | i18next-browser-languagedetector |
| Fonts               | Noto Sans                        |
| Translation storage | JSON namespaces                  |
| AI localization     | Gemini prompts                   |

`i18next-icu` integrates ICU MessageFormat into i18next/react-i18next. ([react-i18next][1])

---

# 5. 📂 PROJECT STRUCTURE

```bash id="jlwm14"
src/
  i18n/
    index.ts

    locales/
      en/
        common.json
        workspace.json
        calendar.json
        weather.json
        crops.json

      te/
        common.json
        workspace.json
        calendar.json
        weather.json
        crops.json

      hi/
      ta/
      kn/
      ml/
```

---

# 6. 🌍 SUPPORTED LANGUAGES

Initial rollout:

| Language | Code |
| -------- | ---- |
| English  | en   |
| Telugu   | te   |
| Hindi    | hi   |

Later:

| Language  | Code |
| --------- | ---- |
| Tamil     | ta   |
| Kannada   | kn   |
| Malayalam | ml   |

---

# 7. 🌱 NAMESPACE STRATEGY

Namespaces prevent:

* giant translation files
* scaling issues
* translation chaos

This aligns with i18next scaling best practices. ([i18next][2])

---

# Namespaces

| Namespace | Purpose        |
| --------- | -------------- |
| common    | navbar/buttons |
| workspace | overlays/tools |
| calendar  | operations     |
| weather   | forecasts      |
| crops     | crop labels    |
| alerts    | warnings       |
| assistant | AI outputs     |
| forms     | dialogs/forms  |

---

# 8. 🧠 ICU MESSAGE FORMAT

Use ICU syntax for:

* plurals
* interpolation
* gender
* counts
* formatting

ICU MessageFormat is the industry-standard solution for multilingual pluralization and formatting. ([Phrase][3])

---

# Example

```json id="jlwm15"
{
  "plants.count":
    "{count, plural,
      one {# plant}
      other {# plants}
    }"
}
```

---

# Telugu Example

```json id="jlwm16"
{
  "plants.count":
    "{count, plural,
      one {# మొక్క}
      other {# మొక్కలు}
    }"
}
```

---

# 9. 🌿 LANGUAGE SWITCHER

## Location

Navbar:

```text id="jlwm17"
🌍 Language
```

---

# UI

```text id="jlwm18"
English
తెలుగు
हिन्दी
தமிழ்
```

Use native scripts ONLY.

---

# Features

| Feature |
|---|---|
| instant switching |
| persistent language |
| auto-detect locale |
| no reload required |

---

# 10. 🌍 AUTO LANGUAGE DETECTION

On first launch:

```ts id="jlwm19"
navigator.language
```

used to:

* detect browser/device language
* auto-load best locale

---

# Example

Indian Telugu user:
→ app auto-loads Telugu.

---

# 11. 🌱 FONT SYSTEM

Use:

# [Google Noto Fonts](https://fonts.google.com/noto?utm_source=chatgpt.com)

---

# Why?

Supports:

* Telugu
* Hindi
* Tamil
* Kannada
* Malayalam
* Unicode rendering

---

# Fonts

| Purpose  | Font                 |
| -------- | -------------------- |
| Latin UI | Noto Sans            |
| Telugu   | Noto Sans Telugu     |
| Hindi    | Noto Sans Devanagari |
| Tamil    | Noto Sans Tamil      |

---

# 12. 📦 TRANSLATION KEY STRATEGY

Use:

# semantic hierarchical keys

Example:

```json id="jlwm20"
{
  "workspace.overlay.yield": "Yield Band"
}
```

NOT:

```json id="jlwm21"
{
  "yieldBand": "Yield Band"
}
```

Hierarchical keys improve maintainability and scalability. ([Locize][4])

---

# 13. 🌾 LOCALIZED CROP SYSTEM

VERY IMPORTANT.

---

# Internal Model

```json id="jlwm22"
{
  "cropId": "mango"
}
```

---

# Translation Layer

```json id="jlwm23"
{
  "crop.mango": "మామిడి"
}
```

---

# Supported Crop Translations

| English | Telugu  |
| ------- | ------- |
| Mango   | మామిడి  |
| Banana  | అరటి    |
| Coconut | కొబ్బరి |
| Chili   | మిర్చి  |

---

# 14. 📅 CALENDAR LOCALIZATION

Everything localizes:

* operation names
* statuses
* recurrence
* dates
* weekdays

---

# Example

```text id="jlwm24"
Irrigation
→
నీటిపారుదల
```

---

# 15. 🌦️ WEATHER LOCALIZATION

Localized:

* conditions
* alerts
* recommendations
* units

---

# Example

```text id="jlwm25"
Humidity High
```

→

```text id="jlwm26"
తేమ ఎక్కువగా ఉంది
```

---

# 16. 🤖 GEMINI MULTILINGUAL AI

VERY important.

Gemini should respond in:

* user-selected language
* agricultural context

---

# Worker Prompt Example

```text id="jlwm27"
Respond ONLY in Telugu.
Use simple agricultural language understandable by Indian farmers.
```

---

# Features

| Feature |
|---|---|
| localized summaries |
| localized alerts |
| localized recommendations |
| multilingual assistant |

---

# 17. 🎙️ FUTURE VOICE WORKFLOWS

Architecture must support:

* Telugu speech input
* Hindi speech input
* Tamil speech input

---

# Example

```text id="jlwm28"
రేపు వాల్వ్ B కి నీళ్లు పెట్టు
```

↓

Creates:

* irrigation calendar event

---

# 18. 🧭 WORKSPACE LOCALIZATION

Localized:

* overlays
* toolbar
* warnings
* geometry labels
* alerts

---

# Example

```text id="jlwm29"
Disease Pressure
```

↓

```text id="jlwm30"
వ్యాధి ఒత్తిడి
```

---

# 19. ⚠️ IMPORTANT UI REQUIREMENTS

Indian languages:

* longer text
* different line heights
* variable widths

---

# REQUIREMENTS

| Requirement |
|---|---|
| responsive layouts |
| no fixed button widths |
| wrapping support |
| scalable typography |

---

# 20. 💾 LANGUAGE PERSISTENCE

Store selected locale in:

* RxDB
  OR
* localStorage

---

# Example

```json id="jlwm31"
{
  "preferredLanguage": "te"
}
```

---

# 21. 🚀 IMPLEMENTATION ROADMAP

---

# PHASE 1 — i18n Foundation

Build:

* react-i18next
* ICU integration
* namespace architecture
* English baseline

---

# PHASE 2 — Telugu + Hindi

Build:

* translation files
* switcher
* locale persistence

---

# PHASE 3 — Calendar + Workspace Localization

Build:

* overlays
* operations
* alerts
* weather

---

# PHASE 4 — Gemini Localization

Build:

* multilingual AI prompts
* localized summaries
* localized recommendations

---

# PHASE 5 — Voice Localization

Build:

* multilingual speech-to-text
* voice-created operations
* voice assistant

---

# 22. 🏆 SUCCESS CRITERIA

A Telugu farmer should:

* open app
* see Telugu instantly
* interact naturally
* receive AI insights in Telugu
* create operations in Telugu
* understand overlays/calendar fully

without:

* English dependency.

---

# 23. 🧠 MOST IMPORTANT PRODUCT PRINCIPLE

Localization is NOT:

> “translation layer.”

It becomes:

# 🌱 culturally-native operational farming software

That is the actual long-term moat.

---

# 24. 🏆 FINAL POSITIONING

FarmDots becomes:

> 🌍 “Multilingual spatial operating system for farms”

Core differentiators:

* Indian-language-first UX
* localized operational intelligence
* multilingual AI assistant
* crop-aware localization
* voice-native workflows
* spatial multilingual overlays

---

# 25. 📚 REFERENCES

react-i18next supports scalable React internationalization patterns. ([i18next][2])

ICU MessageFormat is the industry-standard solution for pluralization and multilingual formatting. ([Phrase][3])

i18next supports ICU integration through `i18next-icu`. ([react-i18next][1])

[1]: https://react.i18next.com/misc/using-with-icu-format?utm_source=chatgpt.com "Using with ICU format | react-i18next documentation"
[2]: https://www.i18next.com/?utm_source=chatgpt.com "i18next documentation: Introduction"
[3]: https://phrase.com/blog/posts/guide-to-the-icu-message-format/?utm_source=chatgpt.com "A Practical Guide to the ICU Message Format"
[4]: https://www.locize.com/blog/guide-to-i18n-key-naming?utm_source=chatgpt.com "A Definitive Guide to i18n Key Naming for Longevity and ..."

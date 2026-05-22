/**
 * Multilingual AI helpers for Gemini routes ([lang.md](../../lang.md) §16).
 *
 * Locale codes match `@farmdots/shared` `SUPPORTED_UI_LANGUAGES` so the worker
 * can localize replies for every language exposed in the web switcher.
 */

import {
  normalizeUiLanguage,
  type SupportedUiLanguageCode,
  uiLanguageEnglishName,
} from "@farmdots/shared";

export type AiLocale = SupportedUiLanguageCode;

export function normalizeLocale(input: string | undefined | null): AiLocale {
  return normalizeUiLanguage(input);
}

/**
 * Plain-prose preamble forcing the model to reply in the user's language with
 * simple agricultural phrasing.
 */
export function localeInstruction(locale: AiLocale): string {
  if (locale === "en") return "";
  const name = uiLanguageEnglishName(locale);
  return `Respond ONLY in ${name}. Use simple agricultural language understandable by farmers globally; keep units practical for smallholder fields.`;
}

/**
 * Preamble for JSON-producing endpoints. Tells the model to keep schema keys
 * English while localizing the user-facing string **values**.
 */
export function localeJsonInstruction(locale: AiLocale): string {
  if (locale === "en") return "";
  const name = uiLanguageEnglishName(locale);
  return `Reply with valid JSON only. Keep all JSON keys and enum values in English (unchanged from the schema). Write every user-facing string value (titles, descriptions, diagnoses, recommendations, etc.) in ${name} using clear agricultural wording.`;
}

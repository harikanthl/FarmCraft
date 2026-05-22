/**
 * Re-exports the shared catalog so UI code can import from `@/i18n/languages`.
 * Full translations exist for `en`, `te`, and `hi`; other codes use English
 * bundles until locale JSON is added.
 */
import type { SupportedUiLanguageCode } from "@farmdots/shared";
import { normalizeUiLanguage, SUPPORTED_UI_LANGUAGES } from "@farmdots/shared";

export const SUPPORTED_LANGUAGES = SUPPORTED_UI_LANGUAGES;

export type SupportedLanguageCode = SupportedUiLanguageCode;

export const LANGUAGE_STORAGE_KEY = "farmdots_preferredLanguage";

export function normalizeLanguage(input: string | undefined | null): SupportedLanguageCode {
  return normalizeUiLanguage(input);
}

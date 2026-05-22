/**
 * UI + AI locale catalog. `nativeLabel` is shown in the language switcher (PRD §9).
 * `labelEn` is the English name sent to Gemini so prompts stay unambiguous.
 *
 * Languages without full JSON translations in the web app still appear here;
 * the web i18n layer falls back to English strings for those codes.
 */

export const SUPPORTED_UI_LANGUAGES = [
  { code: "en", nativeLabel: "English", labelEn: "English" },
  { code: "es", nativeLabel: "Español", labelEn: "Spanish" },
  { code: "fr", nativeLabel: "Français", labelEn: "French" },
  { code: "de", nativeLabel: "Deutsch", labelEn: "German" },
  { code: "it", nativeLabel: "Italiano", labelEn: "Italian" },
  { code: "pt", nativeLabel: "Português", labelEn: "Portuguese" },
  { code: "nl", nativeLabel: "Nederlands", labelEn: "Dutch" },
  { code: "pl", nativeLabel: "Polski", labelEn: "Polish" },
  { code: "ru", nativeLabel: "Русский", labelEn: "Russian" },
  { code: "uk", nativeLabel: "Українська", labelEn: "Ukrainian" },
  { code: "tr", nativeLabel: "Türkçe", labelEn: "Turkish" },
  { code: "sv", nativeLabel: "Svenska", labelEn: "Swedish" },
  { code: "da", nativeLabel: "Dansk", labelEn: "Danish" },
  { code: "fi", nativeLabel: "Suomi", labelEn: "Finnish" },
  { code: "nb", nativeLabel: "Norsk", labelEn: "Norwegian" },
  { code: "is", nativeLabel: "Íslenska", labelEn: "Icelandic" },
  { code: "cs", nativeLabel: "Čeština", labelEn: "Czech" },
  { code: "sk", nativeLabel: "Slovenčina", labelEn: "Slovak" },
  { code: "hu", nativeLabel: "Magyar", labelEn: "Hungarian" },
  { code: "ro", nativeLabel: "Română", labelEn: "Romanian" },
  { code: "bg", nativeLabel: "Български", labelEn: "Bulgarian" },
  { code: "hr", nativeLabel: "Hrvatski", labelEn: "Croatian" },
  { code: "sr", nativeLabel: "Српски", labelEn: "Serbian" },
  { code: "sl", nativeLabel: "Slovenščina", labelEn: "Slovenian" },
  { code: "et", nativeLabel: "Eesti", labelEn: "Estonian" },
  { code: "lv", nativeLabel: "Latviešu", labelEn: "Latvian" },
  { code: "lt", nativeLabel: "Lietuvių", labelEn: "Lithuanian" },
  { code: "el", nativeLabel: "Ελληνικά", labelEn: "Greek" },
  { code: "ga", nativeLabel: "Gaeilge", labelEn: "Irish" },
  { code: "cy", nativeLabel: "Cymraeg", labelEn: "Welsh" },
  { code: "ar", nativeLabel: "العربية", labelEn: "Arabic" },
  { code: "he", nativeLabel: "עברית", labelEn: "Hebrew" },
  { code: "fa", nativeLabel: "فارسی", labelEn: "Persian" },
  { code: "hi", nativeLabel: "हिन्दी", labelEn: "Hindi" },
  { code: "bn", nativeLabel: "বাংলা", labelEn: "Bengali" },
  { code: "ta", nativeLabel: "தமிழ்", labelEn: "Tamil" },
  { code: "te", nativeLabel: "తెలుగు", labelEn: "Telugu" },
  { code: "mr", nativeLabel: "मराठी", labelEn: "Marathi" },
  { code: "gu", nativeLabel: "ગુજરાતી", labelEn: "Gujarati" },
  { code: "pa", nativeLabel: "ਪੰਜਾਬੀ", labelEn: "Punjabi" },
  { code: "kn", nativeLabel: "ಕನ್ನಡ", labelEn: "Kannada" },
  { code: "ml", nativeLabel: "മലയാളം", labelEn: "Malayalam" },
  { code: "or", nativeLabel: "ଓଡ଼ିଆ", labelEn: "Odia" },
  { code: "ur", nativeLabel: "اردو", labelEn: "Urdu" },
  { code: "si", nativeLabel: "සිංහල", labelEn: "Sinhala" },
  { code: "ne", nativeLabel: "नेपाली", labelEn: "Nepali" },
  { code: "zh", nativeLabel: "中文", labelEn: "Chinese (Simplified)" },
  { code: "ja", nativeLabel: "日本語", labelEn: "Japanese" },
  { code: "ko", nativeLabel: "한국어", labelEn: "Korean" },
  { code: "th", nativeLabel: "ไทย", labelEn: "Thai" },
  { code: "vi", nativeLabel: "Tiếng Việt", labelEn: "Vietnamese" },
  { code: "id", nativeLabel: "Bahasa Indonesia", labelEn: "Indonesian" },
  { code: "ms", nativeLabel: "Bahasa Melayu", labelEn: "Malay" },
  { code: "tl", nativeLabel: "Filipino", labelEn: "Filipino" },
  { code: "sw", nativeLabel: "Kiswahili", labelEn: "Swahili" },
  { code: "af", nativeLabel: "Afrikaans", labelEn: "Afrikaans" },
] as const;

export type SupportedUiLanguageCode = (typeof SUPPORTED_UI_LANGUAGES)[number]["code"];

const VALID_CODES = new Set<string>(SUPPORTED_UI_LANGUAGES.map((l) => l.code));

/** Map `te-IN`, browser tags, etc. to a supported UI code; unknown → English. */
export function normalizeUiLanguage(input: string | undefined | null): SupportedUiLanguageCode {
  if (!input) return "en";
  const base = input.toLowerCase().split(/[-_]/)[0]?.trim() ?? "en";
  if (VALID_CODES.has(base)) return base as SupportedUiLanguageCode;
  return "en";
}

export function uiLanguageEnglishName(code: string): string {
  const row = SUPPORTED_UI_LANGUAGES.find((l) => l.code === code);
  return row?.labelEn ?? "English";
}

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** BCP-47 hints for `<html lang>` when the short UI code is ambiguous. */
const HTML_LANG_OVERRIDES: Record<string, string> = {
  zh: "zh-Hans",
  he: "he",
  ar: "ar",
  tl: "fil",
};

/** Sync `<html lang>` with the active i18n language so a11y + script shaping behave correctly. */
export function HtmlLang() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const raw = i18n.resolvedLanguage ?? i18n.language ?? "en";
    const base = raw.toLowerCase().split("-")[0] ?? "en";
    document.documentElement.lang = HTML_LANG_OVERRIDES[base] ?? raw;
  }, [i18n.resolvedLanguage, i18n.language]);
  return null;
}

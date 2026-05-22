import i18n from "i18next";
import ICU from "i18next-icu";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

import { SUPPORTED_UI_LANGUAGES } from "@farmdots/shared";
import { LANGUAGE_STORAGE_KEY } from "./languages";

export const I18N_NAMESPACES = [
  "common",
  "workspace",
  "calendar",
  "weather",
  "crops",
  "alerts",
  "assistant",
  "forms",
  "auth",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

/** Lazy chunks: only the active UI language’s JSON files are fetched (not every locale at once). */
const localeLoaders = import.meta.glob<{ default: Record<string, unknown> }>("./locales/*/*.json");

function loaderFor(lng: string, ns: string) {
  const primary = `./locales/${lng}/${ns}.json`;
  const fallback = `./locales/en/${ns}.json`;
  return localeLoaders[primary] ?? localeLoaders[fallback];
}

const isDev = import.meta.env.DEV;

export const i18nReady = i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(
    resourcesToBackend((lng, ns, callback) => {
      const load = loaderFor(lng, ns);
      if (!load) {
        callback(null, {});
        return;
      }
      void load()
        .then((mod) => callback(null, mod.default))
        .catch((err) => callback(err, null));
    }),
  )
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: SUPPORTED_UI_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    defaultNS: "common",
    ns: ["common"],
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    returnNull: false,
    react: { useSuspense: false },
    ...(isDev && {
      missingKeyHandler: (lngs: readonly string[], ns: string, key: string) => {
        console.warn(`[i18n missing] lng=${lngs.join(",")} ns=${ns} key=${key}`);
      },
    }),
  });

export default i18n;

/**
 * Machine-translate locale JSON from English using the free MyMemory API.
 * Preserves ICU / Trans placeholders by copying English for risky strings.
 *
 * Usage (from repo root): `pnpm i18n:generate`
 *
 * Roadmap (preferred for production): run generation from the worker or a CI
 * script using **Sarvam Translate** for Indic languages, **Gemini** for
 * structure validation / glossaries, and keep English JSON as the only source
 * of truth. Use MyMemory only as an optional fallback — it is rate-limited and
 * weak on agricultural terminology.
 *
 * Skips: en (source), te, hi (hand-maintained).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EN_DIR = join(ROOT, "apps/web/src/i18n/locales/en");
const OUT_ROOT = join(ROOT, "apps/web/src/i18n/locales");

const SKIP_LANGS = new Set(["en", "te", "hi"]);
const NAMESPACES = ["common", "workspace", "calendar", "weather", "crops", "alerts", "assistant", "forms"];

/** MyMemory `langpair` target overrides (ISO-ish). */
const MYMEMORY_TARGET = {
  nb: "no",
  zh: "zh-CN",
};

const SEP = "\u241e"; // record separator — unlikely inside UI copy

function shouldSkipTranslation(s) {
  if (typeof s !== "string") return true;
  if (!s.trim()) return true;
  if (/{[^}]*plural[^}]*}/.test(s)) return true;
  if (/<\d>/.test(s)) return true;
  if (/<bold>/.test(s)) return true;
  if (s.includes("FarmDots")) return true;
  return false;
}

function myMemoryPair(targetCode) {
  const tgt = MYMEMORY_TARGET[targetCode] ?? targetCode;
  return `en|${tgt}`;
}

async function translateChunk(strings, targetCode) {
  const pair = myMemoryPair(targetCode);
  const q = strings.join(SEP);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data?.responseData?.translatedText) {
    throw new Error(data?.responseDetails || JSON.stringify(data).slice(0, 200));
  }
  const out = data.responseData.translatedText.split(SEP);
  if (out.length !== strings.length) {
    const out2 = [];
    for (const s of strings) {
      const r = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=${encodeURIComponent(pair)}`,
      );
      const j = await r.json();
      out2.push(j?.responseData?.translatedText ?? s);
      await sleep(120);
    }
    return out2;
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function collectStrings(node, acc) {
  if (typeof node === "string") {
    if (!shouldSkipTranslation(node)) acc.add(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const x of node) collectStrings(x, acc);
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) collectStrings(v, acc);
  }
}

function applyTranslations(node, map) {
  if (typeof node === "string") {
    if (shouldSkipTranslation(node)) return node;
    return map.get(node) ?? node;
  }
  if (Array.isArray(node)) return node.map((x) => applyTranslations(x, map));
  if (node && typeof node === "object") {
    const o = {};
    for (const [k, v] of Object.entries(node)) o[k] = applyTranslations(v, map);
    return o;
  }
  return node;
}

function readCodesFromShared() {
  const p = join(ROOT, "packages/shared/src/uiLanguages.ts");
  const txt = readFileSync(p, "utf8");
  const codes = [...txt.matchAll(/\{\s*code:\s*"([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(codes)];
}

async function main() {
  const codes = readCodesFromShared();
  const enBundles = {};
  for (const ns of NAMESPACES) {
    const fp = join(EN_DIR, `${ns}.json`);
    enBundles[ns] = JSON.parse(readFileSync(fp, "utf8"));
  }

  for (const lang of codes) {
    if (SKIP_LANGS.has(lang)) continue;
    console.error(`[i18n] ${lang}…`);

    const unique = new Set();
    for (const ns of NAMESPACES) collectStrings(enBundles[ns], unique);
    const list = [...unique];
    const map = new Map();

    const CHUNK = 10;
    for (let i = 0; i < list.length; i += CHUNK) {
      const chunk = list.slice(i, i + CHUNK);
      try {
        const tr = await translateChunk(chunk, lang);
        chunk.forEach((orig, j) => map.set(orig, tr[j] ?? orig));
      } catch (e) {
        console.error(`  chunk fail ${i}:`, e.message);
        for (const s of chunk) map.set(s, s);
      }
      await sleep(200);
    }

    for (const ns of NAMESPACES) {
      const translated = applyTranslations(enBundles[ns], map);
      const dir = join(OUT_ROOT, lang);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${ns}.json`), JSON.stringify(translated, null, 2) + "\n", "utf8");
    }
  }
  console.error("[i18n] done.");
}

await main();

import i18n from "@/i18n";
import { normalizeLanguage } from "@/i18n/languages";

/** Active UI locale to forward to AI endpoints so Gemini replies match the user's language. */
function currentLocale(): string {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

/** Thin HTTP wrappers for AI-ready context endpoints (Phase 4 UI can call these). */
export async function fetchFarmContextJson(farmId: string) {
  const res = await fetch(`/api/v1/farms/${farmId}/context`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchPlantDetailJson(plantId: string) {
  const res = await fetch(`/api/v1/plants/${plantId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function chatWithGemini(prompt: string, farmContext?: unknown) {
  const res = await fetch("/api/v1/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, farmContext, locale: currentLocale() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ reply: string }>;
}

export async function summariseFarm(farmContext: unknown): Promise<{ reply: string }> {
  const res = await fetch("/api/v1/ai/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ farmContext, locale: currentLocale() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function askFarmQuestion(
  question: string,
  farmContext: unknown,
): Promise<{ reply: string }> {
  const res = await fetch("/api/v1/ai/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, farmContext, locale: currentLocale() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type PlantHealthDiagnosis = {
  diagnosis: string;
  confidence: number;
  recommendations: string[];
  raw?: string;
};

export async function analysePlantImage(args: {
  imageBase64: string;
  mimeType: string;
  note?: string;
  farmContext?: unknown;
}): Promise<PlantHealthDiagnosis> {
  const res = await fetch("/api/v1/ai/plant-health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, locale: currentLocale() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

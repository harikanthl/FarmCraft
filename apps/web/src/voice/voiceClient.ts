import i18n from "@/i18n";
import { normalizeLanguage } from "@/i18n/languages";
import type { VoiceIntent } from "@farmdots/shared";

function currentLocale(): string {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export type VoiceTranscribeResult = {
  transcript: string;
  language: string;
  languageCode: string;
};

/** Sarvam Saaras v3 STT proxy (multipart). */
export async function transcribeAudio(
  audio: Blob,
  options?: { languageCode?: string; mode?: "transcribe" | "translate" },
): Promise<VoiceTranscribeResult> {
  const form = new FormData();
  form.append("audio", audio, "audio.webm");
  form.append("language_code", options?.languageCode ?? "auto");
  form.append("mode", options?.mode ?? "transcribe");
  const res = await fetch("/api/v1/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<VoiceTranscribeResult>;
}

export type VoiceParseIntentInput = {
  transcript: string;
  workspaceContext?: {
    farmId?: string | null;
    selectedValveIds?: string[];
    selectedRowIds?: string[];
    selectedPlantIds?: string[];
  };
  farmContext?: unknown;
};

/** Gemini structured-output intent parser (`ai.md` sections 10, 20). */
export async function parseVoiceIntent(input: VoiceParseIntentInput): Promise<{ intent: VoiceIntent }> {
  const res = await fetch("/api/v1/voice/parse-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, locale: currentLocale() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ intent: VoiceIntent }>;
}

export type VoiceSpeakResult = {
  audioBase64: string;
  mimeType: string;
};

/** Sarvam Bulbul v3 TTS proxy. */
export async function speakText(text: string, language?: string): Promise<VoiceSpeakResult> {
  const res = await fetch("/api/v1/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language: language ?? currentLocale() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<VoiceSpeakResult>;
}

/** Sarvam translation proxy — optional in the workflow (`ai.md` section 22). */
export async function translateText(
  text: string,
  source: string | "auto",
  target: string,
): Promise<{ translatedText: string }> {
  const res = await fetch("/api/v1/voice/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source, target }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ translatedText: string }>;
}

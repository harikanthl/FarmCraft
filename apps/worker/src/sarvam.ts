/**
 * Thin proxy helpers for Sarvam AI services used by the FarmDots voice stack
 * (`ai.md` sections 9, 15, 22).
 *
 * The Sarvam key never reaches the browser — every request originates from this
 * worker. All helpers throw on non-2xx so the route handler can decide between
 * 502 (upstream) and 503 (key missing).
 */

const SARVAM_BASE = "https://api.sarvam.ai";

/** Map short UI codes to Sarvam BCP-47 codes (Indic-heavy; others → `en-IN`). */
export function toSarvamLanguage(code: string | undefined | null): string {
  if (!code) return "en-IN";
  const base = code.toLowerCase().split("-")[0];
  switch (base) {
    case "te":
      return "te-IN";
    case "hi":
      return "hi-IN";
    case "ta":
      return "ta-IN";
    case "kn":
      return "kn-IN";
    case "ml":
      return "ml-IN";
    case "mr":
      return "mr-IN";
    case "bn":
      return "bn-IN";
    case "gu":
      return "gu-IN";
    case "pa":
      return "pa-IN";
    case "or":
    case "od":
      return "od-IN";
    case "ur":
      return "ur-IN";
    case "ne":
      return "ne-NP";
    case "si":
      return "si-LK";
    case "en":
    default:
      return "en-IN";
  }
}

/** Reverse of {@link toSarvamLanguage}: `te-IN` -> `te`. */
export function fromSarvamLanguage(code: string | undefined | null): string {
  if (!code) return "en";
  return code.toLowerCase().split("-")[0];
}

export type SarvamTranscribeOptions = {
  audio: Blob;
  /** BCP-47 code or `unknown` (Sarvam auto-detects when omitted). */
  languageCode?: string;
  /** Saaras v3 mode — default `transcribe` keeps the source language. */
  mode?: "transcribe" | "translate";
};

export type SarvamTranscribeResult = {
  transcript: string;
  languageCode: string;
  requestId?: string;
};

/** Call Sarvam Saaras v3 STT. Audio must be ≤30s synchronous-API limit. */
export async function sarvamTranscribe(
  key: string,
  opts: SarvamTranscribeOptions,
): Promise<SarvamTranscribeResult> {
  const form = new FormData();
  form.append("file", opts.audio, "audio.webm");
  form.append("model", "saaras:v3");
  form.append("mode", opts.mode ?? "transcribe");
  if (opts.languageCode && opts.languageCode !== "auto" && opts.languageCode !== "unknown") {
    form.append("language_code", opts.languageCode);
  }
  const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
  });
  if (!res.ok) throw new SarvamError(`STT failed: ${res.status} ${await res.text()}`, res.status);
  const json = (await res.json()) as {
    request_id?: string;
    transcript?: string;
    language_code?: string;
  };
  return {
    transcript: json.transcript ?? "",
    languageCode: json.language_code ?? "en-IN",
    requestId: json.request_id,
  };
}

export type SarvamSpeakOptions = {
  text: string;
  /** BCP-47 code (e.g. `te-IN`). */
  targetLanguageCode: string;
  speaker?: string;
  pace?: number;
};

export type SarvamSpeakResult = {
  /** Base64-encoded WAV. */
  audioBase64: string;
  mimeType: string;
  requestId?: string;
};

/** Call Sarvam Bulbul v3 TTS. */
export async function sarvamSpeak(
  key: string,
  opts: SarvamSpeakOptions,
): Promise<SarvamSpeakResult> {
  const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: opts.text.slice(0, 2500),
      target_language_code: opts.targetLanguageCode,
      model: "bulbul:v3",
      speaker: opts.speaker ?? "anushka",
      pace: opts.pace ?? 1.0,
    }),
  });
  if (!res.ok) throw new SarvamError(`TTS failed: ${res.status} ${await res.text()}`, res.status);
  const json = (await res.json()) as {
    request_id?: string;
    audios?: string[];
  };
  const audio = json.audios?.[0] ?? "";
  return { audioBase64: audio, mimeType: "audio/wav", requestId: json.request_id };
}

export type SarvamTranslateOptions = {
  input: string;
  /** `auto` allows mayura:v1 to detect language; pass BCP-47 to lock it. */
  sourceLanguageCode: string;
  targetLanguageCode: string;
  /** `mayura:v1` (default) supports `auto` source; `sarvam-translate:v1` does not. */
  model?: "mayura:v1" | "sarvam-translate:v1";
};

export type SarvamTranslateResult = {
  translatedText: string;
  requestId?: string;
};

export async function sarvamTranslate(
  key: string,
  opts: SarvamTranslateOptions,
): Promise<SarvamTranslateResult> {
  const res = await fetch(`${SARVAM_BASE}/translate`, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: opts.input,
      source_language_code: opts.sourceLanguageCode,
      target_language_code: opts.targetLanguageCode,
      model: opts.model ?? "mayura:v1",
      mode: "formal",
    }),
  });
  if (!res.ok)
    throw new SarvamError(`Translate failed: ${res.status} ${await res.text()}`, res.status);
  const json = (await res.json()) as {
    request_id?: string;
    translated_text?: string;
  };
  return { translatedText: json.translated_text ?? "", requestId: json.request_id };
}

export class SarvamError extends Error {
  readonly upstreamStatus: number;
  constructor(message: string, upstreamStatus: number) {
    super(message);
    this.name = "SarvamError";
    this.upstreamStatus = upstreamStatus;
  }
}

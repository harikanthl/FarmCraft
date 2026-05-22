import { speakText } from "./voiceClient";

/**
 * Speak the given text in the supplied language code via Sarvam Bulbul v3 (proxied
 * by the worker). Falls back to a noop when audio playback is blocked or the
 * worker returns 503; callers should toast a visual confirmation alongside.
 */
export async function playTtsResponse(text: string, language?: string): Promise<void> {
  if (!text.trim()) return;
  try {
    const { audioBase64, mimeType } = await speakText(text, language);
    if (!audioBase64) return;
    const src = `data:${mimeType ?? "audio/wav"};base64,${audioBase64}`;
    const audio = new Audio(src);
    audio.play().catch(() => {
      /* autoplay blocked — visual confirmation already shown by caller */
    });
  } catch {
    /* TTS proxy unavailable — visual fallback only. */
  }
}

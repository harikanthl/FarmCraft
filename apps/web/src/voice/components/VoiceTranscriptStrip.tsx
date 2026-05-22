import { SUPPORTED_LANGUAGES } from "@/i18n/languages";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useVoiceStore } from "../useVoiceStore";

/**
 * Tiny strip that surfaces the live transcript + detected language so farmers
 * see what Saaras heard before the draft card appears (`ai.md` section 16).
 */
export function VoiceTranscriptStrip({ className }: { className?: string }) {
  const transcript = useVoiceStore((s) => s.transcript);
  const detected = useVoiceStore((s) => s.detectedLanguage);
  const uiState = useVoiceStore((s) => s.uiState);
  const { t } = useTranslation("assistant");

  if (!transcript && uiState === "idle") return null;

  const native = detected
    ? SUPPORTED_LANGUAGES.find((l) => l.code === detected)?.nativeLabel ?? detected
    : null;

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/80",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t("transcript.label")}
      </div>
      <div className="mt-1 text-slate-900 dark:text-slate-100">
        {transcript ?? "…"}
      </div>
      {native ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("transcript.detected", { value: native })}
        </div>
      ) : null}
    </div>
  );
}

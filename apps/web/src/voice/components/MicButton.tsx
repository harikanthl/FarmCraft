import { cn } from "@/lib/utils";
import { Loader2, Mic, MicOff, Sparkles, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVoiceStore } from "../useVoiceStore";

type MicButtonProps = {
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Push-to-talk mic. State visuals follow PRD section 8 ("UI States"):
 * idle (mic), recording (pulse), transcribing (spinner), parsing (AI badge),
 * ready (mic-on), speaking (volume), error (mic-off).
 */
export function MicButton({ onToggle, disabled, size = "md", className }: MicButtonProps) {
  const state = useVoiceStore((s) => s.uiState);
  const { t } = useTranslation("assistant");

  const sizeClass =
    size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  const palette: Record<typeof state, string> = {
    idle: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200",
    recording:
      "bg-red-500 text-white animate-pulse ring-4 ring-red-500/40",
    transcribing: "bg-amber-500 text-white",
    parsing: "bg-indigo-500 text-white",
    ready: "bg-emerald-500 text-white",
    speaking: "bg-sky-500 text-white",
    error: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
  };

  const Icon = (() => {
    switch (state) {
      case "recording":
      case "ready":
      case "idle":
        return Mic;
      case "transcribing":
        return Loader2;
      case "parsing":
        return Sparkles;
      case "speaking":
        return Volume2;
      case "error":
        return MicOff;
      default:
        return Mic;
    }
  })();

  const spinning = state === "transcribing";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={t(`mic.${state}`)}
      title={t(`mic.${state}`)}
      className={cn(
        "inline-flex items-center justify-center rounded-full shadow-sm transition-colors",
        sizeClass,
        palette[state],
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <Icon className={cn("h-5 w-5", spinning && "animate-spin")} />
    </button>
  );
}

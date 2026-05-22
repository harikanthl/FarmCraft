import type { FarmHealthScore } from "@/intelligence/healthScore";
import { Activity } from "lucide-react";

type Props = {
  score: FarmHealthScore | null;
  compact?: boolean;
};

function bandStyles(band: FarmHealthScore["band"]): string {
  switch (band) {
    case "good":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100";
    case "watch":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100";
    case "poor":
      return "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100";
  }
}

export function FarmHealthBadge({ score, compact }: Props) {
  if (!score) return null;
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs ${bandStyles(score.band)}`}
      title={`Plant ${score.breakdown.plantHealth} · Disease ${score.breakdown.disease} · Irrigation ${score.breakdown.irrigation} · Weather ${score.breakdown.weather}`}
    >
      <Activity className="h-3.5 w-3.5" aria-hidden />
      <span className="font-semibold">Health {score.score}/100</span>
      {!compact ? (
        <span className="text-[11px] opacity-80">
          P {score.breakdown.plantHealth} · D {score.breakdown.disease} · I {score.breakdown.irrigation} · W{" "}
          {score.breakdown.weather}
        </span>
      ) : null}
    </div>
  );
}

export function FarmHealthCard({ score }: { score: FarmHealthScore | null }) {
  if (!score) return null;
  return (
    <div className={`space-y-2 rounded-lg border p-3 text-xs ${bandStyles(score.band)}`}>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4" aria-hidden />
        <span className="text-sm font-semibold">Farm health {score.score}/100</span>
        <span className="ml-auto text-[11px] uppercase tracking-wide opacity-80">{score.band}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <dt className="opacity-70">Plant health</dt>
        <dd className="text-right font-medium">{score.breakdown.plantHealth}</dd>
        <dt className="opacity-70">Disease</dt>
        <dd className="text-right font-medium">{score.breakdown.disease}</dd>
        <dt className="opacity-70">Irrigation</dt>
        <dd className="text-right font-medium">{score.breakdown.irrigation}</dd>
        <dt className="opacity-70">Weather</dt>
        <dd className="text-right font-medium">{score.breakdown.weather}</dd>
      </dl>
      {score.notes.length > 0 ? (
        <ul className="list-disc pl-4 leading-snug opacity-90">
          {score.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

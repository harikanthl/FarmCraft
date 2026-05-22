import { askFarmQuestion, fetchFarmContextJson, summariseFarm } from "@/ai/client";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type Props = { farmId: string };

/** Compact assistant — pulls FarmContext from the worker, then runs summary / Q&A. */
export function FarmAssistantPanel({ farmId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState<"summary" | "qa" | null>(null);

  const runSummary = useCallback(async () => {
    setBusy("summary");
    try {
      const ctx = await fetchFarmContextJson(farmId);
      const { reply } = await summariseFarm(ctx);
      setSummary(reply || "(no summary)");
    } catch (e) {
      toast.error("Summary failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, [farmId]);

  const runQuestion = useCallback(async () => {
    if (!question.trim()) return;
    setBusy("qa");
    try {
      const ctx = await fetchFarmContextJson(farmId);
      const { reply } = await askFarmQuestion(question, ctx);
      setAnswer(reply || "(no answer)");
    } catch (e) {
      toast.error("Question failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, [farmId, question]);

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden />
        <span className="font-semibold">Farm assistant</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={busy != null}
          onClick={() => void runSummary()}
        >
          {busy === "summary" ? "Summarising…" : "Summarise"}
        </Button>
      </div>
      {summary ? (
        <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs leading-snug text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          {summary}
        </p>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this farm…"
          className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        />
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={busy != null || question.trim().length === 0}
          onClick={() => void runQuestion()}
        >
          {busy === "qa" ? "Asking…" : "Ask"}
        </Button>
      </div>
      {answer ? (
        <p className="whitespace-pre-wrap rounded bg-emerald-50 p-2 text-xs leading-snug text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
          {answer}
        </p>
      ) : null}
    </div>
  );
}

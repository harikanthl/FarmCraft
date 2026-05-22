import { EventEditorDialog } from "@/calendar/components/EventEditorDialog";
import { AUTH_TOKEN_KEY } from "@/auth/authClient";
import { Button } from "@/components/ui/button";
import type { FarmDotsDatabase } from "@/db/types";
import { farmEventTypeSchema } from "@farmdots/shared";
import type { FarmEventFormValues } from "@/forms/schemas";
import { useCallback, useEffect, useState } from "react";

export type InsightItem = {
  id: string;
  summary: string;
  type: string;
  severity?: string;
  generatedAt: number;
  payload?: Record<string, unknown>;
};

function insightToEventDraft(insight: InsightItem): Partial<FarmEventFormValues> {
  const typeParsed = farmEventTypeSchema.safeParse(insight.type);
  const type = typeParsed.success ? typeParsed.data : "crop_advisory";
  const desc =
    insight.payload && Object.keys(insight.payload).length > 0
      ? `${insight.summary}\n\n${JSON.stringify(insight.payload, null, 2)}`
      : insight.summary;
  return {
    title: insight.summary.slice(0, 200),
    type,
    description: desc.slice(0, 7900),
    status: "planned",
  };
}

export function InsightsFeed(props: { db: FarmDotsDatabase; farmId: string | null }) {
  const { db, farmId } = props;
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<FarmEventFormValues> | undefined>();

  const refresh = useCallback(async () => {
    if (!farmId) {
      setInsights([]);
      return;
    }
    const token = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    if (!token) {
      setInsights([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/farms/${encodeURIComponent(farmId)}/insights?since=${Date.now() - 120 * 86400_000}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { insights: InsightItem[] };
      setInsights(Array.isArray(body.insights) ? body.insights : []);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!farmId) return null;

  return (
    <section className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Insights
        </h2>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void refresh()}>
          Refresh
        </Button>
      </header>
      {loading ? (
        <p className="text-xs text-slate-500">Loading insights…</p>
      ) : insights.length === 0 ? (
        <p className="text-xs text-slate-500">No recent operational insights for this farm.</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {insights.slice(0, 12).map((ins) => (
            <li
              key={ins.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{ins.summary}</p>
                  <p className="mt-0.5 text-[10px] uppercase text-slate-500">
                    {ins.type.replace(/_/g, " ")}
                    {ins.severity ? ` · ${ins.severity}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 shrink-0 text-[10px]"
                  onClick={() => {
                    setDraft(insightToEventDraft(ins));
                    setDialogOpen(true);
                  }}
                >
                  Event
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EventEditorDialog
        db={db}
        farmId={farmId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={null}
        initialDraft={draft}
        onSaved={() => void refresh()}
      />
    </section>
  );
}

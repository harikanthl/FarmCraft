import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FarmDotsDatabase } from "@/db/types";
import { valveFormSchema, type ValveFormValues } from "@/forms/schemas";
import { nextOccurrenceStartMs } from "@/calendar/expandFarmEvents";
import type { FarmEvent } from "@farmdots/shared";
import type { Valve } from "@farmdots/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

type Props = {
  db: FarmDotsDatabase;
  valveId: string;
  farmId: string;
  onClose: () => void;
};

export function ValvePanel({ db, valveId, farmId, onClose }: Props) {
  const { t } = useTranslation("workspace");
  const [nextIrrigation, setNextIrrigation] = useState<string | null>(null);

  const form = useForm<ValveFormValues>({
    resolver: zodResolver(valveFormSchema),
    defaultValues: { name: "", status: "unknown" },
  });

  useEffect(() => {
    const sub = db.valves.findOne(valveId).$.subscribe((doc) => {
      if (!doc) return;
      const v = doc.toJSON() as Valve;
      form.reset({ name: v.name, status: v.status });
    });
    return () => sub.unsubscribe();
  }, [db, valveId, form]);

  useEffect(() => {
    const q = db.farm_events.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => {
      const now = Date.now();
      const candidates = docs
        .map((d) => d.toJSON() as FarmEvent)
        .filter(
          (ev) =>
            ev.type === "irrigation" &&
            (ev.valveIds?.includes(valveId) ?? false) &&
            ev.status !== "completed" &&
            ev.status !== "skipped",
        )
        .map((ev) => {
          const startMs = nextOccurrenceStartMs(ev, now);
          return startMs != null ? { ev, startMs } : null;
        })
        .filter((x): x is { ev: FarmEvent; startMs: number } => x != null)
        .sort((a, b) => a.startMs - b.startMs);
      const next = candidates[0];
      setNextIrrigation(
        next ? `${new Date(next.startMs).toLocaleString()} — ${next.ev.title}` : null,
      );
    });
    return () => sub.unsubscribe();
  }, [db, farmId, valveId]);

  async function onSubmit(values: ValveFormValues) {
    const doc = await db.valves.findOne(valveId).exec();
    if (!doc) return;
    const cur = doc.toJSON() as Valve;
    const now = Date.now();
    await doc.patch({
      name: values.name.trim(),
      status: values.status,
      updatedAt: now,
      version: cur.version + 1,
    });
  }

  return (
    <div className="flex max-h-[calc(100dvh-6rem)] flex-col gap-4 overflow-y-auto px-6 pb-8 pt-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("valve.label")}</div>
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{form.watch("name") || "…"}</div>
      </div>
      {nextIrrigation ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          {t("valve.nextIrrigation")} {nextIrrigation}
        </p>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("valve.noUpcoming")}</p>
      )}
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="valve-name">{t("valve.name")}</Label>
          <Input id="valve-name" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="valve-status">{t("valve.status")}</Label>
          <select
            id="valve-status"
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
            {...form.register("status")}
          >
            <option value="unknown">{t("valve.statusUnknown")}</option>
            <option value="open">{t("valve.statusOpen")}</option>
            <option value="closed">{t("valve.statusClosed")}</option>
            <option value="fault">{t("valve.statusFault")}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{t("valve.save")}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("valve.close")}
          </Button>
        </div>
      </form>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t("valve.farmIdHint")} <span className="font-mono">{farmId.slice(0, 8)}</span>… · {t("valve.valveIdHint")}{" "}
        <span className="font-mono">{valveId.slice(0, 8)}</span>…
      </p>
    </div>
  );
}

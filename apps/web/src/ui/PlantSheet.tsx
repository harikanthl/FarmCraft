import type { FarmDotsDatabase } from "@/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  diseaseQuickFormSchema,
  irrigationQuickFormSchema,
  plantMainFormSchema,
  type DiseaseQuickFormValues,
  type IrrigationQuickFormValues,
  type PlantMainFormValues,
} from "@/forms/schemas";
import { savePlantMainFields, savePlantMainFieldsForMany } from "@/plants/savePlantMainFields";
import { PlantMainFieldsForm } from "@/ui/PlantMainFieldsForm";
import type { DiseaseEvent, IrrigationEvent, Plant, Row, Valve } from "@farmdots/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Props = {
  db: FarmDotsDatabase;
  farmId: string;
  plantId: string | null;
  onClose: () => void;
  layout?: "overlay" | "panel";
};

export function PlantSheet({ db, farmId, plantId, onClose, layout = "overlay" }: Props) {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [valvesForRow, setValvesForRow] = useState<Valve[]>([]);
  const [diseases, setDiseases] = useState<DiseaseEvent[]>([]);
  const [irrigation, setIrrigation] = useState<IrrigationEvent[]>([]);
  const [farmValves, setFarmValves] = useState<Valve[]>([]);
  const [otherPlants, setOtherPlants] = useState<{ id: string; label: string }[]>([]);
  const [replicateIds, setReplicateIds] = useState<Set<string>>(() => new Set());
  const [replicateBusy, setReplicateBusy] = useState(false);

  const [irrigationValveId, setIrrigationValveId] = useState("");

  const mainForm = useForm<PlantMainFormValues>({
    resolver: zodResolver(plantMainFormSchema),
    defaultValues: {
      yearlyYield: "",
      wateringIssues: "",
      diseaseIssues: "",
      dripIssues: "",
      notes: "",
    },
  });

  const diseaseForm = useForm<DiseaseQuickFormValues>({
    resolver: zodResolver(diseaseQuickFormSchema),
    defaultValues: {
      diseaseType: "",
      severity: "low",
      treatment: "",
      notes: "",
    },
  });

  const irrForm = useForm<IrrigationQuickFormValues>({
    resolver: zodResolver(irrigationQuickFormSchema),
    defaultValues: { irrigationIssue: "", irrigationNotes: "" },
  });

  useEffect(() => {
    if (!plantId) {
      setPlant(null);
      return;
    }
    const sub = db.plants.findOne(plantId).$.subscribe((doc) => {
      if (!doc) {
        setPlant(null);
        return;
      }
      const p = doc.toMutableJSON() as Plant;
      setPlant(p);
      mainForm.reset({
        yearlyYield: p.yearlyYield != null ? String(p.yearlyYield) : "",
        wateringIssues: p.wateringIssues ?? "",
        diseaseIssues: p.diseaseIssues ?? "",
        dripIssues: p.dripIssues ?? "",
        notes: p.notes ?? "",
      });
    });
    return () => sub.unsubscribe();
  }, [db, plantId, mainForm]);

  useEffect(() => {
    if (!farmId || !plantId) {
      setOtherPlants([]);
      setReplicateIds(new Set());
      return;
    }
    const q = db.plants.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => {
      const list = docs
        .map((d) => d.toMutableJSON() as Plant)
        .filter((p) => p.id !== plantId)
        .map((p) => ({ id: p.id, label: p.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOtherPlants(list);
      setReplicateIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (list.some((p) => p.id === id)) next.add(id);
        }
        return next;
      });
    });
    return () => sub.unsubscribe();
  }, [db, farmId, plantId]);

  useEffect(() => {
    if (!farmId) {
      setFarmValves([]);
      return;
    }
    const q = db.valves.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => {
      const list = docs.map((d) => d.toJSON() as Valve);
      setFarmValves(list);
      setIrrigationValveId((prev) =>
        prev && list.some((v) => v.id === prev) ? prev : (list[0]?.id ?? ""),
      );
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  useEffect(() => {
    if (!plant?.rowId) {
      setRow(null);
      return;
    }
    const sub = db.rows.findOne(plant.rowId).$.subscribe((doc) => {
      setRow(doc ? (doc.toJSON() as Row) : null);
    });
    return () => sub.unsubscribe();
  }, [db, plant?.rowId]);

  useEffect(() => {
    if (!farmId || !row) {
      setValvesForRow([]);
      return;
    }
    const q = db.valves.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => {
      const all = docs.map((d) => d.toJSON() as Valve);
      setValvesForRow(all.filter((v) => row.valveIds.includes(v.id)));
    });
    return () => sub.unsubscribe();
  }, [db, farmId, row]);

  useEffect(() => {
    if (!plantId) return;
    const q = db.disease_events.find({ selector: { plantId } });
    const sub = q.$.subscribe((docs) => {
      setDiseases(docs.map((d) => d.toJSON() as DiseaseEvent));
    });
    return () => sub.unsubscribe();
  }, [db, plantId]);

  useEffect(() => {
    if (!farmId || !row) {
      setIrrigation([]);
      return;
    }
    const valveIds = new Set(row.valveIds);
    const q = db.irrigation_events.find({ selector: { farmId } });
    const sub = q.$.subscribe((docs) => {
      const list = docs
        .map((d) => d.toJSON() as IrrigationEvent)
        .filter((e) => valveIds.has(e.valveId));
      setIrrigation(list);
    });
    return () => sub.unsubscribe();
  }, [db, farmId, row]);

  const toggleReplicate = useCallback((id: string) => {
    setReplicateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOthers = useCallback(() => {
    setReplicateIds(new Set(otherPlants.map((p) => p.id)));
  }, [otherPlants]);

  const clearReplicate = useCallback(() => setReplicateIds(new Set()), []);

  const onSavePlant = mainForm.handleSubmit(async (data) => {
    if (!plantId) return;
    try {
      await savePlantMainFields(db, plantId, data);
      toast.success("Plant details saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save plant.");
    }
  });

  const onReplicateToOthers = useCallback(async () => {
    if (!plantId) return;
    const ids = [...replicateIds];
    if (ids.length === 0) {
      toast.message("Select at least one other plant to copy these values to.");
      return;
    }
    const data = mainForm.getValues();
    const yieldStr = (data.yearlyYield ?? "").trim();
    if (yieldStr !== "") {
      const n = Number(yieldStr);
      if (!Number.isFinite(n)) {
        toast.error("Yearly yield must be a number.");
        return;
      }
    }
    setReplicateBusy(true);
    try {
      await savePlantMainFields(db, plantId, data);
      const { succeeded, failed } = await savePlantMainFieldsForMany(db, ids, data);
      if (failed.length === 0) {
        toast.success(`Saved this plant and updated ${succeeded.length} other plant${succeeded.length === 1 ? "" : "s"}.`);
        setReplicateIds(new Set());
        return;
      }
      toast.warning(`Saved this plant. Updated ${succeeded.length} others; ${failed.length} failed.`);
      setReplicateIds(new Set(failed.map((f) => f.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save or replicate.");
    } finally {
      setReplicateBusy(false);
    }
  }, [db, plantId, mainForm, replicateIds]);

  const onAddDisease = diseaseForm.handleSubmit(async (d) => {
    if (!plantId) return;
    const ev: DiseaseEvent = {
      id: crypto.randomUUID(),
      plantId,
      diseaseType: d.diseaseType.trim(),
      severity: d.severity,
      treatment: d.treatment || undefined,
      notes: d.notes || undefined,
      createdAt: Date.now(),
    };
    await db.disease_events.insert(ev);
    diseaseForm.reset({ diseaseType: "", severity: "low", treatment: "", notes: "" });
    toast.success("Disease event logged.");
  });

  const onAddIrrigationEvent = irrForm.handleSubmit(async (i) => {
    if (!irrigationValveId) return;
    const ev: IrrigationEvent = {
      id: crypto.randomUUID(),
      valveId: irrigationValveId,
      farmId,
      startedAt: Date.now(),
      issue: i.irrigationIssue || undefined,
      notes: i.irrigationNotes || undefined,
    };
    await db.irrigation_events.insert(ev);
    irrForm.reset({ irrigationIssue: "", irrigationNotes: "" });
    toast.success("Irrigation event logged.");
  });

  const replicateDisabled = useMemo(
    () => replicateIds.size === 0 || replicateBusy || mainForm.formState.isSubmitting,
    [replicateIds.size, replicateBusy, mainForm.formState.isSubmitting],
  );

  if (!plantId || !plant) return null;

  const shell =
    layout === "panel"
      ? "relative flex max-h-[calc(100dvh-6rem)] flex-col overflow-y-auto border-0 bg-white shadow-none dark:bg-slate-950"
      : "fixed inset-x-0 bottom-0 z-[500] max-h-[75vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950";

  return (
    <div className={shell}>
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Plant</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{plant.label}</div>
        </div>
        <button
          type="button"
          className="rounded-full px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="space-y-4 px-4 py-4">
        <form className="space-y-4" onSubmit={(e) => void onSavePlant(e)}>
          <PlantMainFieldsForm form={mainForm} idPrefix="sheet-plant" />
          <Button type="submit" className="w-full rounded-xl py-3" disabled={mainForm.formState.isSubmitting}>
            {mainForm.formState.isSubmitting ? "Saving…" : "Save plant"}
          </Button>
        </form>

        {otherPlants.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">Copy these field values to other plants</div>
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
              Saves this plant with the values above, then writes the same fields to every ticked plant (yield, issues, notes,
              health status).
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllOthers}>
                Select all ({otherPlants.length})
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearReplicate}>
                Clear selection
              </Button>
            </div>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-950">
              {otherPlants.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300"
                    checked={replicateIds.has(p.id)}
                    onChange={() => toggleReplicate(p.id)}
                    id={`rep-${p.id}`}
                  />
                  <label htmlFor={`rep-${p.id}`} className="cursor-pointer select-none">
                    {p.label}
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full"
              disabled={replicateDisabled}
              onClick={() => void onReplicateToOthers()}
            >
              {replicateBusy ? "Applying…" : `Save & apply to ${replicateIds.size} other plant${replicateIds.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 font-medium text-slate-800 dark:text-slate-200">Disease events</div>
          <div className="space-y-2">
            {diseases.map((d) => (
              <div key={d.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                <div className="font-medium">{d.diseaseType}</div>
                <div className="text-slate-600 dark:text-slate-400">{d.severity}</div>
              </div>
            ))}
          </div>
          <form className="mt-3 grid gap-2" onSubmit={(e) => void onAddDisease(e)}>
            <Input placeholder="Disease type" {...diseaseForm.register("diseaseType")} />
            {diseaseForm.formState.errors.diseaseType ? (
              <p className="text-xs text-red-600">{diseaseForm.formState.errors.diseaseType.message}</p>
            ) : null}
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              {...diseaseForm.register("severity")}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <Input placeholder="Treatment (optional)" {...diseaseForm.register("treatment")} />
            <Input placeholder="Notes (optional)" {...diseaseForm.register("notes")} />
            <Button type="submit" variant="secondary" className="w-full">
              Add disease event
            </Button>
          </form>
        </div>

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 font-medium text-slate-800 dark:text-slate-200">
            Irrigation (row valves: {valvesForRow.map((v) => v.name).join(", ") || "none"})
          </div>
          {farmValves.length > 0 ? (
            <form className="mb-4 grid gap-2 rounded-lg border border-slate-100 p-3 dark:border-slate-800" onSubmit={(e) => void onAddIrrigationEvent(e)}>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={irrigationValveId}
                onChange={(e) => setIrrigationValveId(e.target.value)}
              >
                {farmValves.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <Input placeholder="Issue (optional)" {...irrForm.register("irrigationIssue")} />
              <Input placeholder="Notes (optional)" {...irrForm.register("irrigationNotes")} />
              <Button type="submit" variant="secondary" className="w-full bg-sky-700 text-white hover:bg-sky-800">
                Log irrigation event
              </Button>
            </form>
          ) : (
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Link valves to this plant&apos;s row to log irrigation.
            </p>
          )}
          {irrigation.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No irrigation events for linked valves.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {irrigation.map((e) => (
                <li key={e.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                  <div>{new Date(e.startedAt).toLocaleString()}</div>
                  {e.issue ? <div className="text-amber-800 dark:text-amber-400">{e.issue}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

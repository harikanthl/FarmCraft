import { completeFarmEvent } from "@/calendar/completeFarmEvent";
import { datetimeLocalToMs, msToDatetimeLocal } from "@/calendar/dateTimeLocal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FarmDotsDatabase } from "@/db/types";
import { farmEventFormSchema, type FarmEventFormValues } from "@/forms/schemas";
import type { FarmEvent } from "@farmdots/shared";
import { farmEventTypeSchema } from "@farmdots/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const EVENT_TYPE_OPTIONS = farmEventTypeSchema.options;

type Props = {
  db: FarmDotsDatabase;
  farmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing doc id when editing; omit for create. */
  editingId: string | null;
  /** Default window when creating (optional). */
  defaultRange?: { startMs: number; endMs: number } | null;
  onSaved?: () => void;
  /** Prefilled fields when creating from insights / automation. */
  initialDraft?: Partial<FarmEventFormValues>;
};

export function EventEditorDialog(props: Props) {
  const { db, farmId, open, onOpenChange, editingId, defaultRange, onSaved, initialDraft } = props;

  const form = useForm<FarmEventFormValues>({
    resolver: zodResolver(farmEventFormSchema),
    defaultValues: {
      title: "",
      type: "irrigation",
      description: "",
      startLocal: msToDatetimeLocal(Date.now()),
      endLocal: msToDatetimeLocal(Date.now() + 3600_000),
      allDay: false,
      recurrenceRule: "",
      valveIds: [],
      rowIds: [],
      status: "planned",
    },
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void (async () => {
      if (editingId) {
        const doc = await db.farm_events.findOne(editingId).exec();
        if (cancelled || !doc) return;
        const ev = doc.toJSON() as FarmEvent;
        form.reset({
          title: ev.title,
          type: ev.type,
          description: ev.description ?? "",
          startLocal: msToDatetimeLocal(ev.start),
          endLocal: msToDatetimeLocal(ev.end),
          allDay: ev.allDay,
          recurrenceRule: ev.recurrenceRule ?? "",
          valveIds: ev.valveIds ?? [],
          rowIds: ev.rowIds ?? [],
          status: ev.status,
        });
        return;
      }

      const start = defaultRange?.startMs ?? Date.now();
      const end = defaultRange?.endMs ?? start + 3600_000;
      form.reset({
        title: "",
        type: "irrigation",
        description: "",
        startLocal: msToDatetimeLocal(start),
        endLocal: msToDatetimeLocal(end),
        allDay: false,
        recurrenceRule: "",
        valveIds: [],
        rowIds: [],
        status: "planned",
        ...initialDraft,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, editingId, defaultRange, db, form, initialDraft]);

  const valveIdsForm = form.watch("valveIds");
  const rowIdsForm = form.watch("rowIds");

  function toggleId(field: "valveIds" | "rowIds", id: string, on: boolean) {
    const cur = form.getValues(field);
    const set = new Set(cur);
    if (on) set.add(id);
    else set.delete(id);
    form.setValue(field, [...set], { shouldDirty: true });
  }

  async function onSubmit(values: FarmEventFormValues) {
    const start = datetimeLocalToMs(values.startLocal);
    const end = datetimeLocalToMs(values.endLocal);
    if (end <= start) {
      toast.error("End must be after start.");
      return;
    }

    const now = Date.now();
    const recurrenceRule = values.recurrenceRule?.trim() || undefined;

    if (editingId) {
      const doc = await db.farm_events.findOne(editingId).exec();
      if (!doc) return;
      const cur = doc.toJSON() as FarmEvent;
      await doc.patch({
        title: values.title.trim(),
        type: values.type,
        description: values.description?.trim() || undefined,
        start,
        end,
        allDay: values.allDay,
        recurrenceRule,
        valveIds: values.valveIds.length ? values.valveIds : undefined,
        rowIds: values.rowIds.length ? values.rowIds : undefined,
        status: values.status,
        updatedAt: now,
        version: cur.version + 1,
      });
      toast.success("Event updated.");
    } else {
      await db.farm_events.insert({
        id: crypto.randomUUID(),
        farmId,
        title: values.title.trim(),
        type: values.type,
        description: values.description?.trim() || undefined,
        start,
        end,
        allDay: values.allDay,
        recurrenceRule,
        valveIds: values.valveIds.length ? values.valveIds : undefined,
        rowIds: values.rowIds.length ? values.rowIds : undefined,
        status: values.status,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
      toast.success("Event created.");
    }

    onSaved?.();
    onOpenChange(false);
  }

  async function onDelete() {
    if (!editingId) return;
    const doc = await db.farm_events.findOne(editingId).exec();
    await doc?.remove();
    toast.success("Event removed.");
    onSaved?.();
    onOpenChange(false);
  }

  async function onComplete() {
    if (!editingId) return;
    const doc = await db.farm_events.findOne(editingId).exec();
    if (!doc) return;
    const ev = doc.toJSON() as FarmEvent;
    try {
      await completeFarmEvent(db, ev);
      toast.success("Marked complete.");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit operation" : "New operation"}</DialogTitle>
          <DialogDescription>
            Stored locally in RxDB and synced when you run cloud sync. RRULE is expanded on display only.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 py-2" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="fe-title">Title</Label>
            <Input id="fe-title" {...form.register("title")} />
            {form.formState.errors.title ? (
              <p className="text-xs text-red-600">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fe-type">Type</Label>
              <select
                id="fe-type"
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
                {...form.register("type")}
              >
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fe-status">Status</Label>
              <select
                id="fe-status"
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
                {...form.register("status")}
              >
                <option value="planned">planned</option>
                <option value="in_progress">in progress</option>
                <option value="completed">completed</option>
                <option value="skipped">skipped</option>
                <option value="missed">missed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input id="fe-allday" type="checkbox" {...form.register("allDay")} />
            <Label htmlFor="fe-allday" className="font-normal">
              All day
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fe-start">Start</Label>
              <Input id="fe-start" type="datetime-local" {...form.register("startLocal")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fe-end">End</Label>
              <Input id="fe-end" type="datetime-local" {...form.register("endLocal")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-rrule">Recurrence (RRULE, optional)</Label>
            <Input id="fe-rrule" placeholder="FREQ=DAILY or FREQ=WEEKLY;BYDAY=MO,WE" {...form.register("recurrenceRule")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fe-desc">Notes</Label>
            <textarea
              id="fe-desc"
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
              {...form.register("description")}
            />
          </div>

          <ValveRowPickers db={db} farmId={farmId} valveIds={valveIdsForm} rowIds={rowIdsForm} onToggle={toggleId} />

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {editingId ? (
                <>
                  <Button type="button" variant="destructive" onClick={() => void onDelete()}>
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onComplete()}
                    disabled={form.watch("status") === "completed"}
                  >
                    Mark complete
                  </Button>
                </>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ValveRowPickers(props: {
  db: FarmDotsDatabase;
  farmId: string;
  valveIds: string[];
  rowIds: string[];
  onToggle: (field: "valveIds" | "rowIds", id: string, on: boolean) => void;
}) {
  const { db, farmId } = props;
  const [valves, setValves] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const qV = db.valves.find({ selector: { farmId } });
    const qR = db.rows.find({ selector: { farmId } });
    const sV = qV.$.subscribe((docs) =>
      setValves(
        docs
          .map((d) => {
            const j = d.toJSON() as { id: string; name: string };
            return { id: j.id, name: j.name };
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );
    const sR = qR.$.subscribe((docs) =>
      setRows(
        docs
          .map((d) => {
            const j = d.toJSON() as { id: string; name: string };
            return { id: j.id, name: j.name };
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );
    return () => {
      sV.unsubscribe();
      sR.unsubscribe();
    };
  }, [db, farmId]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Valves</Label>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
          {valves.length === 0 ? (
            <p className="text-xs text-slate-500">No valves on this farm.</p>
          ) : (
            valves.map((v) => (
              <label key={v.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={props.valveIds.includes(v.id)}
                  onChange={(e) => props.onToggle("valveIds", v.id, e.target.checked)}
                />
                <span>{v.name}</span>
              </label>
            ))
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Rows</Label>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500">No rows on this farm.</p>
          ) : (
            rows.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={props.rowIds.includes(r.id)}
                  onChange={(e) => props.onToggle("rowIds", r.id, e.target.checked)}
                />
                <span>{r.name}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

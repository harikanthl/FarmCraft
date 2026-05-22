import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeoJsonPolygon } from "@farmdots/shared";
import { computeAutoRowCount, normalizeBearing, resolveRowBearingDeg } from "@/geo/grid";
import { gridFormSchema, type GridFormValues } from "@/forms/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bboxHint: { widthM: number; heightM: number } | null;
  /** Current plant dots used to infer row direction (“existing plants”). */
  plantPositionsForBearing?: { lng: number; lat: number }[];
  polygon: GeoJsonPolygon | null;
  /** Prefill row/plant spacing from farm primary crop profile when dialog opens. */
  suggestedSpacing?: { rowSpacingM: number; plantSpacingM: number } | null;
  /** Shown when suggested spacing is applied (e.g. crop name). */
  suggestedSpacingLabel?: string | null;
  onGenerate: (values: GridFormValues) => void | Promise<void>;
};

const defaults: GridFormValues = {
  autoRowCount: true,
  rowCount: 5,
  bearingSource: "farmShape",
  bearingDeg: 0,
  rowSpacingM: 12,
  plantSpacingM: 10,
};

export function GridGenerateDialog({
  open,
  onOpenChange,
  bboxHint,
  plantPositionsForBearing = [],
  polygon,
  suggestedSpacing = null,
  suggestedSpacingLabel = null,
  onGenerate,
}: Props) {
  const plantHintCount = plantPositionsForBearing.length;
  const [busy, setBusy] = useState(false);

  const form = useForm<GridFormValues>({
    resolver: zodResolver(gridFormSchema),
    defaultValues: defaults,
  });

  const autoRowCount = form.watch("autoRowCount");
  const bearingSource = form.watch("bearingSource");
  const rowSpacingM = form.watch("rowSpacingM");
  const bearingDegManual = form.watch("bearingDeg");

  const preview = useMemo(() => {
    if (!polygon || !autoRowCount) return null;
    const bearing =
      bearingSource === "manual"
        ? normalizeBearing(Number(bearingDegManual) || 0)
        : resolveRowBearingDeg(
            bearingSource,
            bearingDegManual,
            polygon,
            plantPositionsForBearing,
          );
    try {
      const rows = computeAutoRowCount(polygon, bearing, Number(rowSpacingM) || 1);
      return { rows, bearing };
    } catch {
      return null;
    }
  }, [polygon, autoRowCount, bearingSource, bearingDegManual, rowSpacingM, plantPositionsForBearing]);

  useEffect(() => {
    if (!open) return;
    const preferPlants =
      plantPositionsForBearing.length >= 2 ? "existingPlants" : defaults.bearingSource;
    const spacing =
      suggestedSpacing != null
        ? {
            rowSpacingM: suggestedSpacing.rowSpacingM,
            plantSpacingM: suggestedSpacing.plantSpacingM,
          }
        : { rowSpacingM: defaults.rowSpacingM, plantSpacingM: defaults.plantSpacingM };
    form.reset({
      ...defaults,
      ...spacing,
      bearingSource: preferPlants,
    });
  }, [open, form.reset, plantPositionsForBearing.length, suggestedSpacing, suggestedSpacing?.plantSpacingM, suggestedSpacing?.rowSpacingM]);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Fill farm with plants</DialogTitle>
          <DialogDescription>
            Set spacing between rows and between plants along each row. Row count can follow your farm footprint
            automatically, or you can fix it manually. This replaces existing rows and plants for this farm.
          </DialogDescription>
        </DialogHeader>
        {bboxHint ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Farm bbox ≈ {bboxHint.widthM.toFixed(0)} m × {bboxHint.heightM.toFixed(0)} m
          </p>
        ) : null}
        {suggestedSpacingLabel ? (
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Suggested spacing from crop profile: <strong>{suggestedSpacingLabel}</strong>
          </p>
        ) : null}
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (values) => {
            if (values.bearingSource === "existingPlants" && plantHintCount < 2) {
              form.setError("bearingSource", {
                message: "Place at least two plants (or pick another direction source).",
              });
              return;
            }
            setBusy(true);
            try {
              await onGenerate(values);
            } finally {
              setBusy(false);
            }
          })}
        >
          <div className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <input
              id="fc-auto-rows"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300"
              checked={autoRowCount}
              onChange={(e) => form.setValue("autoRowCount", e.target.checked, { shouldValidate: true })}
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor="fc-auto-rows" className="font-medium">
                Auto row count (fill whole farm)
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rows = farm width perpendicular to row direction ÷ row spacing (approx.).
              </p>
              {autoRowCount && preview ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  ≈ {preview.rows} rows at {Number(rowSpacingM).toFixed(1)} m apart (bearing ≈{" "}
                  {preview.bearing.toFixed(0)}°).
                </p>
              ) : null}
            </div>
          </div>

          {!autoRowCount ? (
            <div className="space-y-2">
              <Label htmlFor="fc-rows">Row count</Label>
              <Input id="fc-rows" type="number" min={1} {...form.register("rowCount")} />
              {form.formState.errors.rowCount ? (
                <p className="text-xs text-red-600">{form.formState.errors.rowCount.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="fc-bearing-src">Row direction</Label>
            <select
              id="fc-bearing-src"
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950"
              {...form.register("bearingSource")}
            >
              <option value="farmShape">From farm outline (longer bbox side)</option>
              <option value="existingPlants" disabled={plantHintCount < 2}>
                From existing plants ({plantHintCount} placed{plantHintCount < 2 ? " — need ≥2" : ""})
              </option>
              <option value="manual">Manual bearing (degrees from north)</option>
            </select>
            {form.formState.errors.bearingSource ? (
              <p className="text-xs text-red-600">{form.formState.errors.bearingSource.message}</p>
            ) : null}
          </div>

          {bearingSource === "manual" ? (
            <div className="space-y-2">
              <Label htmlFor="fc-bearing">Bearing (° clockwise from north)</Label>
              <Input id="fc-bearing" type="number" step={1} {...form.register("bearingDeg")} />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fc-row-sp">Space between rows (m)</Label>
              <Input id="fc-row-sp" type="number" min={0.5} step={0.5} {...form.register("rowSpacingM")} />
              {form.formState.errors.rowSpacingM ? (
                <p className="text-xs text-red-600">{form.formState.errors.rowSpacingM.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fc-plant-sp">Space between plants along row (m)</Label>
              <Input id="fc-plant-sp" type="number" min={0.5} step={0.5} {...form.register("plantSpacingM")} />
              {form.formState.errors.plantSpacingM ? (
                <p className="text-xs text-red-600">{form.formState.errors.plantSpacingM.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Generating…" : "Generate plants"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

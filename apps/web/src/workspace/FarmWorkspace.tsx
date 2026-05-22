import { farmFromDoc } from "@/db/adapters";
import type { FarmDotsDatabase } from "@/db/types";
import { replaceFarmRowsAndPlants } from "@/db/replaceFarmGrid";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { GridFormValues } from "@/forms/schemas";
import { bboxSizeMeters, buildGridFromWizard } from "@/geo/grid";
import { GridGenerateDialog } from "@/pages/GridGenerateDialog";
import { WeatherStrip } from "@/weather/WeatherStrip";
import { computeFarmPolygonMetrics } from "@/geo/farmMetrics";
import { FarmHealthBadge } from "@/intelligence/FarmHealthBadge";
import { useFarmHealthScore } from "@/intelligence/useFarmHealthScore";
import { useSpatialBands } from "@/intelligence/useSpatialBands";
import type { SpatialOverlayMode } from "@/intelligence/spatialAggregates";
import { useCropProfiles } from "@/crops/useCropProfiles";
import { gridSpacingFromCropProfile } from "@farmdots/crop-profiles";
import { PlantSheet } from "@/ui/PlantSheet";
import { BulkPlantDetailsDialog } from "@/ui/BulkPlantDetailsDialog";
import { useCalendarSpatialHighlights } from "@/calendar/hooks/useCalendarSpatialHighlights";
import { FarmWorkspaceCanvas } from "@/workspace/FarmWorkspaceCanvas";
import type { WorkspaceTool } from "@/workspace/WorkspaceToolbar";
import { WorkspaceSidebar } from "@/workspace/WorkspaceSidebar";
import { WorkspaceToolbar } from "@/workspace/WorkspaceToolbar";
import { ValvePanel } from "@/workspace/ValvePanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ClarificationModal } from "@/voice/components/ClarificationModal";
import { MicButton } from "@/voice/components/MicButton";
import { VoiceDraftCard } from "@/voice/components/VoiceDraftCard";
import { VoiceTranscriptStrip } from "@/voice/components/VoiceTranscriptStrip";
import { useVoiceStore } from "@/voice/useVoiceStore";
import { useVoiceWorkflow } from "@/voice/useVoiceWorkflow";
import type { Farm, Plant } from "@farmdots/shared";
import { ArrowLeft, CalendarDays, LayoutGrid, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";

export function FarmWorkspace(props: { db: FarmDotsDatabase }) {
  const { farmId } = useParams<{ farmId: string }>();
  const { t } = useTranslation(["common", "workspace"]);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<WorkspaceTool>("select");
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [selectedValveIds, setSelectedValveIds] = useState<string[]>([]);
  const [showFillFarm, setShowFillFarm] = useState(false);
  const [fillBboxHint, setFillBboxHint] = useState<{ widthM: number; heightM: number } | null>(null);
  const [fillPlantPositions, setFillPlantPositions] = useState<{ lng: number; lat: number }[]>([]);
  const [bulkPlantFieldsOpen, setBulkPlantFieldsOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<SpatialOverlayMode>("off");
  const spatial = useSpatialBands({ db: props.db, farmId: farmId ?? null, mode: overlayMode });
  const voice = useVoiceWorkflow(props.db);
  const setVoiceSelection = useVoiceStore((s) => s.setSelection);
  const { getCropProfile } = useCropProfiles();

  async function handleFillFarm(values: GridFormValues) {
    const f = farm;
    if (!f) return;
    const now = Date.now();
    const { rows, plants, bearingUsedDeg, rowCountUsed } = buildGridFromWizard({
      farmId: f.id,
      polygon: f.polygon,
      autoRowCount: values.autoRowCount,
      rowCountManual: values.rowCount,
      bearingSource: values.bearingSource,
      bearingDegManual: values.bearingDeg,
      rowSpacingM: values.rowSpacingM,
      plantSpacingM: values.plantSpacingM,
      plantPositionsHint: fillPlantPositions,
      now,
    });
    try {
      await replaceFarmRowsAndPlants(props.db, f.id, rows, plants);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t("common:toasts.gridReplaceFailed"));
      return;
    }
    setShowFillFarm(false);
    setSelectedPlantIds([]);
    setSelectedValveIds([]);
    toast.success(
      t("common:toasts.gridFilled", {
        plants: plants.length,
        rows: rows.length,
        rowMode: values.autoRowCount
          ? t("common:toasts.gridFilledRowsAuto", { count: rowCountUsed })
          : t("common:toasts.gridFilledRowsManual"),
        bearing: bearingUsedDeg.toFixed(0),
      }),
    );
  }

  useEffect(() => {
    if (!showFillFarm || !farm) {
      setFillBboxHint(null);
      setFillPlantPositions([]);
      return;
    }
    setFillBboxHint(bboxSizeMeters(farm.polygon));
    let cancelled = false;
    void (async () => {
      const docs = await props.db.plants.find({ selector: { farmId: farm.id } }).exec();
      if (cancelled) return;
      setFillPlantPositions(
        docs.map((d) => {
          const j = d.toJSON() as Plant;
          return { lng: j.lng, lat: j.lat };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [showFillFarm, farm, props.db]);

  useEffect(() => {
    if (!props.db || !farmId) return;
    setLoading(true);
    const sub = props.db.farms.findOne(farmId).$.subscribe((doc) => {
      if (!doc) {
        setFarm(null);
        setLoading(false);
        return;
      }
      try {
        const farmJson = doc.toJSON() as import("@/db/adapters").FarmDocument;
        setFarm(farmFromDoc(farmJson));
      } catch {
        setFarm(null);
      }
      setLoading(false);
    });
    return () => sub.unsubscribe();
  }, [props.db, farmId]);

  useEffect(() => {
    setSelectedPlantIds([]);
    setSelectedValveIds([]);
    setTool("select");
  }, [farmId]);

  useEffect(() => {
    setVoiceSelection({
      farmId: farmId ?? null,
      selectedValveIds,
      selectedRowIds: [],
      selectedPlantIds,
    });
  }, [farmId, selectedPlantIds, selectedValveIds, setVoiceSelection]);

  const calendarHl = useCalendarSpatialHighlights(props.db, farmId ?? null);

  const cropGridHints = useMemo(() => {
    if (!farm) return { spacing: null as { rowSpacingM: number; plantSpacingM: number } | null, label: null as string | null };
    const prof = getCropProfile(farm.primaryCropId);
    if (!prof) return { spacing: null, label: null };
    return { spacing: gridSpacingFromCropProfile(prof), label: prof.name };
  }, [farm, getCropProfile]);

  const farmCentroid = useMemo(() => {
    if (!farm) return null;
    try {
      const m = computeFarmPolygonMetrics(farm.polygon);
      return { lat: m.centroidLat, lng: m.centroidLng };
    } catch {
      return null;
    }
  }, [farm]);

  const healthScore = useFarmHealthScore({ db: props.db, farmId: farm?.id ?? null, centroid: farmCentroid });

  if (!farmId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        {t("workspace:missingFarmId")}
      </div>
    );
  }

  if (loading && !farm) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        {t("workspace:loadingFarm")}
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        {t("common:farm.notFound")}
      </div>
    );
  }

  return (
    <>
      <div className="flex h-dvh flex-col bg-slate-50 dark:bg-slate-950">
        <header className="flex flex-none flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common:nav.map")}
          </Link>
          <Link
            to={`/farm/${farm.id}/calendar`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            <CalendarDays className="h-4 w-4" />
            {t("common:nav.calendar")}
          </Link>
          <Link
            to={`/farm/${farm.id}/sim`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            title={t("workspace:simHint")}
          >
            <Sparkles className="h-4 w-4" />
            {t("common:nav.sim")}
          </Link>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{t("common:nav.workspace")}</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">{farm.name}</span>
          <FarmHealthBadge score={healthScore} compact />

          {selectedPlantIds.length >= 2 && selectedValveIds.length === 0 ? (
            <Button type="button" variant="default" size="sm" className="shrink-0" onClick={() => setBulkPlantFieldsOpen(true)}>
              {t("workspace:editPlants", { count: selectedPlantIds.length })}
            </Button>
          ) : null}
          <label className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>{t("workspace:overlay.label")}</span>
            <select
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              value={overlayMode}
              onChange={(e) => setOverlayMode(e.target.value as SpatialOverlayMode)}
            >
              <option value="off">{t("workspace:overlay.off")}</option>
              <option value="yield">{t("workspace:overlay.yield")}</option>
              <option value="disease">{t("workspace:overlay.disease")}</option>
              <option value="irrigation">{t("workspace:overlay.irrigation")}</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setShowFillFarm(true)}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t("common:actions.fillFarm")}
          </Button>
          <LanguageSwitcher />
          <MicButton onToggle={voice.toggle} className="shrink-0" />
        </header>
        {voice.transcript || voice.draft ? (
          <div className="flex flex-none flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            {voice.transcript ? <VoiceTranscriptStrip className="max-w-2xl" /> : null}
            {voice.draft && voice.draft.kind !== "clarify" ? (
              <VoiceDraftCard
                draft={voice.draft}
                onConfirm={voice.confirmDraft}
                onDiscard={voice.discardDraft}
                className="max-w-2xl"
              />
            ) : null}
          </div>
        ) : null}
        {farmCentroid ? (
          <WeatherStrip
            lat={farmCentroid.lat}
            lng={farmCentroid.lng}
            primaryCropId={farm.primaryCropId ?? null}
            farmId={farm.id}
          />
        ) : null}
        <div className="flex min-h-0 flex-1 flex-row">
          <div className="relative min-h-0 min-w-0 flex-1">
            <WorkspaceToolbar tool={tool} onToolChange={setTool} />
            <FarmWorkspaceCanvas
              db={props.db}
              farm={farm}
              tool={tool}
              selectedPlantIds={selectedPlantIds}
              selectedValveIds={selectedValveIds}
              calendarHighlightValveIds={calendarHl.valveIds}
              calendarHighlightRowIds={calendarHl.rowIds}
              overlayRowBands={spatial.rowBands}
              overlayValveBands={spatial.valveBands}
              onSelectionChange={(plants, valves) => {
                setSelectedPlantIds(plants);
                setSelectedValveIds(valves);
              }}
            />
          </div>
          <WorkspaceSidebar db={props.db} farmId={farm.id} />
        </div>
      </div>

      <Sheet
        open={selectedPlantIds.length === 1 && selectedValveIds.length === 0}
        onOpenChange={(o) => !o && setSelectedPlantIds([])}
      >
        <SheetContent side="right" className="w-full max-w-md sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("workspace:sheets.plantDetails")}</SheetTitle>
          </SheetHeader>
          {selectedPlantIds.length === 1 ? (
            <PlantSheet
              db={props.db}
              farmId={farm.id}
              plantId={selectedPlantIds[0]!}
              onClose={() => setSelectedPlantIds([])}
              layout="panel"
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={selectedValveIds.length === 1 && selectedPlantIds.length === 0}
        onOpenChange={(o) => !o && setSelectedValveIds([])}
      >
        <SheetContent side="right" className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>{t("workspace:sheets.valveDetails")}</SheetTitle>
          </SheetHeader>
          {selectedValveIds.length === 1 ? (
            <ValvePanel
              db={props.db}
              valveId={selectedValveIds[0]!}
              farmId={farm.id}
              onClose={() => setSelectedValveIds([])}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <GridGenerateDialog
        open={showFillFarm}
        onOpenChange={setShowFillFarm}
        bboxHint={fillBboxHint}
        polygon={farm.polygon}
        plantPositionsForBearing={fillPlantPositions}
        suggestedSpacing={cropGridHints.spacing}
        suggestedSpacingLabel={cropGridHints.label}
        onGenerate={(values) => void handleFillFarm(values)}
      />

      <BulkPlantDetailsDialog
        db={props.db}
        open={bulkPlantFieldsOpen}
        onOpenChange={setBulkPlantFieldsOpen}
        farmName={farm.name}
        plantIds={selectedPlantIds}
        onApplied={() => setSelectedPlantIds([])}
      />

      <ClarificationModal
        draft={voice.draft}
        onSubmit={voice.submitClarification}
        onCancel={voice.discardDraft}
      />
    </>
  );
}

import type { FarmDocument } from "@/db/adapters";
import { farmFromDoc, farmToDoc } from "@/db/adapters";
import type { FarmDotsDatabase } from "@/db/types";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUnits } from "@/context/UnitsContext";
import { computeFarmPolygonMetrics, formatArea, formatLength } from "@/geo/farmMetrics";
import { deleteFarmCascade } from "@/db/deleteFarm";
import { replaceFarmRowsAndPlants } from "@/db/replaceFarmGrid";
import { farmNameFormSchema, type FarmNameFormValues, type GridFormValues } from "@/forms/schemas";
import { bboxSizeMeters, buildGridFromWizard } from "@/geo/grid";
import { reverseNominatim, searchNominatim } from "@/geo/nominatim";
import { FarmMap, type FlyToTarget, type MapInteractionMode } from "@/maps/FarmMap";
import { exportDiseaseCsv, exportIrrigationCsv, exportPlantsXlsx, exportRowsCsv } from "@/export/exporters";
import { TodayOperationsCard } from "@/calendar/components/TodayOperationsCard";
import { GridGenerateDialog } from "@/pages/GridGenerateDialog";
import { WeatherStrip } from "@/weather/WeatherStrip";
import { FarmHealthBadge } from "@/intelligence/FarmHealthBadge";
import { useFarmHealthScore } from "@/intelligence/useFarmHealthScore";
import { InsightsFeed } from "@/intelligence/InsightsFeed";
import { useCropProfiles } from "@/crops/useCropProfiles";
import {
  ACTIVE_THEMATIC_OVERLAY_IDS,
  thematicOverlayLabel,
  type ThematicOverlayId,
} from "@/maps/regionalOverlays";
import { gridSpacingFromCropProfile } from "@farmdots/crop-profiles";
import { refreshValveConnectionsForFarm } from "@/valves/syncConnectedRows";
import { PlantSheet } from "@/ui/PlantSheet";
import type { Farm, GeoJsonPolygon, Plant, Valve } from "@farmdots/shared";
import * as turf from "@turf/turf";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UnauthorizedError } from "@/sync/client";
import { AccountMenu } from "@/auth/AccountMenu";
import { useAuth } from "@/auth/AuthContext";
import { SyncStatusPill } from "@/sync/SyncStatusPill";
import { getSyncEngine } from "@/sync/SyncEngine";

const LOCAL_OWNER = "local";
const INSIGHTS_PANE_STORAGE_KEY = "farmdots-map-insights-open";

function readInsightsPaneOpen(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(INSIGHTS_PANE_STORAGE_KEY) !== "0";
}

type FarmNameUiState = { kind: "idle" } | { kind: "newFarm" } | { kind: "rename" };

function defaultNewFarmName() {
  return `Farm ${new Date().toLocaleDateString()}`;
}

export function GlobalMapPage(props: { db: FarmDotsDatabase }) {
  const { db } = props;
  const { t } = useTranslation(["common", "auth"]);
  const auth = useAuth();
  const { unitSystem, toggle: toggleUnits } = useUnits();
  const [farmsList, setFarmsList] = useState<{ id: string; name: string }[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [mode, setMode] = useState<MapInteractionMode>("idle");
  const [farmDrawPoints, setFarmDrawPoints] = useState<[number, number][]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridBboxHint, setGridBboxHint] = useState<{ widthM: number; heightM: number } | null>(null);
  const [gridFillPlantPositions, setGridFillPlantPositions] = useState<{ lng: number; lat: number }[]>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<{ lat: string; lon: string; display_name: string }[]>([]);
  const [detailFarm, setDetailFarm] = useState<Farm | null>(null);
  const [reversePlace, setReversePlace] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [farmNameUi, setFarmNameUi] = useState<FarmNameUiState>({ kind: "idle" });
  const pendingNewFarmPolygonRef = useRef<GeoJsonPolygon | null>(null);
  const { cropIds, getCropProfile } = useCropProfiles();
  const [thematicOverlay, setThematicOverlay] = useState<ThematicOverlayId>("off");
  const [insightsOpen, setInsightsOpen] = useState(readInsightsPaneOpen);

  const farmNameForm = useForm<FarmNameFormValues>({
    resolver: zodResolver(farmNameFormSchema),
    defaultValues: { name: "" },
  });

  const activeFarm = useMemo(() => farmsList.find((f) => f.id === activeFarmId) ?? null, [farmsList, activeFarmId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    localStorage.setItem(INSIGHTS_PANE_STORAGE_KEY, insightsOpen ? "1" : "0");
  }, [insightsOpen]);

  useEffect(() => {
    const id = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 220);
    return () => window.clearTimeout(id);
  }, [insightsOpen]);

  useEffect(() => {
    if (!activeFarmId) {
      setDetailFarm(null);
      return;
    }
    const sub = db.farms.findOne(activeFarmId).$.subscribe((doc) => {
      if (!doc) {
        setDetailFarm(null);
        return;
      }
      try {
        setDetailFarm(farmFromDoc(doc.toJSON() as FarmDocument));
      } catch {
        setDetailFarm(null);
      }
    });
    return () => sub.unsubscribe();
  }, [db, activeFarmId]);

  const farmMetrics = useMemo(() => {
    if (!detailFarm) return null;
    return computeFarmPolygonMetrics(detailFarm.polygon);
  }, [detailFarm]);

  const farmCentroid = useMemo(
    () => (farmMetrics ? { lat: farmMetrics.centroidLat, lng: farmMetrics.centroidLng } : null),
    [farmMetrics?.centroidLat, farmMetrics?.centroidLng],
  );

  const healthScore = useFarmHealthScore({ db, farmId: activeFarmId, centroid: farmCentroid });

  const cropGridHints = useMemo(() => {
    const prof = getCropProfile(detailFarm?.primaryCropId);
    if (!prof) return { spacing: null as { rowSpacingM: number; plantSpacingM: number } | null, label: null as string | null };
    return { spacing: gridSpacingFromCropProfile(prof), label: prof.name };
  }, [detailFarm?.primaryCropId, getCropProfile]);

  const setPrimaryCrop = useCallback(
    async (cropId: string) => {
      if (!activeFarmId) return;
      const doc = await db.farms.findOne(activeFarmId).exec();
      if (!doc) return;
      const j = doc.toJSON() as FarmDocument;
      const now = Date.now();
      const trimmed = cropId.trim();
      await doc.patch({
        primaryCropId: trimmed ? trimmed : undefined,
        updatedAt: now,
        version: j.version + 1,
      });
      const name = trimmed ? (getCropProfile(trimmed)?.name ?? trimmed) : null;
      toast.success(name ? t("toasts.primaryCropSet", { name }) : t("toasts.primaryCropCleared"));
    },
    [activeFarmId, db, getCropProfile, t],
  );

  useEffect(() => {
    if (!farmMetrics) {
      setReversePlace(null);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      void reverseNominatim(farmMetrics.centroidLat, farmMetrics.centroidLng).then((name) => {
        if (!cancelled && name) setReversePlace(name);
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [farmMetrics?.centroidLat, farmMetrics?.centroidLng]);

  const patchFarmPolygon = useCallback(
    async (polygon: GeoJsonPolygon) => {
      if (!activeFarmId) return;
      const doc = await db.farms.findOne(activeFarmId).exec();
      if (!doc) return;
      const j = doc.toJSON() as FarmDocument;
      await doc.patch({
        polygonJson: JSON.stringify(polygon),
        updatedAt: Date.now(),
        version: j.version + 1,
      });
      toast.success(t("toasts.boundaryUpdated"));
    },
    [activeFarmId, db, t],
  );

  useEffect(() => {
    if (!showGrid || !db || !activeFarmId) {
      setGridBboxHint(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const doc = await db.farms.findOne(activeFarmId).exec();
      if (!doc || cancelled) return;
      const farmJson = doc.toJSON() as import("@/db/adapters").FarmDocument;
      const farm = farmFromDoc(farmJson);
      setGridBboxHint(bboxSizeMeters(farm.polygon));
    })();
    return () => {
      cancelled = true;
    };
  }, [showGrid, db, activeFarmId]);

  useEffect(() => {
    if (!showGrid || !db || !activeFarmId) {
      setGridFillPlantPositions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const docs = await db.plants.find({ selector: { farmId: activeFarmId } }).exec();
      if (cancelled) return;
      setGridFillPlantPositions(
        docs.map((d) => {
          const j = d.toJSON() as Plant;
          return { lng: j.lng, lat: j.lat };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [showGrid, db, activeFarmId]);

  useEffect(() => {
    const q = db.farms.find({ selector: { ownerId: LOCAL_OWNER } });
    const sub = q.$.subscribe((docs) => {
      const list = docs
        .map((d) => {
          const j = d.toJSON() as FarmDocument;
          return { id: j.id, name: farmFromDoc(j).name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setFarmsList(list);
      setActiveFarmId((current) => {
        const ids = list.map((x) => x.id);
        if (current && ids.includes(current)) return current;
        return ids[0] ?? null;
      });
    });
    return () => sub.unsubscribe();
  }, [db]);

  const openNewFarmNameDialog = useCallback(
    (vertices: [number, number][]) => {
      if (vertices.length < 3) {
        toast.error(t("toasts.addThreeCorners"));
        return;
      }
      const ring = [...vertices, vertices[0]!];
      const polygon = { type: "Polygon" as const, coordinates: [ring] };
      const poly = turf.polygon([ring]);
      if (turf.area(poly) <= 0) {
        toast.error(t("toasts.outlineNoArea"));
        return;
      }
      pendingNewFarmPolygonRef.current = polygon;
      farmNameForm.reset({ name: defaultNewFarmName() });
      setFarmNameUi({ kind: "newFarm" });
    },
    [farmNameForm, t],
  );

  const cancelFarmNameDialog = useCallback(() => {
    const hadPendingNewFarm = pendingNewFarmPolygonRef.current != null;
    pendingNewFarmPolygonRef.current = null;
    if (hadPendingNewFarm) {
      setFarmDrawPoints([]);
      setMode("idle");
    }
    setFarmNameUi({ kind: "idle" });
    farmNameForm.reset({ name: "" });
  }, [farmNameForm]);

  const commitNewFarm = farmNameForm.handleSubmit(async (values) => {
    const polygon = pendingNewFarmPolygonRef.current;
    if (!polygon) return;
    const name = values.name.trim();
    const now = Date.now();
    const farm: Farm = {
      id: crypto.randomUUID(),
      ownerId: LOCAL_OWNER,
      name,
      polygon,
      irrigationType: "drip",
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await db.farms.insert(farmToDoc(farm));
    pendingNewFarmPolygonRef.current = null;
    setActiveFarmId(farm.id);
    setFarmDrawPoints([]);
    setMode("idle");
    setFarmNameUi({ kind: "idle" });
    farmNameForm.reset({ name: "" });
    toast.success(t("toasts.farmCreated", { name }));
  });

  const commitRenameFarm = farmNameForm.handleSubmit(async (values) => {
    if (!activeFarmId) return;
    const doc = await db.farms.findOne(activeFarmId).exec();
    if (!doc) return;
    const j = doc.toJSON() as FarmDocument;
    const name = values.name.trim();
    await doc.patch({
      name,
      updatedAt: Date.now(),
      version: j.version + 1,
    });
    setFarmNameUi({ kind: "idle" });
    farmNameForm.reset({ name: "" });
    toast.success(t("toasts.farmRenamed", { name }));
  });

  const openRenameFarmDialog = useCallback(() => {
    if (!activeFarm?.name) return;
    farmNameForm.reset({ name: activeFarm.name });
    setFarmNameUi({ kind: "rename" });
  }, [activeFarm?.name, farmNameForm]);

  const completeFarmDraw = useCallback(() => {
    openNewFarmNameDialog(farmDrawPoints as [number, number][]);
  }, [farmDrawPoints, openNewFarmNameDialog]);

  const cancelFarmDraw = useCallback(() => {
    setFarmDrawPoints([]);
    setMode("idle");
  }, []);

  const onFarmDrawPoint = useCallback((lng: number, lat: number) => {
    setFarmDrawPoints((prev) => [...prev, [lng, lat] as [number, number]]);
  }, []);

  const farmDrawPointsRef = useRef(farmDrawPoints);
  farmDrawPointsRef.current = farmDrawPoints;

  useEffect(() => {
    if (mode !== "drawFarm") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setFarmDrawPoints([]);
        setMode("idle");
      }
      if (e.key === "Enter" && farmDrawPointsRef.current.length >= 3) {
        e.preventDefault();
        openNewFarmNameDialog(farmDrawPointsRef.current as [number, number][]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, openNewFarmNameDialog]);

  const onPlaceValve = useCallback(
    async (lng: number, lat: number) => {
      if (!activeFarmId) return;
      const now = Date.now();
      const existing = await db.valves.find({ selector: { farmId: activeFarmId } }).exec();
      const valve: Valve = {
        id: crypto.randomUUID(),
        farmId: activeFarmId,
        name: `Valve ${existing.length + 1}`,
        lat,
        lng,
        connectedRows: [],
        status: "unknown",
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
      await db.valves.insert(valve);
      await refreshValveConnectionsForFarm(db, activeFarmId);
      setMode("idle");
    },
    [db, activeFarmId],
  );

  async function handleGridGenerate(values: GridFormValues) {
    if (!activeFarmId) return;
    const farmDoc = await db.farms.findOne(activeFarmId).exec();
    if (!farmDoc) return;
    const farmJson = farmDoc.toJSON() as import("@/db/adapters").FarmDocument;
    const farm = farmFromDoc(farmJson);
    const now = Date.now();
    const { rows, plants, bearingUsedDeg, rowCountUsed } = buildGridFromWizard({
      farmId: farm.id,
      polygon: farm.polygon,
      autoRowCount: values.autoRowCount,
      rowCountManual: values.rowCount,
      bearingSource: values.bearingSource,
      bearingDegManual: values.bearingDeg,
      rowSpacingM: values.rowSpacingM,
      plantSpacingM: values.plantSpacingM,
      plantPositionsHint: gridFillPlantPositions,
      now,
    });
    try {
      await replaceFarmRowsAndPlants(db, activeFarmId, rows, plants);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t("toasts.gridReplaceFailed"));
      return;
    }
    setShowGrid(false);
    toast.success(
      t("toasts.gridFilled", {
        plants: plants.length,
        rows: rows.length,
        rowMode: values.autoRowCount
          ? t("toasts.gridFilledRowsAuto", { count: rowCountUsed })
          : t("toasts.gridFilledRowsManual"),
        bearing: bearingUsedDeg.toFixed(0),
      }),
    );
  }

  async function runExport() {
    if (!activeFarmId) return;
    const plants = await db.plants.find({ selector: { farmId: activeFarmId } }).exec();
    const rows = await db.rows.find({ selector: { farmId: activeFarmId } }).exec();
    const irr = await db.irrigation_events.find({ selector: { farmId: activeFarmId } }).exec();
    const dis = await db.disease_events.find().exec();
    exportPlantsXlsx(plants.map((d) => d.toJSON() as import("@farmdots/shared").Plant));
    exportRowsCsv(rows.map((d) => d.toJSON() as import("@farmdots/shared").Row));
    exportIrrigationCsv(irr.map((d) => d.toJSON() as import("@farmdots/shared").IrrigationEvent));
    const plantIds = new Set(plants.map((p) => (p.toJSON() as { id: string }).id));
    exportDiseaseCsv(
      dis.map((d) => d.toJSON() as import("@farmdots/shared").DiseaseEvent).filter((x) => plantIds.has(x.plantId)),
    );
    toast.success(t("toasts.exportsDone"));
  }

  function flyToHit(hit: { lat: string; lon: string }) {
    setFlyTo({
      lat: Number.parseFloat(hit.lat),
      lng: Number.parseFloat(hit.lon),
      seq: Date.now(),
    });
    setSearchHits([]);
    setSearchError(null);
  }

  async function runPlaceSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchHits([]);
    try {
      const hits = await searchNominatim(q);
      if (hits.length === 0) {
        setSearchError(t("toasts.searchNoPlaces"));
        return;
      }
      setSearchHits(hits);
      if (hits.length === 1) flyToHit(hits[0]!);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : t("toasts.searchFailed"));
    } finally {
      setSearchLoading(false);
    }
  }

  function goToMyLocation() {
    if (!navigator.geolocation) {
      setSearchError(t("toasts.geoUnavailable"));
      return;
    }
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          seq: Date.now(),
        });
      },
      (err) => setSearchError(err.message),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }

  async function runDeleteActiveFarm() {
    if (!activeFarmId) return;
    const name = activeFarm?.name ?? "Farm";
    setDeleting(true);
    try {
      await deleteFarmCascade(db, activeFarmId);
      toast.success(t("toasts.farmDeleted", { name }));
      setActiveFarmId(null);
      setSelectedPlantId(null);
      setShowGrid(false);
      setDeleteOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("toasts.deleteFarmFailed");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function runSync() {
    try {
      if (!auth.isAuthed) {
        try {
          await auth.requireSignIn();
        } catch {
          return;
        }
      }
      await getSyncEngine(db).runOnce();
      setSyncMsg(t("toasts.syncedShort"));
      toast.success(t("toasts.syncedCloud"));
      setTimeout(() => setSyncMsg(null), 2500);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        toast.error(t("auth:errors.sessionExpired"));
        auth.openSignIn();
        return;
      }
      const msg = e instanceof Error ? e.message : t("toasts.syncFailed");
      setSyncMsg(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-none flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <span className="font-semibold text-emerald-900 dark:text-emerald-400">{t("mapPage.appBrand")}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="min-w-[10rem] justify-between gap-2 font-normal">
              <span className="truncate">{activeFarm?.name ?? t("farm.select")}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[min(60vh,320px)] overflow-y-auto">
            <DropdownMenuLabel>{t("farm.label")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {farmsList.map((f) => (
              <DropdownMenuItem key={f.id} onSelect={() => setActiveFarmId(f.id)}>
                <span className="truncate">{f.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!activeFarmId}
              onSelect={() => {
                openRenameFarmDialog();
              }}
            >
              <span className="flex items-center gap-2">
                <Pencil className="h-4 w-4 opacity-70" aria-hidden />
                {t("actions.renameFarm")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 border-slate-200 dark:border-slate-700"
          disabled={!activeFarmId}
          title={t("actions.renameFarm")}
          aria-label={t("actions.renameFarm")}
          onClick={() => openRenameFarmDialog()}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <div className="relative flex min-w-[12rem] flex-1 basis-[14rem] items-start gap-1 sm:max-w-md">
          <form className="flex w-full flex-col gap-1" onSubmit={(e) => void runPlaceSearch(e)}>
            <div className="flex gap-1">
              <input
                type="search"
                placeholder={t("search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-600"
              >
                {searchLoading ? "…" : t("search.go")}
              </button>
              <button
                type="button"
                title={t("search.myLocation")}
                aria-label={t("search.myLocation")}
                className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700"
                onClick={() => goToMyLocation()}
              >
                ⌖
              </button>
            </div>
            {searchError ? <p className="text-xs text-red-600">{searchError}</p> : null}
          </form>
          {searchHits.length > 1 ? (
            <ul className="absolute left-0 right-0 top-full z-[700] mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-950">
              {searchHits.map((h, i) => (
                <li key={`${h.display_name}-${i}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => flyToHit(h)}
                  >
                    {h.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Button
          type="button"
          className="inline-flex items-center gap-1.5"
          aria-label={t("actions.addFarm")}
          title={t("actions.addFarm")}
          onClick={() => {
            setMode("drawFarm");
            setFarmDrawPoints([]);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("actions.farm")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!activeFarmId}
          aria-label={t("actions.deleteFarm")}
          title={t("actions.deleteFarm")}
          onClick={() => setDeleteOpen(true)}
          className="inline-flex items-center gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {t("actions.farm")}
        </Button>
        {activeFarmId ? (
          <Button type="button" variant="secondary" asChild>
            <Link to={`/farm/${activeFarmId}/workspace`} className="inline-flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              {t("nav.workspace")}
            </Link>
          </Button>
        ) : null}
        {activeFarmId ? (
          <Button type="button" variant="secondary" asChild>
            <Link to={`/farm/${activeFarmId}/calendar`} className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {t("nav.calendar")}
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={!activeFarmId}
          className="inline-flex items-center gap-1.5"
          onClick={() => void runExport()}
        >
          <Download className="h-4 w-4" aria-hidden />
          {t("actions.export")}
        </Button>
        <SyncStatusPill db={db} />
        <Button type="button" variant="secondary" className="text-xs" onClick={() => toggleUnits()}>
          {t("units.format", {
            value: t(unitSystem === "metric" ? "units.metric" : "units.imperial"),
          })}
        </Button>
        <LanguageSwitcher />
        <AccountMenu />
        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          className="hidden text-xs text-slate-500 sm:inline"
          onClick={() => setCmdOpen(true)}
          title={t("mapPage.commandPalette")}
          aria-label={t("mapPage.commandPalette")}
        >
          ⌘K
        </Button>
        {syncMsg ? <span className="text-xs text-slate-600 dark:text-slate-400">{syncMsg}</span> : null}
        {mode === "drawFarm" ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>
              <Trans
                i18nKey="drawFarm.instruction"
                ns="common"
                components={[
                  <kbd key="enter" className="rounded border border-slate-300 px-1 font-mono dark:border-slate-600" />,
                  <kbd key="esc" className="rounded border border-slate-300 px-1 font-mono dark:border-slate-600" />,
                ]}
              />
            </span>
            <Button type="button" size="sm" variant="outline" disabled={farmDrawPoints.length === 0} onClick={() => setFarmDrawPoints((p) => p.slice(0, -1))}>
              {t("actions.undoPoint")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelFarmDraw}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" size="sm" disabled={farmDrawPoints.length < 3} onClick={completeFarmDraw}>
              {t("actions.done")}
            </Button>
          </span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">{mode === "placeValve" ? t("placeValve.instruction") : null}</span>
        )}
      </header>

      {detailFarm && farmMetrics ? (
        <div className="flex flex-none flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
          <span>
            {t("mapPage.area")}{" "}
            <strong>{formatArea(farmMetrics.areaM2, unitSystem)}</strong>
          </span>
          <span>
            {t("mapPage.perimeter")}{" "}
            <strong>{formatLength(farmMetrics.perimeterM, unitSystem)}</strong>
          </span>
          <span>
            {t("mapPage.centroid")}{" "}
            <strong>
              {farmMetrics.centroidLat.toFixed(5)}°, {farmMetrics.centroidLng.toFixed(5)}°
            </strong>
          </span>
          {reversePlace ? (
            <span className="max-w-xl truncate text-slate-600 dark:text-slate-400" title={reversePlace}>
              {reversePlace}
            </span>
          ) : (
            <span className="text-slate-400">{t("mapPage.reverseGeocoding")}</span>
          )}
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-slate-500 dark:text-slate-400">{t("mapPage.primaryCrop")}</span>
            <select
              className="max-w-[10rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
              value={detailFarm.primaryCropId ?? ""}
              onChange={(e) => void setPrimaryCrop(e.target.value)}
            >
              <option value="">{t("mapPage.cropNotSet")}</option>
              {cropIds.map((id) => (
                <option key={id} value={id}>
                  {getCropProfile(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <FarmHealthBadge score={healthScore} />
          <span className="flex min-w-0 flex-[1_1_280px] flex-wrap items-center gap-1 border-slate-200 pt-2 dark:border-slate-700 max-xl:w-full max-xl:border-t xl:border-l xl:border-slate-200 xl:pt-0 xl:pl-4 xl:dark:border-slate-700">
            <span className="shrink-0 text-slate-500 dark:text-slate-400">{t("mapPage.mapTint")}</span>
            <button
              type="button"
              className={`rounded px-2 py-0.5 font-medium ${thematicOverlay === "off" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              onClick={() => setThematicOverlay("off")}
            >
              {t("mapPage.overlayOff")}
            </button>
            {ACTIVE_THEMATIC_OVERLAY_IDS.map((oid) => (
              <button
                key={oid}
                type="button"
                className={`rounded px-2 py-0.5 font-medium ${thematicOverlay === oid ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                onClick={() => setThematicOverlay(oid)}
              >
                {thematicOverlayLabel(oid)}
              </button>
            ))}
          </span>
        </div>
      ) : null}

      {detailFarm && farmMetrics ? (
        <WeatherStrip
          lat={farmMetrics.centroidLat}
          lng={farmMetrics.centroidLng}
          primaryCropId={detailFarm.primaryCropId ?? null}
          farmId={detailFarm.id}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col xl:flex-row">
        {activeFarmId ? (
          <>
            <aside
              id="map-insights-pane"
              className={cn(
                "flex-none overflow-hidden border-slate-200 bg-white transition-[width,max-height] duration-200 ease-out dark:border-slate-800 dark:bg-slate-950",
                "border-b xl:border-b-0 xl:border-r",
                insightsOpen
                  ? "max-h-[min(42vh,22rem)] w-full xl:max-h-none xl:w-80 xl:max-w-[min(100vw,20rem)]"
                  : "max-h-0 w-full border-b-0 xl:w-0 xl:border-r-0",
              )}
              aria-hidden={!insightsOpen}
            >
              <div className="flex h-full w-full flex-col overflow-y-auto xl:w-80 xl:max-w-[min(100vw,20rem)]">
                <InsightsFeed db={db} farmId={activeFarmId} />
                <TodayOperationsCard db={db} farmId={activeFarmId} />
              </div>
            </aside>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "absolute z-30 h-11 w-8 rounded-r-lg border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900",
                "top-3 xl:top-1/2 xl:-translate-y-1/2",
                insightsOpen ? "left-0 xl:left-80 xl:-translate-x-full" : "left-0",
              )}
              onClick={() => setInsightsOpen((open) => !open)}
              aria-expanded={insightsOpen}
              aria-controls="map-insights-pane"
              title={insightsOpen ? t("mapPage.insightsPane.hide") : t("mapPage.insightsPane.show")}
              aria-label={insightsOpen ? t("mapPage.insightsPane.hide") : t("mapPage.insightsPane.show")}
            >
              {insightsOpen ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
            </Button>
          </>
        ) : null}
        <div className="relative min-h-0 min-h-[50vh] flex-1 min-w-0">
          <FarmMap
            db={db}
            activeFarmId={activeFarmId}
            mode={mode}
            farmDrawPoints={farmDrawPoints}
            onFarmDrawPoint={(lng, lat) => void onFarmDrawPoint(lng, lat)}
            onPlantTap={(id) => setSelectedPlantId(id)}
            onPlaceValve={(lng, lat) => void onPlaceValve(lng, lat)}
            onSelectFarm={(id) => setActiveFarmId(id)}
            flyTo={flyTo}
            enablePolygonEdit={Boolean(activeFarmId && detailFarm)}
            onFarmPolygonEdited={patchFarmPolygon}
            thematicOverlay={thematicOverlay}
          />
        </div>
      </div>

      <GridGenerateDialog
        open={showGrid}
        onOpenChange={setShowGrid}
        bboxHint={gridBboxHint}
        polygon={detailFarm?.polygon ?? null}
        plantPositionsForBearing={gridFillPlantPositions}
        suggestedSpacing={cropGridHints.spacing}
        suggestedSpacingLabel={cropGridHints.label}
        onGenerate={handleGridGenerate}
      />

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogs.deleteFarmTitle")}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="dialogs.deleteFarmBody"
                ns="common"
                values={{
                  name: activeFarm?.name ?? t("dialogs.deleteFarmThisFarm"),
                }}
                components={{ bold: <strong /> }}
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={deleting || !activeFarmId}
              onClick={() => void runDeleteActiveFarm()}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {deleting ? t("dialogs.deleting") : t("dialogs.deleteFarm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={farmNameUi.kind !== "idle"} onOpenChange={(open) => !open && cancelFarmNameDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{farmNameUi.kind === "rename" ? t("dialogs.renameFarmTitle") : t("dialogs.newFarmTitle")}</DialogTitle>
            <DialogDescription>
              {farmNameUi.kind === "rename" ? t("dialogs.renameFarmDescription") : t("dialogs.newFarmDescription")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (farmNameUi.kind === "rename") void commitRenameFarm(e);
              else void commitNewFarm(e);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="farm-name-input">{t("dialogs.farmNameLabel")}</Label>
              <Input
                id="farm-name-input"
                autoComplete="off"
                placeholder={farmNameUi.kind === "rename" ? undefined : defaultNewFarmName()}
                {...farmNameForm.register("name")}
              />
              {farmNameForm.formState.errors.name?.message ? (
                <p className="text-xs text-red-600">{farmNameForm.formState.errors.name.message}</p>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={cancelFarmNameDialog}>
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={farmNameForm.formState.isSubmitting || (farmNameUi.kind === "rename" && !activeFarmId)}
              >
                {farmNameForm.formState.isSubmitting
                  ? t("dialogs.saving")
                  : farmNameUi.kind === "rename"
                    ? t("dialogs.saveName")
                    : t("dialogs.createFarm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        farms={farmsList}
        activeFarmId={activeFarmId}
        onSelectFarm={(id) => setActiveFarmId(id)}
        onGenerateGrid={() => setShowGrid(true)}
        onExport={() => void runExport()}
        onSync={() => void runSync()}
        onAddFarm={() => {
          setMode("drawFarm");
          setFarmDrawPoints([]);
        }}
        onPlaceValve={() => setMode("placeValve")}
      />

      {activeFarmId ? (
        <PlantSheet
          db={db}
          farmId={activeFarmId}
          plantId={selectedPlantId}
          onClose={() => setSelectedPlantId(null)}
        />
      ) : null}
    </div>
  );
}

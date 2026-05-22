import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removePlantsByIds, removeValvesByIds } from "@/db/removeByIds";
import { refreshValveConnectionsForFarm } from "@/valves/syncConnectedRows";
import type { FarmDotsDatabase } from "@/db/types";
import { WorkspaceMapBackground } from "@/workspace/WorkspaceMapBackground";
import { rowGuidePolylinesFromPlants } from "@/workspace/rowGuides";
import { canvasToLngLat, lngLatToCanvas, polygonViewBox } from "@/workspace/geoTransform";
import type { WorkspaceTool } from "@/workspace/WorkspaceToolbar";
import { bandStroke, type RowBand, type ValveBand } from "@/intelligence/spatialAggregates";
import type { Farm, Plant, Row, Valve } from "@farmdots/shared";
import * as turf from "@turf/turf";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage } from "react-konva";
import { toast } from "sonner";

function circleIntersectsStageRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

type Props = {
  db: FarmDotsDatabase;
  farm: Farm;
  tool: WorkspaceTool;
  selectedPlantIds: string[];
  selectedValveIds: string[];
  /** Today’s calendar operation targets — spatial hints on the map. */
  calendarHighlightValveIds?: string[];
  calendarHighlightRowIds?: string[];
  /** Phase-2 spatial bands (yield / disease / irrigation). */
  overlayRowBands?: RowBand[];
  overlayValveBands?: ValveBand[];
  onSelectionChange: (plantIds: string[], valveIds: string[]) => void;
};

export function FarmWorkspaceCanvas(props: Props) {
  const {
    db,
    farm,
    tool,
    selectedPlantIds,
    selectedValveIds,
    calendarHighlightValveIds = [],
    calendarHighlightRowIds = [],
    overlayRowBands = [],
    overlayValveBands = [],
    onSelectionChange,
  } = props;

  const overlayRowMap = useMemo(() => {
    const m = new Map<string, RowBand>();
    for (const b of overlayRowBands) m.set(b.rowId, b);
    return m;
  }, [overlayRowBands]);

  const overlayValveMap = useMemo(() => {
    const m = new Map<string, ValveBand>();
    for (const b of overlayValveBands) m.set(b.valveId, b);
    return m;
  }, [overlayValveBands]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [plants, setPlants] = useState<Plant[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [groupPos, setGroupPos] = useState({ x: 0, y: 0 });
  const [groupScale, setGroupScale] = useState(1);
  const dragOriginRef = useRef<{ lng: number; lat: number } | null>(null);
  const plantsRef = useRef(plants);
  const valvesRef = useRef(valves);
  const groupPosRef = useRef(groupPos);
  const groupScaleRef = useRef(groupScale);
  plantsRef.current = plants;
  valvesRef.current = valves;
  groupPosRef.current = groupPos;
  groupScaleRef.current = groupScale;
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marqueeBoxRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "plant"; plant: Plant }
    | { kind: "valve"; valve: Valve }
    | { kind: "bulk"; plantIds: string[]; valveIds: string[] }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const selectedPlantSet = useMemo(() => new Set(selectedPlantIds), [selectedPlantIds]);
  const selectedValveSet = useMemo(() => new Set(selectedValveIds), [selectedValveIds]);
  const farmPlantIdSet = useMemo(() => new Set(plants.map((p) => p.id)), [plants]);

  const viewBox = useMemo(() => polygonViewBox(farm.polygon), [farm.polygon]);
  const padding = 32;

  const farmPoly = useMemo(() => turf.polygon(farm.polygon.coordinates), [farm.polygon.coordinates]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: Math.max(320, cr.width), height: Math.max(240, cr.height) });
    });
    ro.observe(el);
    setSize({ width: Math.max(320, el.clientWidth), height: Math.max(240, el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const qP = db.plants.find({ selector: { farmId: farm.id } });
    const qV = db.valves.find({ selector: { farmId: farm.id } });
    const qR = db.rows.find({ selector: { farmId: farm.id } });
    const subP = qP.$.subscribe((docs) => {
      setPlants(docs.map((d) => d.toJSON() as Plant));
    });
    const subV = qV.$.subscribe((docs) => {
      setValves(docs.map((d) => d.toJSON() as Valve));
    });
    const subR = qR.$.subscribe((docs) => {
      setRows(docs.map((d) => d.toJSON() as Row));
    });
    return () => {
      subP.unsubscribe();
      subV.unsubscribe();
      subR.unsubscribe();
    };
  }, [db, farm.id]);

  const project = useCallback(
    (lng: number, lat: number) => lngLatToCanvas(lng, lat, viewBox, size.width, size.height, padding),
    [padding, size.height, size.width, viewBox],
  );

  const toLngLatFromGroupPos = useCallback(
    (lx: number, ly: number) => canvasToLngLat(lx, ly, viewBox, size.width, size.height, padding),
    [padding, size.height, size.width, viewBox],
  );

  const ring = farm.polygon.coordinates[0] ?? [];

  const outlinePts = useMemo(() => {
    return ring.flatMap(([lng, lat]) => {
      const { x, y } = project(lng, lat);
      return [x, y];
    });
  }, [project, ring]);

  const rowGuideLines = useMemo(() => {
    const polylines = rowGuidePolylinesFromPlants(plants, rows);
    return polylines.map((g) => ({
      rowId: g.rowId,
      name: g.name,
      pts: g.positions.flatMap((pos) => {
        const { x, y } = project(pos.lng, pos.lat);
        return [x, y];
      }),
    }));
  }, [plants, rows, project]);

  const fit = useCallback(() => {
    setGroupScale(1);
    setGroupPos({ x: 0, y: 0 });
  }, []);

  const groupDraggable = tool === "pan";

  const defaultRowId = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.orderIndex - b.orderIndex);
    return sorted[0]?.id ?? null;
  }, [rows]);

  async function patchPlantPosition(p: Plant, lng: number, lat: number) {
    const doc = await db.plants.findOne(p.id).exec();
    if (!doc) return;
    const cur = doc.toJSON() as Plant;
    const now = Date.now();
    await doc.patch({
      lng,
      lat,
      updatedAt: now,
      version: cur.version + 1,
    });
  }

  async function patchValvePosition(v: Valve, lng: number, lat: number) {
    const doc = await db.valves.findOne(v.id).exec();
    if (!doc) return;
    const cur = doc.toJSON() as Valve;
    const now = Date.now();
    await doc.patch({
      lng,
      lat,
      updatedAt: now,
      version: cur.version + 1,
    });
    await refreshValveConnectionsForFarm(db, farm.id);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "bulk") {
        await Promise.all([
          removePlantsByIds(db, deleteTarget.plantIds, {
            farmId: farm.id,
            farmPlantIds: farmPlantIdSet,
          }),
          removeValvesByIds(db, deleteTarget.valveIds),
        ]);
        if (deleteTarget.valveIds.length > 0) await refreshValveConnectionsForFarm(db, farm.id);
        const pc = deleteTarget.plantIds.length;
        const vc = deleteTarget.valveIds.length;
        toast.success(`Removed ${pc} plant${pc === 1 ? "" : "s"} and ${vc} valve${vc === 1 ? "" : "s"}.`);
      } else if (deleteTarget.kind === "plant") {
        const doc = await db.plants.findOne(deleteTarget.plant.id).exec();
        await doc?.remove();
        toast.success(`Removed ${deleteTarget.plant.label}.`);
      } else {
        const doc = await db.valves.findOne(deleteTarget.valve.id).exec();
        await doc?.remove();
        await refreshValveConnectionsForFarm(db, farm.id);
        toast.success(`Removed ${deleteTarget.valve.name}.`);
      }
      setDeleteTarget(null);
      onSelectionChange([], []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete selection.");
    } finally {
      setDeleting(false);
    }
  }

  async function tryAddPlant(lng: number, lat: number) {
    if (!defaultRowId) {
      toast.error("Add rows first — use Fill farm / grid on the map or workspace.");
      return;
    }
    const pt = turf.point([lng, lat]);
    if (!turf.booleanPointInPolygon(pt, farmPoly)) {
      toast.error("Plant must be inside the farm boundary.");
      return;
    }
    const now = Date.now();
    const label = `Plant ${plants.length + 1}`;
    await db.plants.insert({
      id: crypto.randomUUID(),
      farmId: farm.id,
      rowId: defaultRowId,
      label,
      lat,
      lng,
      cropType: "unknown",
      healthStatus: "unknown",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    toast.success("Plant added.");
  }

  async function tryAddValve(lng: number, lat: number) {
    const pt = turf.point([lng, lat]);
    if (!turf.booleanPointInPolygon(pt, farmPoly)) {
      toast.error("Valve must be inside the farm boundary.");
      return;
    }
    const now = Date.now();
    const existing = valves.length;
    await db.valves.insert({
      id: crypto.randomUUID(),
      farmId: farm.id,
      name: `Valve ${existing + 1}`,
      lat,
      lng,
      connectedRows: [],
      status: "unknown",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    await refreshValveConnectionsForFarm(db, farm.id);
    toast.success("Valve added.");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (selectedPlantIds.length === 0 && selectedValveIds.length === 0) return;
      e.preventDefault();
      setDeleteTarget({
        kind: "bulk",
        plantIds: [...selectedPlantIds],
        valveIds: [...selectedValveIds],
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPlantIds, selectedValveIds]);

  function handleStageMouseDown(e: KonvaEventObject<MouseEvent>) {
    const targetClass = e.target.getClassName();
    if (targetClass === "Circle") return;

    const stage = e.target.getStage();
    if (!stage) return;

    if (tool === "select") {
      if (e.evt.button !== 0) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      e.evt.preventDefault();

      const box = { x1: pointer.x, y1: pointer.y, x2: pointer.x, y2: pointer.y };
      marqueeBoxRef.current = box;
      setMarquee({ ...box });

      const onMove = (pe: PointerEvent) => {
        const rect = stage.container().getBoundingClientRect();
        const x2 = pe.clientX - rect.left;
        const y2 = pe.clientY - rect.top;
        const b = marqueeBoxRef.current;
        if (!b) return;
        b.x2 = x2;
        b.y2 = y2;
        setMarquee({ ...b });
      };

      const finishMarquee = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finishMarquee);
        window.removeEventListener("pointercancel", finishMarquee);
        const b = marqueeBoxRef.current;
        marqueeBoxRef.current = null;
        setMarquee(null);
        if (!b) return;

        const w = Math.abs(b.x2 - b.x1);
        const h = Math.abs(b.y2 - b.y1);
        if (w < 4 && h < 4) {
          onSelectionChange([], []);
          return;
        }

        const rx = Math.min(b.x1, b.x2);
        const ry = Math.min(b.y1, b.y2);
        const rw = w;
        const rh = h;

        const gp = groupPosRef.current;
        const gs = groupScaleRef.current;
        const hitPlants: string[] = [];
        for (const p of plantsRef.current) {
          const { x, y } = project(p.lng, p.lat);
          const cx = gp.x + x * gs;
          const cy = gp.y + y * gs;
          const r = 7;
          if (circleIntersectsStageRect(cx, cy, r, rx, ry, rw, rh)) hitPlants.push(p.id);
        }
        const hitValves: string[] = [];
        for (const v of valvesRef.current) {
          const { x, y } = project(v.lng, v.lat);
          const cx = gp.x + x * gs;
          const cy = gp.y + y * gs;
          const r = 12;
          if (circleIntersectsStageRect(cx, cy, r, rx, ry, rw, rh)) hitValves.push(v.id);
        }
        onSelectionChange(hitPlants, hitValves);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finishMarquee);
      window.addEventListener("pointercancel", finishMarquee);
      return;
    }

    if (tool !== "addPlant" && tool !== "addValve") return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const lx = (pointer.x - groupPos.x) / groupScale;
    const ly = (pointer.y - groupPos.y) / groupScale;
    const { lng, lat } = toLngLatFromGroupPos(lx, ly);

    if (tool === "addPlant") void tryAddPlant(lng, lat);
    if (tool === "addValve") void tryAddValve(lng, lat);
  }

  const cursorClass =
    tool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : tool === "addPlant" || tool === "addValve"
        ? "cursor-crosshair"
        : tool === "delete"
          ? "cursor-not-allowed"
          : tool === "select" && marquee != null
        ? "cursor-crosshair"
        : "cursor-default";

  return (
    <>
      <div ref={wrapRef} className={`absolute inset-0 ${cursorClass}`}>
        <WorkspaceMapBackground
          polygon={farm.polygon}
          viewSync={{ viewBox, width: size.width, height: size.height, padding, groupPos, groupScale }}
        />
        <div className="relative z-[1] h-full w-full">
          <Stage
            width={size.width}
            height={size.height}
            onMouseDown={handleStageMouseDown}
            onWheel={(e) => {
              e.evt.preventDefault();
              const stage = e.target.getStage();
              if (!stage) return;
              const pointer = stage.getPointerPosition();
              if (!pointer) return;
              const direction = e.evt.deltaY > 0 ? -1 : 1;
              const factor = direction > 0 ? 1 / 1.08 : 1.08;
              const newScale = Math.min(6, Math.max(0.35, groupScale * factor));
              const wx = (pointer.x - groupPos.x) / groupScale;
              const wy = (pointer.y - groupPos.y) / groupScale;
              setGroupScale(newScale);
              setGroupPos({
                x: pointer.x - wx * newScale,
                y: pointer.y - wy * newScale,
              });
            }}
          >
            <Layer>
              <Group
                x={groupPos.x}
                y={groupPos.y}
                scaleX={groupScale}
                scaleY={groupScale}
                draggable={groupDraggable}
                onDragEnd={(ev) => setGroupPos({ x: ev.target.x(), y: ev.target.y() })}
              >
                {outlinePts.length >= 6 ? (
                  <Line
                    points={outlinePts}
                    closed
                    listening
                    stroke="#166534"
                    strokeWidth={2 / groupScale}
                    fill="rgba(22, 101, 52, 0.12)"
                  />
                ) : null}
                {rowGuideLines.map((g) => {
                  if (g.pts.length < 4) return null;
                  const calHit = calendarHighlightRowIds.includes(g.rowId);
                  const band = overlayRowMap.get(g.rowId);
                  const stroke = band
                    ? bandStroke(band.band)
                    : calHit
                      ? "#0ea5e9"
                      : "#64748b";
                  const width = (band ? 3 : calHit ? 3 : 1.25) / groupScale;
                  return (
                    <Line
                      key={g.rowId}
                      points={g.pts}
                      stroke={stroke}
                      strokeWidth={width}
                      dash={[6 / groupScale, 4 / groupScale]}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                      opacity={band ? 0.95 : 0.9}
                    />
                  );
                })}
                {plants.map((p) => {
                  const { x, y } = project(p.lng, p.lat);
                  const selected = selectedPlantSet.has(p.id);
                  const fill =
                    p.healthStatus === "healthy"
                      ? "#22c55e"
                      : p.healthStatus === "unknown"
                        ? "#94a3b8"
                        : "#f97316";
                  return (
                    <Circle
                      key={p.id}
                      x={x}
                      y={y}
                      radius={(selected ? 7 : 5) / groupScale}
                      fill={fill}
                      stroke={selected ? "#ca8a04" : "#14532d"}
                      strokeWidth={(selected ? 2.5 : 1) / groupScale}
                      draggable={tool === "select"}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                      }}
                      onDragStart={() => {
                        dragOriginRef.current = { lng: p.lng, lat: p.lat };
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const { lng, lat } = toLngLatFromGroupPos(node.x(), node.y());
                        const inside = turf.booleanPointInPolygon(turf.point([lng, lat]), farmPoly);
                        if (!inside) {
                          const o = dragOriginRef.current;
                          dragOriginRef.current = null;
                          if (o) {
                            const back = project(o.lng, o.lat);
                            node.position({ x: back.x, y: back.y });
                          }
                          toast.error("Keep plants inside the boundary.");
                          return;
                        }
                        dragOriginRef.current = null;
                        void patchPlantPosition(p, lng, lat);
                      }}
                      onClick={(e) => {
                        if (tool === "delete") {
                          setDeleteTarget({ kind: "plant", plant: p });
                          return;
                        }
                        if (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey) {
                          const set = new Set(selectedPlantIds);
                          if (set.has(p.id)) set.delete(p.id);
                          else set.add(p.id);
                          onSelectionChange([...set], selectedValveIds);
                          return;
                        }
                        onSelectionChange([p.id], []);
                      }}
                    />
                  );
                })}
                {valves.map((v) => {
                  const { x, y } = project(v.lng, v.lat);
                  const selected = selectedValveSet.has(v.id);
                  const cal = calendarHighlightValveIds.includes(v.id);
                  const vBand = overlayValveMap.get(v.id);
                  const vStroke = vBand
                    ? bandStroke(vBand.band)
                    : cal
                      ? "#22d3ee"
                      : selected
                        ? "#ca8a04"
                        : "#4c1d95";
                  return (
                    <Circle
                      key={v.id}
                      x={x}
                      y={y}
                      radius={(selected ? 10 : cal || vBand ? 9 : 8) / groupScale}
                      fill="#7c3aed"
                      stroke={vStroke}
                      strokeWidth={(vBand ? 3.5 : cal ? 3.5 : selected ? 2.5 : 1.5) / groupScale}
                      draggable={tool === "select"}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                      }}
                      onDragStart={() => {
                        dragOriginRef.current = { lng: v.lng, lat: v.lat };
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const { lng, lat } = toLngLatFromGroupPos(node.x(), node.y());
                        const inside = turf.booleanPointInPolygon(turf.point([lng, lat]), farmPoly);
                        if (!inside) {
                          const o = dragOriginRef.current;
                          dragOriginRef.current = null;
                          if (o) {
                            const back = project(o.lng, o.lat);
                            node.position({ x: back.x, y: back.y });
                          }
                          toast.error("Keep valves inside the boundary.");
                          return;
                        }
                        dragOriginRef.current = null;
                        void patchValvePosition(v, lng, lat);
                      }}
                      onClick={() => {
                        if (tool === "delete") {
                          setDeleteTarget({ kind: "valve", valve: v });
                          return;
                        }
                        onSelectionChange([], [v.id]);
                      }}
                    />
                  );
                })}
              </Group>
            </Layer>
            {marquee ? (
              <Layer listening={false}>
                <Rect
                  x={Math.min(marquee.x1, marquee.x2)}
                  y={Math.min(marquee.y1, marquee.y2)}
                  width={Math.abs(marquee.x2 - marquee.x1)}
                  height={Math.abs(marquee.y2 - marquee.y1)}
                  fill="rgba(59, 130, 246, 0.12)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  listening={false}
                />
              </Layer>
            ) : null}
          </Stage>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-[2] rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600 shadow dark:bg-slate-900/90 dark:text-slate-300">
          {tool === "pan"
            ? "Drag canvas to pan · wheel to zoom"
            : tool === "select"
              ? `Tap to select · Shift/⌘+click to add to selection · drag items to move · drag on ground to box-select · ⌫ deletes selection${
                  selectedPlantIds.length + selectedValveIds.length > 0
                    ? ` (${selectedPlantIds.length} plants, ${selectedValveIds.length} valves)`
                    : ""
                }`
              : tool === "delete"
                ? "Tap a plant or valve to delete"
                : "Tap inside the farm to place"}
          {" · "}
          {plants.length} plants · {valves.length} valves · {rowGuideLines.length} row guides
        </div>
        <button
          type="button"
          className="absolute right-3 top-14 z-[20] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          onClick={() => fit()}
        >
          Fit farm
        </button>
      </div>

      <Dialog open={deleteTarget != null} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === "bulk"
                ? "Delete selection?"
                : deleteTarget?.kind === "plant"
                  ? "Delete plant?"
                  : "Delete valve?"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === "bulk" ? (
                <>
                  This removes <strong>{deleteTarget.plantIds.length} plants</strong> and{" "}
                  <strong>{deleteTarget.valveIds.length} valves</strong> from your local database. Row–valve links
                  refresh automatically if valves are removed.
                </>
              ) : deleteTarget?.kind === "plant" ? (
                <>
                  This removes <strong>{deleteTarget.plant.label}</strong> from your local database. This cannot be
                  undone from here.
                </>
              ) : deleteTarget?.kind === "valve" ? (
                <>
                  This removes <strong>{deleteTarget.valve.name}</strong>. Row–valve links will refresh automatically.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { farmFromDoc } from "@/db/adapters";
import type { FarmDotsDatabase } from "@/db/types";
import { lngLatToCanvas, polygonViewBox } from "@/workspace/geoTransform";
import type { Farm, Plant, Valve } from "@farmdots/shared";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { Application, Container, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Props = { db: FarmDotsDatabase };

/**
 * Optional PixiJS "simulation" workspace — late-phase, demo-friendly mode.
 *
 * Reads farm geometry / plants / valves from RxDB (same source of truth as the
 * Konva workspace) and renders a lightweight animated scene. UI state is
 * component-local; we deliberately avoid Zustand for now to keep the optional
 * track minimal.
 */
export function SimWorkspacePage({ db }: Props) {
  const { farmId } = useParams<{ farmId: string }>();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!farmId) return;
    const sub = db.farms.findOne(farmId).$.subscribe((doc) => {
      try {
        if (!doc) return setFarm(null);
        setFarm(farmFromDoc(doc.toJSON()));
      } catch {
        setFarm(null);
      }
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  useEffect(() => {
    if (!farmId) return;
    const sP = db.plants.find({ selector: { farmId } }).$.subscribe((docs) => {
      setPlants(docs.map((d) => d.toJSON() as Plant));
    });
    const sV = db.valves.find({ selector: { farmId } }).$.subscribe((docs) => {
      setValves(docs.map((d) => d.toJSON() as Valve));
    });
    return () => {
      sP.unsubscribe();
      sV.unsubscribe();
    };
  }, [db, farmId]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !farm) return;

    const app = new Application();
    let cancelled = false;
    const scene = new Container();
    const polyGfx = new Graphics();
    const plantsGfx = new Graphics();
    const valvesGfx = new Graphics();

    void app
      .init({ background: 0x0f172a, antialias: true, resizeTo: el })
      .then(() => {
        if (cancelled) return;
        el.appendChild(app.canvas);
        appRef.current = app;
        scene.addChild(polyGfx);
        scene.addChild(plantsGfx);
        scene.addChild(valvesGfx);
        app.stage.addChild(scene);
      });

    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [farm?.id]);

  useEffect(() => {
    const app = appRef.current;
    const el = wrapRef.current;
    if (!app || !el || !farm) return;

    const box = polygonViewBox(farm.polygon);
    const w = el.clientWidth;
    const h = el.clientHeight;
    const padding = 48;

    const proj = (lng: number, lat: number) => lngLatToCanvas(lng, lat, box, w, h, padding);

    const root = app.stage.children[0] as Container | undefined;
    if (!root) return;
    const [polyGfx, plantsGfx, valvesGfx] = root.children as Graphics[];

    polyGfx.clear();
    const ring = farm.polygon.coordinates[0] ?? [];
    if (ring.length > 0) {
      const first = proj(ring[0][0], ring[0][1]);
      polyGfx.moveTo(first.x, first.y);
      for (let i = 1; i < ring.length; i++) {
        const { x, y } = proj(ring[i][0], ring[i][1]);
        polyGfx.lineTo(x, y);
      }
      polyGfx.closePath();
      polyGfx.fill({ color: 0x166534, alpha: 0.18 });
      polyGfx.stroke({ color: 0x22c55e, width: 2 });
    }

    plantsGfx.clear();
    for (const p of plants) {
      const { x, y } = proj(p.lng, p.lat);
      const fill =
        p.healthStatus === "healthy"
          ? 0x22c55e
          : p.healthStatus === "unknown"
            ? 0x94a3b8
            : 0xf97316;
      plantsGfx.circle(x, y, 4).fill({ color: fill });
    }

    valvesGfx.clear();
    for (const v of valves) {
      const { x, y } = proj(v.lng, v.lat);
      valvesGfx.circle(x, y, 8).fill({ color: 0x7c3aed }).stroke({ color: 0xc4b5fd, width: 1.5 });
    }

    let t = 0;
    const onTick = (ticker: { deltaTime: number }) => {
      t += ticker.deltaTime;
      const pulse = 1 + 0.08 * Math.sin(t * 0.05);
      valvesGfx.scale.set(pulse, pulse);
    };
    app.ticker.add(onTick);
    return () => {
      app.ticker.remove(onTick);
    };
  }, [farm, plants, valves]);

  if (!farmId) return null;
  if (!farm) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
        Farm not found locally.
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex flex-none items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          to={`/farm/${farm.id}/workspace`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Workspace
        </Link>
        <span className="font-semibold text-slate-900 dark:text-slate-100">Simulation mode</span>
        <span className="text-sm text-slate-600 dark:text-slate-400">{farm.name}</span>
        <Link
          to="/"
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <MapIcon className="h-4 w-4" />
          Map
        </Link>
      </header>
      <div ref={wrapRef} className="relative min-h-0 flex-1" />
      <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Pixi sim mode is a demo view that reads from the same local database. Edits happen in the Konva workspace.
      </p>
    </div>
  );
}

import type { GeoJsonPolygon } from "@farmdots/shared";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import type { MapRef } from "react-map-gl/maplibre";
import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";

type Props = {
  polygon: GeoJsonPolygon;
  onEdited: (polygon: GeoJsonPolygon) => void;
};

/**
 * Mapbox Draw's `onRemove` calls `ctx.map.off` before nulling `ctx.map`. When the
 * parent Map unmounts, React Map GL removes controls once and our effect cleanup can
 * call `removeControl` again — the second `onRemove` throws (Safari: "null is not
 * an object (evaluating 'ctx.map.off')").
 */
function createMapboxDraw(options: ConstructorParameters<typeof MapboxDraw>[0]) {
  const draw = new MapboxDraw(options);
  const originalOnRemove = draw.onRemove.bind(draw);
  draw.onRemove = function safeOnRemove(map) {
    try {
      return originalOnRemove(map);
    } catch {
      return draw;
    }
  };
  return draw;
}

function isMapInteractive(m: MapLibreMap): boolean {
  try {
    return Boolean(m.getContainer()?.isConnected);
  } catch {
    return false;
  }
}

function waitForMapRef(getRef: () => MapRef | undefined, cb: (mapgl: MapLibreMap) => void): () => void {
  let cancelled = false;
  const t = window.setInterval(() => {
    const ref = getRef();
    const mapgl = ref?.getMap();
    if (!mapgl || cancelled) return;
    window.clearInterval(t);
    cb(mapgl);
  }, 32);
  return () => {
    cancelled = true;
    window.clearInterval(t);
  };
}

/** Vertex editing for the active farm boundary via `@mapbox/mapbox-gl-draw` + MapLibre. */
export function FarmPolygonEditor({ polygon, onEdited }: Props) {
  const maps = useMap();
  const drawRef = useRef<MapboxDraw | null>(null);
  const controlOnMapRef = useRef(false);
  const skipNextEmit = useRef(false);

  useEffect(() => {
    let detachFn: (() => void) | undefined;

    const stopWaiting = waitForMapRef(() => maps.current, (m) => {
      const draw = createMapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: false, trash: false },
        defaultMode: "simple_select",
      });
      drawRef.current = draw;
      m.addControl(draw as unknown as maplibregl.IControl, "top-right");
      controlOnMapRef.current = true;

      const syncFromDraw = () => {
        if (skipNextEmit.current) {
          skipNextEmit.current = false;
          return;
        }
        const fc = draw.getAll();
        const g = fc.features[0]?.geometry;
        if (!g || g.type !== "Polygon") return;
        const coords = g.coordinates[0] as [number, number][];
        const ring = [...coords];
        const a = ring[0];
        const b = ring[ring.length - 1];
        if (a && b && (a[0] !== b[0] || a[1] !== b[1])) ring.push([a[0], a[1]]);
        onEdited({ type: "Polygon", coordinates: [ring] });
      };

      m.on("draw.update", syncFromDraw);

      const boot = () => {
        draw.deleteAll();
        skipNextEmit.current = true;
        draw.add({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: polygon.coordinates },
        });
      };

      if (m.loaded()) boot();
      else m.once("load", boot);

      detachFn = () => {
        try {
          m.off("draw.update", syncFromDraw);
        } catch {
          /* map already destroyed */
        }
        if (controlOnMapRef.current && isMapInteractive(m)) {
          try {
            m.removeControl(draw as unknown as maplibregl.IControl);
          } catch {
            /* draw may already have been removed by Map unmount */
          }
        }
        controlOnMapRef.current = false;
        drawRef.current = null;
      };
    });

    return () => {
      stopWaiting();
      detachFn?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polygon synced below
  }, [maps, onEdited]);

  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    skipNextEmit.current = true;
    draw.add({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: polygon.coordinates },
    });
  }, [polygon]);

  return null;
}

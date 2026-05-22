import * as turf from "@turf/turf";
import type { GeoJsonPolygon } from "@farmdots/shared";
import { canvasToLngLat, type ViewBox } from "@/workspace/geoTransform";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import Map, { type MapRef } from "react-map-gl/maplibre";

export type WorkspaceMapViewSync = {
  viewBox: ViewBox;
  width: number;
  height: number;
  padding: number;
  groupPos: { x: number; y: number };
  groupScale: number;
};

/** Corners of the Konva stage → WGS84 bbox as MapLibre expects: [[lng,lat],[lng,lat]]. */
function stageCornersToLngLatBounds(
  viewSync: WorkspaceMapViewSync,
): [[number, number], [number, number]] | null {
  const { viewBox, width, height, padding, groupPos, groupScale } = viewSync;
  if (width < 16 || height < 16 || !Number.isFinite(groupScale) || groupScale <= 0) return null;

  const stageCorners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [sx, sy] of stageCorners) {
    const lx = (sx - groupPos.x) / groupScale;
    const ly = (sy - groupPos.y) / groupScale;
    const { lng, lat } = canvasToLngLat(lx, ly, viewBox, width, height, padding);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;
  if (lngSpan < 1e-10 || latSpan < 1e-10) return null;

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

const BG_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function InvalidateOnResize({ rootRef, mapRef }: { rootRef: RefObject<HTMLDivElement | null>; mapRef: RefObject<MapRef | null> }) {
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    ro.observe(el);
    mapRef.current?.resize();
    return () => ro.disconnect();
  }, [mapRef, rootRef]);
  return null;
}

type Props = {
  polygon: GeoJsonPolygon;
  viewSync: WorkspaceMapViewSync;
};

/** Non-interactive MapLibre raster tiles aligned with the Konva workspace viewport. */
export function WorkspaceMapBackground({ polygon, viewSync }: Props) {
  const [mapReady, setMapReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    setMapReady(true);
  }, []);

  const center = useMemo(() => {
    const c = turf.centroid(turf.polygon(polygon.coordinates));
    return { lng: c.geometry.coordinates[0], lat: c.geometry.coordinates[1] };
  }, [polygon]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map?.loaded()) return;
    const b = stageCornersToLngLatBounds(viewSync);
    if (!b) return;
    map.resize();
    map.fitBounds(b, { animate: false, padding: 0, maxZoom: 22 });
  }, [
    viewSync,
    mapReady,
  ]);

  if (!mapReady) {
    return <div className="absolute inset-0 z-0 bg-slate-100 dark:bg-slate-950" aria-hidden />;
  }

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 16,
        }}
        mapStyle={BG_STYLE}
        style={{ width: "100%", height: "100%" }}
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        touchZoomRotate={false}
        onLoad={() => {
          const map = mapRef.current?.getMap();
          const b = stageCornersToLngLatBounds(viewSync);
          if (map && b) {
            map.resize();
            map.fitBounds(b, { animate: false, padding: 0, maxZoom: 22 });
          }
        }}
      />
      <InvalidateOnResize rootRef={rootRef} mapRef={mapRef} />
    </div>
  );
}

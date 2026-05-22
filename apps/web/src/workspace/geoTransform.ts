import type { GeoJsonPolygon } from "@farmdots/shared";

export type ViewBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export function polygonViewBox(polygon: GeoJsonPolygon): ViewBox {
  const ring = polygon.coordinates[0] ?? [];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng)) {
    return { minLng: 0, minLat: 0, maxLng: 1, maxLat: 1 };
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** Linear map from lng/lat into canvas pixels; Y grows downward. */
export type ProjectionParams = {
  scale: number;
  offsetX: number;
  offsetY: number;
  spanLng: number;
  spanLat: number;
};

export function getProjectionParams(
  box: ViewBox,
  width: number,
  height: number,
  padding: number,
): ProjectionParams {
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const spanLng = Math.max(1e-12, box.maxLng - box.minLng);
  const spanLat = Math.max(1e-12, box.maxLat - box.minLat);
  const scale = Math.min(innerW / spanLng, innerH / spanLat);
  const contentW = spanLng * scale;
  const contentH = spanLat * scale;
  const offsetX = padding + (innerW - contentW) / 2;
  const offsetY = padding + (innerH - contentH) / 2;
  return { scale, offsetX, offsetY, spanLng, spanLat };
}

export function lngLatToCanvas(
  lng: number,
  lat: number,
  box: ViewBox,
  width: number,
  height: number,
  padding: number,
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = getProjectionParams(box, width, height, padding);
  const x = offsetX + (lng - box.minLng) * scale;
  const y = offsetY + (box.maxLat - lat) * scale;
  return { x, y };
}

/** Inverse of {@link lngLatToCanvas} — `x`/`y` are in the same farm-local pixel space as Konva shapes inside the pan/zoom `Group`. */
export function canvasToLngLat(
  x: number,
  y: number,
  box: ViewBox,
  width: number,
  height: number,
  padding: number,
): { lng: number; lat: number } {
  const { scale, offsetX, offsetY } = getProjectionParams(box, width, height, padding);
  const lng = (x - offsetX) / scale + box.minLng;
  const lat = box.maxLat - (y - offsetY) / scale;
  return { lng, lat };
}

export function fitScaleForPolygon(box: ViewBox, width: number, height: number, padding: number): number {
  return getProjectionParams(box, width, height, padding).scale;
}

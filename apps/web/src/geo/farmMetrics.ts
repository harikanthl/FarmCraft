import * as turf from "@turf/turf";
import type { GeoJsonPolygon } from "@farmdots/shared";

export type FarmPolygonMetrics = {
  areaM2: number;
  perimeterM: number;
  centroidLng: number;
  centroidLat: number;
};

export function computeFarmPolygonMetrics(polygon: GeoJsonPolygon): FarmPolygonMetrics {
  const poly = turf.polygon(polygon.coordinates);
  const areaM2 = turf.area(poly);
  const line = turf.polygonToLine(poly);
  const perimeterM = turf.length(line, { units: "meters" });
  const c = turf.centroid(poly);
  const [lng, lat] = c.geometry.coordinates;
  return {
    areaM2,
    perimeterM,
    centroidLng: lng,
    centroidLat: lat,
  };
}

export function formatArea(areaM2: number, system: "metric" | "imperial"): string {
  if (system === "metric") {
    if (areaM2 >= 1_000_000) return `${(areaM2 / 1_000_000).toFixed(2)} km²`;
    if (areaM2 >= 10_000) return `${(areaM2 / 10_000).toFixed(2)} ha`;
    return `${Math.round(areaM2)} m²`;
  }
  const acres = areaM2 / 4046.8564224;
  if (acres >= 640) return `${(acres / 640).toFixed(2)} mi²`;
  return `${acres.toFixed(2)} ac`;
}

export function formatLength(meters: number, system: "metric" | "imperial"): string {
  if (system === "metric") {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  }
  const ft = meters * 3.28084;
  if (ft >= 5280) return `${(ft / 5280).toFixed(2)} mi`;
  return `${Math.round(ft)} ft`;
}

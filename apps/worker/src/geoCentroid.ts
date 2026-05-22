import type { Env } from "./repo.js";

/** Rough centroid from GeoJSON Polygon exterior ring (for weather lookups). */
export function centroidFromPolygonJson(polygonJson: string): { lat: number; lng: number } | null {
  try {
    const g = JSON.parse(polygonJson) as {
      type?: string;
      coordinates?: number[][][];
    };
    if (g.type !== "Polygon" || !Array.isArray(g.coordinates?.[0])) return null;
    const ring = g.coordinates[0];
    let sumLng = 0;
    let sumLat = 0;
    let n = 0;
    for (const pt of ring) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      sumLng += pt[0];
      sumLat += pt[1];
      n++;
    }
    if (!n) return null;
    return { lng: sumLng / n, lat: sumLat / n };
  } catch {
    return null;
  }
}

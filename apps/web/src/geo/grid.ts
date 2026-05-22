import * as turf from "@turf/turf";
import type { GeoJsonPolygon, Plant, Row } from "@farmdots/shared";

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export type GridParams = {
  farmId: string;
  polygon: GeoJsonPolygon;
  /** Parallel row lines across the farm (perpendicular spacing `rowSpacingM`). */
  rowCount: number;
  /** Perpendicular distance between row centerlines (meters). */
  rowSpacingM: number;
  /** Distance along each row between plants (meters). */
  plantSpacingM: number;
  /** Bearing along each row, degrees clockwise from north. */
  bearingDeg: number;
  now: number;
};

/** Approximate farm width/height in meters from bbox (for UI hints). */
export function bboxSizeMeters(polygon: GeoJsonPolygon): { widthM: number; heightM: number } {
  const poly = turf.polygon(polygon.coordinates);
  const bbox = turf.bbox(poly);
  const [minX, minY, maxX, maxY] = bbox;
  const midLat = (minY + maxY) / 2;
  const heightM = (maxY - minY) * METERS_PER_DEG_LAT;
  const widthM = (maxX - minX) * metersPerDegLng(midLat);
  return { widthM: Math.max(0, widthM), heightM: Math.max(0, heightM) };
}

export function normalizeBearing(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

export type GridBearingSource = "manual" | "farmShape" | "existingPlants";

/**
 * Span of the polygon (meters) measured perpendicular to row direction.
 * Row centerlines run along `bearingDeg`; row spacing steps along bearing+90°.
 */
export function perpendicularExtentMeters(polygon: GeoJsonPolygon, bearingDeg: number): number {
  const poly = turf.polygon(polygon.coordinates);
  const c = turf.centroid(poly);
  const [clng, clat] = c.geometry.coordinates;
  const b = normalizeBearing(bearingDeg);
  const perpRad = ((b + 90) * Math.PI) / 180;
  const ue = Math.sin(perpRad);
  const un = Math.cos(perpRad);
  const ring = polygon.coordinates[0] ?? [];
  let minT = Infinity;
  let maxT = -Infinity;
  for (const coord of ring) {
    const lng = coord[0]!;
    const lat = coord[1]!;
    const dx = (lng - clng) * metersPerDegLng(clat);
    const dy = (lat - clat) * METERS_PER_DEG_LAT;
    const t = dx * ue + dy * un;
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return 0;
  return Math.max(0, maxT - minT);
}

/**
 * Projects the outer ring onto the row axis (bearing from north, clockwise).
 * Returns signed distances (meters) from `anchor` along that axis to the min/max vertex projections.
 * For a convex footprint, the farm's intersection with that infinite row line lies within [minT, maxT].
 */
function spanAlongRowThroughAnchorMeters(
  polygon: GeoJsonPolygon,
  anchorLng: number,
  anchorLat: number,
  bearingDeg: number,
): { minT: number; maxT: number } {
  const b = normalizeBearing(bearingDeg);
  const rowRad = (b * Math.PI) / 180;
  const ue = Math.sin(rowRad);
  const un = Math.cos(rowRad);
  const ring = polygon.coordinates[0] ?? [];
  let minT = Infinity;
  let maxT = -Infinity;
  for (const coord of ring) {
    const lng = coord[0]!;
    const lat = coord[1]!;
    const dx = (lng - anchorLng) * metersPerDegLng(anchorLat);
    const dy = (lat - anchorLat) * METERS_PER_DEG_LAT;
    const t = dx * ue + dy * un;
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
  }
  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return { minT: 0, maxT: 0 };
  return { minT, maxT };
}

/** How many parallel row stripes fit across the farm at this spacing (centered like generateRowsAndPlants). */
export function computeAutoRowCount(polygon: GeoJsonPolygon, bearingDeg: number, rowSpacingM: number): number {
  if (rowSpacingM <= 0) return 1;
  const extent = perpendicularExtentMeters(polygon, bearingDeg);
  return Math.max(1, Math.floor(extent / rowSpacingM) + 1);
}

/** Row lines run parallel to the longer axis of the bounding box (meters). */
export function inferRowBearingFromFarmShape(polygon: GeoJsonPolygon): number {
  const { widthM, heightM } = bboxSizeMeters(polygon);
  return widthM >= heightM ? 90 : 0;
}

/**
 * Principal direction of plant layout (degrees clockwise from north, row run direction).
 * Two points: bearing of the segment. More points: dominant axis via covariance.
 */
export function inferRowBearingFromPlants(points: { lng: number; lat: number }[]): number | null {
  if (points.length < 2) return null;
  if (points.length === 2) {
    const [a, b] = points;
    return normalizeBearing(
      turf.bearing(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat])),
    );
  }
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  const n = points.length;
  const clat = sumLat / n;
  const clng = sumLng / n;
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const p of points) {
    const dx = (p.lng - clng) * metersPerDegLng(clat);
    const dy = (p.lat - clat) * METERS_PER_DEG_LAT;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= n;
  cyy /= n;
  cxy /= n;
  const tr = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc;
  let ex = 1;
  let en = 0;
  if (Math.abs(cxy) > 1e-12) {
    en = (l1 - cxx) / cxy;
    ex = 1;
    const k = Math.hypot(ex, en);
    ex /= k;
    en /= k;
  } else if (cxx >= cyy) {
    ex = 1;
    en = 0;
  } else {
    ex = 0;
    en = 1;
  }
  const bearing = (Math.atan2(ex, en) * 180) / Math.PI;
  return normalizeBearing(bearing);
}

export function resolveRowBearingDeg(
  source: GridBearingSource,
  manualDeg: number,
  polygon: GeoJsonPolygon,
  plantHint: { lng: number; lat: number }[],
): number {
  if (source === "manual") return normalizeBearing(manualDeg);
  if (source === "farmShape") return inferRowBearingFromFarmShape(polygon);
  return inferRowBearingFromPlants(plantHint) ?? inferRowBearingFromFarmShape(polygon);
}

/**
 * Parallel-row orchard grid: centroid anchor, rows spaced perpendicular to `bearingDeg`.
 * Plants are stepped along each row by `plantSpacingM` only across the polygon span at that anchor
 * (vertex projection onto the row axis), so work scales with ~plants inside the farm, not row count × an oversized scan line.
 */
export function generateRowsAndPlants(params: GridParams): { rows: Row[]; plants: Plant[] } {
  const { farmId, polygon, rowCount, rowSpacingM, plantSpacingM, bearingDeg, now } = params;
  if (rowCount < 1 || rowSpacingM <= 0 || plantSpacingM <= 0) return { rows: [], plants: [] };

  const bearing = normalizeBearing(bearingDeg);
  const poly = turf.polygon(polygon.coordinates);
  const centroid = turf.centroid(poly);

  const rows: Row[] = [];
  for (let r = 0; r < rowCount; r++) {
    rows.push({
      id: crypto.randomUUID(),
      farmId,
      name: `Row ${r + 1}`,
      orderIndex: r,
      valveIds: [],
      createdAt: now,
    });
  }

  const plants: Plant[] = [];
  const padM = plantSpacingM;
  const step = plantSpacingM;

  for (let r = 0; r < rowCount; r++) {
    const rowId = rows[r]!.id;
    const offsetIdx = r - (rowCount - 1) / 2;
    const anchor = turf.destination(centroid, offsetIdx * rowSpacingM, bearing + 90, { units: "meters" });
    const [alng, alat] = anchor.geometry.coordinates;
    const { minT, maxT } = spanAlongRowThroughAnchorMeters(polygon, alng, alat, bearing);
    const seen = new Set<string>();
    let slot = 0;

    for (let d = minT - padM; d <= maxT + padM + 1e-9; d += step) {
      const mid = turf.destination(anchor, d, bearing, { units: "meters" });
      const [lng, lat] = mid.geometry.coordinates;
      const key = `${lng.toFixed(7)},${lat.toFixed(7)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const pt = turf.point([lng, lat]);
      if (!turf.booleanPointInPolygon(pt, poly)) continue;

      slot += 1;
      plants.push({
        id: crypto.randomUUID(),
        farmId,
        rowId,
        label: `R${r + 1}-${slot}`,
        lat,
        lng,
        cropType: "unknown",
        healthStatus: "unknown",
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }
  }

  return { rows, plants };
}

export type BuildGridWizardInput = {
  farmId: string;
  polygon: GeoJsonPolygon;
  autoRowCount: boolean;
  rowCountManual?: number;
  bearingSource: GridBearingSource;
  bearingDegManual: number;
  rowSpacingM: number;
  plantSpacingM: number;
  /** Used when bearingSource is existingPlants (≥2 positions). */
  plantPositionsHint?: { lng: number; lat: number }[];
  now: number;
};

export function buildGridFromWizard(input: BuildGridWizardInput): {
  rows: Row[];
  plants: Plant[];
  bearingUsedDeg: number;
  rowCountUsed: number;
} {
  const plantHint = input.plantPositionsHint ?? [];
  const bearingUsedDeg = resolveRowBearingDeg(
    input.bearingSource,
    input.bearingDegManual,
    input.polygon,
    plantHint,
  );
  const rowCountUsed = input.autoRowCount
    ? computeAutoRowCount(input.polygon, bearingUsedDeg, input.rowSpacingM)
    : Math.max(1, input.rowCountManual ?? 1);
  const { rows, plants } = generateRowsAndPlants({
    farmId: input.farmId,
    polygon: input.polygon,
    rowCount: rowCountUsed,
    rowSpacingM: input.rowSpacingM,
    plantSpacingM: input.plantSpacingM,
    bearingDeg: bearingUsedDeg,
    now: input.now,
  });
  return { rows, plants, bearingUsedDeg, rowCountUsed };
}

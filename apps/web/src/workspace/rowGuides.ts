import type { Plant, Row } from "@farmdots/shared";

/** Order plants along the dominant axis of the cluster (row-ish polyline). */
export function sortPlantsAlongRow(plants: Plant[]): Plant[] {
  if (plants.length <= 1) return [...plants];
  const cx = plants.reduce((s, p) => s + p.lng, 0) / plants.length;
  const cy = plants.reduce((s, p) => s + p.lat, 0) / plants.length;
  let far = plants[0]!;
  let best = -1;
  for (const p of plants) {
    const d = (p.lng - cx) ** 2 + (p.lat - cy) ** 2;
    if (d > best) {
      best = d;
      far = p;
    }
  }
  const vx = far.lng - cx;
  const vy = far.lat - cy;
  const len = Math.hypot(vx, vy) || 1;
  const nx = vx / len;
  const ny = vy / len;
  return [...plants].sort((a, b) => {
    const ta = (a.lng - cx) * nx + (a.lat - cy) * ny;
    const tb = (b.lng - cx) * nx + (b.lat - cy) * ny;
    return ta - tb;
  });
}

export type RowGuidePolyline = {
  rowId: string;
  name: string;
  positions: { lng: number; lat: number }[];
};

/** One polyline per row that has at least two plants (guides for Konva). */
export function rowGuidePolylinesFromPlants(plants: Plant[], rows: Row[]): RowGuidePolyline[] {
  const byRow = new Map<string, Plant[]>();
  for (const p of plants) {
    const list = byRow.get(p.rowId) ?? [];
    list.push(p);
    byRow.set(p.rowId, list);
  }
  const rowMeta = new Map(rows.map((r) => [r.id, r.name]));
  const out: RowGuidePolyline[] = [];
  for (const [rowId, plist] of byRow) {
    if (plist.length < 2) continue;
    const sorted = sortPlantsAlongRow(plist);
    out.push({
      rowId,
      name: rowMeta.get(rowId) ?? rowId.slice(0, 8),
      positions: sorted.map((p) => ({ lng: p.lng, lat: p.lat })),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

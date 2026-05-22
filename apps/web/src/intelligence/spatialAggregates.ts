import type { DiseaseEvent, IrrigationEvent, Plant, Row, Valve } from "@farmdots/shared";

export type SpatialOverlayMode = "off" | "yield" | "disease" | "irrigation";

export type RowBand = {
  rowId: string;
  /** 0..1; meaning depends on the overlay (high yield = 1, high disease = 1, well-watered = 1). */
  score: number;
  /** Optional positive/negative direction: "good" → green tint, "warn" → amber, "bad" → red. */
  band: "good" | "watch" | "bad" | "neutral";
};

export type ValveBand = {
  valveId: string;
  band: "good" | "watch" | "bad" | "neutral";
  /** ms since last irrigation; undefined when no events. */
  msSinceLast?: number;
};

const FRESH_IRRIGATION_MS = 7 * 24 * 3600_000;
const STALE_IRRIGATION_MS = 21 * 24 * 3600_000;
const RECENT_DISEASE_MS = 30 * 24 * 3600_000;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Per-row yield band from `plant.yearlyYield`. Uses farm-level min/max for normalization. */
export function computeYieldRowBands(plants: Plant[]): RowBand[] {
  const byRow = new Map<string, { sum: number; count: number }>();
  for (const p of plants) {
    if (typeof p.yearlyYield !== "number" || !Number.isFinite(p.yearlyYield)) continue;
    const cur = byRow.get(p.rowId) ?? { sum: 0, count: 0 };
    cur.sum += p.yearlyYield;
    cur.count += 1;
    byRow.set(p.rowId, cur);
  }
  if (byRow.size === 0) return [];
  const avgs = [...byRow.entries()].map(([rowId, v]) => ({ rowId, avg: v.sum / Math.max(1, v.count) }));
  const min = Math.min(...avgs.map((a) => a.avg));
  const max = Math.max(...avgs.map((a) => a.avg));
  const span = max - min;
  return avgs.map(({ rowId, avg }) => {
    const score = span > 0 ? clamp01((avg - min) / span) : 0.5;
    const band: RowBand["band"] = score >= 0.66 ? "good" : score >= 0.33 ? "watch" : "bad";
    return { rowId, score, band };
  });
}

/** Per-row disease pressure (higher score = more pressure). */
export function computeDiseaseRowBands(args: {
  plants: Plant[];
  diseaseEvents: DiseaseEvent[];
  now?: number;
}): RowBand[] {
  const now = args.now ?? Date.now();
  const plantToRow = new Map<string, string>();
  const rowDenom = new Map<string, number>();
  for (const p of args.plants) {
    plantToRow.set(p.id, p.rowId);
    rowDenom.set(p.rowId, (rowDenom.get(p.rowId) ?? 0) + 1);
  }
  const counts = new Map<string, number>();
  for (const d of args.diseaseEvents) {
    if (now - d.createdAt > RECENT_DISEASE_MS) continue;
    const rowId = plantToRow.get(d.plantId);
    if (!rowId) continue;
    const weight = d.severity === "high" ? 3 : d.severity === "medium" ? 2 : 1;
    counts.set(rowId, (counts.get(rowId) ?? 0) + weight);
  }
  if (counts.size === 0) return [];
  return [...counts.entries()].map(([rowId, total]) => {
    const denom = rowDenom.get(rowId) ?? 1;
    const score = clamp01(total / Math.max(2, denom * 0.5));
    const band: RowBand["band"] = score >= 0.66 ? "bad" : score >= 0.33 ? "watch" : "good";
    return { rowId, score, band };
  });
}

/** Per-row irrigation recency band (good = recent, bad = stale). Uses valve→row connections. */
export function computeIrrigationRowBands(args: {
  rows: Row[];
  valves: Valve[];
  irrigationEvents: IrrigationEvent[];
  now?: number;
}): { rows: RowBand[]; valves: ValveBand[] } {
  const now = args.now ?? Date.now();
  const lastByValve = new Map<string, number>();
  for (const e of args.irrigationEvents) {
    const ts = e.endedAt ?? e.startedAt;
    const cur = lastByValve.get(e.valveId);
    if (cur == null || ts > cur) lastByValve.set(e.valveId, ts);
  }
  const valveToRows = new Map<string, string[]>();
  for (const v of args.valves) valveToRows.set(v.id, v.connectedRows ?? []);

  const rowFresh = new Map<string, number>();
  for (const r of args.rows) rowFresh.set(r.id, Number.POSITIVE_INFINITY);
  for (const v of args.valves) {
    const ts = lastByValve.get(v.id);
    if (ts == null) continue;
    const age = now - ts;
    for (const rowId of valveToRows.get(v.id) ?? []) {
      const cur = rowFresh.get(rowId);
      if (cur == null || age < cur) rowFresh.set(rowId, age);
    }
  }

  const rowBands: RowBand[] = [];
  for (const [rowId, age] of rowFresh.entries()) {
    if (!Number.isFinite(age)) {
      rowBands.push({ rowId, score: 0, band: "neutral" });
      continue;
    }
    if (age <= FRESH_IRRIGATION_MS) rowBands.push({ rowId, score: 1, band: "good" });
    else if (age <= STALE_IRRIGATION_MS) rowBands.push({ rowId, score: 0.5, band: "watch" });
    else rowBands.push({ rowId, score: 0, band: "bad" });
  }

  const valveBands: ValveBand[] = args.valves.map((v) => {
    const ts = lastByValve.get(v.id);
    if (ts == null) return { valveId: v.id, band: "neutral" };
    const age = now - ts;
    return {
      valveId: v.id,
      msSinceLast: age,
      band: age <= FRESH_IRRIGATION_MS ? "good" : age <= STALE_IRRIGATION_MS ? "watch" : "bad",
    };
  });

  return { rows: rowBands, valves: valveBands };
}

/** Maps a band to a CSS-style hex color used by Konva strokes. */
export function bandStroke(band: RowBand["band"]): string {
  switch (band) {
    case "good":
      return "#10b981";
    case "watch":
      return "#f59e0b";
    case "bad":
      return "#ef4444";
    case "neutral":
    default:
      return "#64748b";
  }
}

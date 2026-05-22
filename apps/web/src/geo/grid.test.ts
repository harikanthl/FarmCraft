import { describe, expect, it } from "vitest";
import {
  bboxSizeMeters,
  buildGridFromWizard,
  computeAutoRowCount,
  generateRowsAndPlants,
  perpendicularExtentMeters,
  resolveRowBearingDeg,
} from "./grid";

describe("generateRowsAndPlants", () => {
  const square = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ],
    ] as [number, number][][],
  };

  it("distributes plants across the polygon (not one corner)", () => {
    const now = 1;
    const { plants } = generateRowsAndPlants({
      farmId: "farm-1",
      polygon: square,
      rowCount: 4,
      rowSpacingM: 25,
      plantSpacingM: 20,
      bearingDeg: 45,
      now,
    });
    expect(plants.length).toBeGreaterThan(5);
    const lngs = plants.map((p) => p.lng);
    const lats = plants.map((p) => p.lat);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    expect(lngSpread).toBeGreaterThan(0.002);
    expect(latSpread).toBeGreaterThan(0.002);
  });

  it("creates one row record per row count", () => {
    const { rows } = generateRowsAndPlants({
      farmId: "farm-1",
      polygon: square,
      rowCount: 3,
      rowSpacingM: 30,
      plantSpacingM: 25,
      bearingDeg: 0,
      now: 1,
    });
    expect(rows).toHaveLength(3);
  });

  it("bboxSizeMeters returns positive dimensions", () => {
    const { widthM, heightM } = bboxSizeMeters(square);
    expect(widthM).toBeGreaterThan(0);
    expect(heightM).toBeGreaterThan(0);
  });

  it("perpendicularExtentMeters is positive for a square bbox", () => {
    const e0 = perpendicularExtentMeters(square, 0);
    const e90 = perpendicularExtentMeters(square, 90);
    expect(e0).toBeGreaterThan(0);
    expect(e90).toBeGreaterThan(0);
  });

  it("computeAutoRowCount increases with wider perpendicular extent", () => {
    const nTight = computeAutoRowCount(square, 0, 800);
    const nLoose = computeAutoRowCount(square, 0, 200);
    expect(nLoose).toBeGreaterThanOrEqual(nTight);
  });

  it("buildGridFromWizard autoRowCount fills more than a single manual row", () => {
    const now = 1;
    const { plants, rowCountUsed } = buildGridFromWizard({
      farmId: "farm-1",
      polygon: square,
      autoRowCount: true,
      bearingSource: "manual",
      bearingDegManual: 45,
      rowSpacingM: 200,
      plantSpacingM: 150,
      plantPositionsHint: [],
      now,
    });
    expect(rowCountUsed).toBeGreaterThan(1);
    expect(plants.length).toBeGreaterThan(10);
  });

  it("resolveRowBearingDeg farmShape matches bbox long axis rule", () => {
    const b = resolveRowBearingDeg("farmShape", 0, square, []);
    expect(b === 0 || b === 90).toBe(true);
  });

  /** Regression: row count must not inflate scan length (old bug used rowSpacing * rowCount in half-line length). */
  it("many rows completes without excessive plant candidates (timing guard)", () => {
    const now = 1;
    const t0 = performance.now();
    const { plants, rows } = generateRowsAndPlants({
      farmId: "farm-1",
      polygon: square,
      rowCount: 200,
      rowSpacingM: 8,
      plantSpacingM: 5,
      bearingDeg: 30,
      now,
    });
    const ms = performance.now() - t0;
    expect(rows).toHaveLength(200);
    expect(plants.length).toBeGreaterThan(0);
    expect(plants.length).toBeLessThan(50_000);
    expect(ms).toBeLessThan(2000);
  });
});

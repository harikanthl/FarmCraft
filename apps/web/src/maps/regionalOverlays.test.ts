import { describe, expect, it } from "vitest";
import {
  ACTIVE_THEMATIC_OVERLAY_IDS,
  isActiveThematicOverlay,
  thematicOverlayLabel,
  thematicOverlayPaint,
  type ThematicOverlayId,
} from "./regionalOverlays";

describe("regionalOverlays", () => {
  it("lists five active overlays", () => {
    expect(ACTIVE_THEMATIC_OVERLAY_IDS).toHaveLength(5);
  });

  it("thematicOverlayPaint returns rgba-ready strings", () => {
    for (const id of ACTIVE_THEMATIC_OVERLAY_IDS) {
      const p = thematicOverlayPaint(id);
      expect(p["fill-color"]).toMatch(/^#/);
      expect(p["fill-opacity"]).toBeGreaterThan(0);
      expect(p["fill-opacity"]).toBeLessThan(1);
    }
  });

  it("isActiveThematicOverlay narrows union", () => {
    const x: ThematicOverlayId = "off";
    expect(isActiveThematicOverlay(x)).toBe(false);
    const y: ThematicOverlayId = "yield";
    expect(isActiveThematicOverlay(y)).toBe(true);
    if (isActiveThematicOverlay(y)) {
      expect(thematicOverlayLabel(y).length).toBeGreaterThan(0);
    }
  });
});

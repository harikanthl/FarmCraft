/** Farm-bound thematic tint modes (regional PMTiles layers hook in here later). */
export type ThematicOverlayId = "off" | "yield" | "disease" | "irrigation" | "rainfall" | "soil";

export const ACTIVE_THEMATIC_OVERLAY_IDS: Exclude<ThematicOverlayId, "off">[] = [
  "yield",
  "disease",
  "irrigation",
  "rainfall",
  "soil",
];

const LABELS: Record<Exclude<ThematicOverlayId, "off">, string> = {
  yield: "Yield",
  disease: "Disease",
  irrigation: "Irrigation",
  rainfall: "Rainfall",
  soil: "Soil",
};

const FILL: Record<Exclude<ThematicOverlayId, "off">, string> = {
  yield: "#22c55e",
  disease: "#ef4444",
  irrigation: "#0ea5e9",
  rainfall: "#6366f1",
  soil: "#a16207",
};

export function thematicOverlayLabel(mode: Exclude<ThematicOverlayId, "off">): string {
  return LABELS[mode];
}

/** Paint for a semi-transparent fill layered above the active farm polygon. */
export function thematicOverlayPaint(mode: Exclude<ThematicOverlayId, "off">): {
  "fill-color": string;
  "fill-opacity": number;
} {
  return {
    "fill-color": FILL[mode],
    "fill-opacity": 0.28,
  };
}

export function isActiveThematicOverlay(
  id: ThematicOverlayId,
): id is Exclude<ThematicOverlayId, "off"> {
  return id !== "off";
}

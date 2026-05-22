import type { Plant } from "@farmdots/shared";

export type MarkerPalette = {
  fill: string;
  stroke: string;
};

/** Single mapper Plant → visual style (PRD §8.3) */
export function plantMarkerStyle(plant: Plant): MarkerPalette {
  if (plant.diseaseIssues && plant.diseaseIssues.length > 0) {
    return { fill: "#dc2626", stroke: "#991b1b" };
  }
  if (plant.wateringIssues && plant.wateringIssues.length > 0) {
    return { fill: "#2563eb", stroke: "#1d4ed8" };
  }
  if (plant.dripIssues && plant.dripIssues.length > 0) {
    return { fill: "#ea580c", stroke: "#c2410c" };
  }
  switch (plant.healthStatus) {
    case "healthy":
      return { fill: "#16a34a", stroke: "#15803d" };
    case "waterIssue":
      return { fill: "#2563eb", stroke: "#1d4ed8" };
    case "disease":
      return { fill: "#dc2626", stroke: "#991b1b" };
    case "dripIssue":
      return { fill: "#ea580c", stroke: "#c2410c" };
    default:
      return { fill: "#64748b", stroke: "#475569" };
  }
}

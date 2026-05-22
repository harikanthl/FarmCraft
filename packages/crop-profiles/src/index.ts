/** Static crop templates for spacing hints, risk tags, and UI theming (note3.md §4.1). */

export const CROP_PROFILE_IDS = [
  "mango",
  "banana",
  "coconut",
  "chili",
  "guava",
  "papaya",
] as const;

export type CropProfileId = (typeof CROP_PROFILE_IDS)[number];

export type CropProfile = {
  id: CropProfileId;
  name: string;
  idealPlantSpacingM: number;
  idealRowSpacingM: number;
  wateringHint: string;
  /** Months (1–12) where humidity-driven fungal pressure is elevated for this crop. */
  highHumidityRiskMonths: number[];
  diseaseRisks: string[];
  expectedYieldRange: string;
  visualTheme: "orchard" | "monsoon" | "tropical" | "row";
};

const base = (partial: Omit<CropProfile, "id" | "name"> & { id: CropProfileId; name: string }): CropProfile => ({
  ...partial,
});

export const CROP_PROFILES: Record<CropProfileId, CropProfile> = {
  mango: base({
    id: "mango",
    name: "Mango",
    idealPlantSpacingM: 10,
    idealRowSpacingM: 12,
    wateringHint: "Deep, infrequent irrigation once fruit is set; reduce before harvest.",
    highHumidityRiskMonths: [6, 7, 8, 9, 10],
    diseaseRisks: ["anthracnose", "powdery mildew", "bacterial black spot"],
    expectedYieldRange: "Highly variable by age and variety — plan by tree canopy load.",
    visualTheme: "orchard",
  }),
  banana: base({
    id: "banana",
    name: "Banana",
    idealPlantSpacingM: 2.5,
    idealRowSpacingM: 3,
    wateringHint: "Consistent soil moisture; avoid long dry spells between sucker cycles.",
    highHumidityRiskMonths: [5, 6, 7, 8, 9, 10, 11],
    diseaseRisks: ["Panama disease", "Sigatoka leaf spot", "bunchy top"],
    expectedYieldRange: "Bunch weight per mat — track by mat age.",
    visualTheme: "tropical",
  }),
  coconut: base({
    id: "coconut",
    name: "Coconut",
    idealPlantSpacingM: 7.5,
    idealRowSpacingM: 9,
    wateringHint: "Coastal sandy soils need steady moisture; inland: basin irrigation in dry months.",
    highHumidityRiskMonths: [6, 7, 8, 9],
    diseaseRisks: ["bud rot", "leaf rot", "red palm weevil (monitor)"],
    expectedYieldRange: "Nuts per palm per year increases with maturity to a plateau.",
    visualTheme: "tropical",
  }),
  chili: base({
    id: "chili",
    name: "Chili",
    idealPlantSpacingM: 0.45,
    idealRowSpacingM: 1.2,
    wateringHint: "Even moisture during flowering; reduce humidity in canopy where possible.",
    highHumidityRiskMonths: [7, 8, 9, 10],
    diseaseRisks: ["die-back / anthracnose", "bacterial wilt", "mite pressure in heat"],
    expectedYieldRange: "Per plant fresh weight — row density drives totals.",
    visualTheme: "row",
  }),
  guava: base({
    id: "guava",
    name: "Guava",
    idealPlantSpacingM: 5,
    idealRowSpacingM: 6,
    wateringHint: "Avoid waterlogging; light, frequent irrigation in fruiting season.",
    highHumidityRiskMonths: [6, 7, 8, 9, 10],
    diseaseRisks: ["fruit fly", "algal leaf spot", "wilt"],
    expectedYieldRange: "Per tree by canopy management and pruning cycle.",
    visualTheme: "orchard",
  }),
  papaya: base({
    id: "papaya",
    name: "Papaya",
    idealPlantSpacingM: 2,
    idealRowSpacingM: 2.5,
    wateringHint: "Regular moisture; very sensitive to standing water — slope or beds.",
    highHumidityRiskMonths: [6, 7, 8, 9],
    diseaseRisks: ["ringspot virus (vector control)", "Phytophthora root rot", "powdery mildew"],
    expectedYieldRange: "Short cycle — plan replacement stools.",
    visualTheme: "row",
  }),
};

export function isCropProfileId(id: string): id is CropProfileId {
  return (CROP_PROFILE_IDS as readonly string[]).includes(id);
}

export function getCropProfile(id: string | null | undefined): CropProfile | null {
  if (!id || !isCropProfileId(id)) return null;
  return CROP_PROFILES[id];
}

/** Suggested grid wizard spacing from crop template (meters). */
export function gridSpacingFromCropProfile(p: CropProfile): { rowSpacingM: number; plantSpacingM: number } {
  return {
    rowSpacingM: p.idealRowSpacingM,
    plantSpacingM: p.idealPlantSpacingM,
  };
}

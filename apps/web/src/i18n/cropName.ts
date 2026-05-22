import { getCropProfile, type CropProfileId } from "@farmdots/crop-profiles";
import { useTranslation } from "react-i18next";

/**
 * Resolves the user-facing crop label for the active locale, falling back to the
 * canonical English `CROP_PROFILES` name when a translation is missing. Canonical
 * `cropId` values stay stable in storage; only the display layer localizes
 * ([lang.md](lang.md) §13).
 */
export function useCropName(cropId: CropProfileId | string | null | undefined): string {
  const { t } = useTranslation("crops");
  if (!cropId) return "";
  const fallback = getCropProfile(cropId as CropProfileId)?.name ?? cropId;
  const key = `crop.${cropId}`;
  const value = t(key, { defaultValue: fallback });
  return typeof value === "string" ? value : fallback;
}

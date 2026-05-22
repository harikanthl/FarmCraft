import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CROP_PROFILES as STATIC_FALLBACK,
  type CropProfile,
  type CropProfileId,
} from "@farmdots/crop-profiles";

type ApiCrop = {
  id: string;
  name: string;
  idealPlantSpacingM: number;
  idealRowSpacingM: number;
  wateringHint: string;
  highHumidityRiskMonths: number[];
  diseaseRisks: string[];
  expectedYieldRange: string;
  visualTheme: CropProfile["visualTheme"];
};

function normalizeCrop(row: ApiCrop): CropProfile {
  return {
    id: row.id as CropProfileId,
    name: row.name,
    idealPlantSpacingM: row.idealPlantSpacingM,
    idealRowSpacingM: row.idealRowSpacingM,
    wateringHint: row.wateringHint,
    highHumidityRiskMonths: row.highHumidityRiskMonths,
    diseaseRisks: row.diseaseRisks,
    expectedYieldRange: row.expectedYieldRange,
    visualTheme: row.visualTheme,
  };
}

/**
 * Hydrates from `GET /api/v1/crops` when online; falls back to static
 * `@farmdots/crop-profiles` when offline or on failure.
 */
export function useCropProfiles(): {
  cropProfiles: Record<CropProfileId, CropProfile>;
  cropIds: CropProfileId[];
  getCropProfile: (id?: string | null) => CropProfile | undefined;
  remoteLoaded: boolean;
} {
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteMap, setRemoteMap] = useState<Partial<Record<CropProfileId, CropProfile>>>({});

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/crops")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { crops: ApiCrop[] }) => {
        if (cancelled || !Array.isArray(body.crops)) return;
        const next: Partial<Record<CropProfileId, CropProfile>> = {};
        for (const row of body.crops) {
          try {
            next[row.id as CropProfileId] = normalizeCrop(row);
          } catch {
            /* skip malformed rows */
          }
        }
        setRemoteMap(next);
        setRemoteLoaded(true);
      })
      .catch(() => {
        /* keep static fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cropProfiles = useMemo(() => {
    const merged = { ...STATIC_FALLBACK };
    for (const id of Object.keys(remoteMap) as CropProfileId[]) {
      const row = remoteMap[id];
      if (row) merged[id] = row;
    }
    return merged;
  }, [remoteMap]);

  const cropIds = useMemo(() => Object.keys(cropProfiles) as CropProfileId[], [cropProfiles]);

  const getCropProfile = useCallback(
    (id?: string | null) => {
      if (!id) return undefined;
      return cropProfiles[id as CropProfileId];
    },
    [cropProfiles],
  );

  return { cropProfiles, cropIds, getCropProfile, remoteLoaded };
}

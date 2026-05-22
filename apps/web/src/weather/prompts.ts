import { getCropProfile, type CropProfile } from "@farmdots/crop-profiles";
import type { WeatherCurrentPayload, WeatherForecastPayload } from "./weatherClient";

export type WeatherPrompt = { id: string; severity: "info" | "warn" | "alert"; message: string };

const HUMIDITY_HIGH = 80;
const WIND_STORM_MS = 12;
const RAIN_NEXT_24H_POP = 0.45;

function isFungalRiskMonth(profile: CropProfile, monthIso: number): boolean {
  return profile.highHumidityRiskMonths.includes(monthIso);
}

/** Soft, copy-only prompts for the user — never auto-mutates schedules (note3 §4.2). */
export function buildWeatherPrompts(input: {
  current: WeatherCurrentPayload | null;
  forecast: WeatherForecastPayload | null;
  primaryCropId?: string | null;
  now?: Date;
}): WeatherPrompt[] {
  const prompts: WeatherPrompt[] = [];
  const now = input.now ?? new Date();
  const month = now.getMonth() + 1;
  const profile = getCropProfile(input.primaryCropId);

  const humidity = input.current?.main?.humidity;
  if (typeof humidity === "number" && humidity >= HUMIDITY_HIGH) {
    if (profile && isFungalRiskMonth(profile, month)) {
      prompts.push({
        id: "humidity-fungal-crop",
        severity: "warn",
        message: `Humidity ${Math.round(humidity)}%. Fungal pressure is seasonal for ${profile.name} now — inspect canopy and review prophylactic schedules.`,
      });
    } else {
      prompts.push({
        id: "humidity-high",
        severity: "info",
        message: `Humidity ${Math.round(humidity)}% — fungal risk on susceptible crops; consider extra inspection.`,
      });
    }
  }

  const wind = input.current?.wind?.speed;
  if (typeof wind === "number" && wind >= WIND_STORM_MS) {
    prompts.push({
      id: "wind-storm",
      severity: "alert",
      message: `High wind ${Math.round(wind)} m/s — secure trellises and check tall stands (banana, papaya).`,
    });
  }

  if (input.forecast?.list?.length) {
    const cutoff = Math.floor((now.getTime() + 24 * 3600_000) / 1000);
    const nowS = Math.floor(now.getTime() / 1000);
    const next24h = input.forecast.list.filter((x) => x.dt != null && x.dt >= nowS && x.dt <= cutoff);
    const rainLikely = next24h.some((x) => (x.pop ?? 0) >= RAIN_NEXT_24H_POP);
    if (rainLikely) {
      const cropTag = profile ? ` for ${profile.name}` : "";
      prompts.push({
        id: "rain-24h",
        severity: "warn",
        message: `Rain is likely in the next 24 hours${cropTag} — review tomorrow's irrigation plan.`,
      });
    }
  }

  return prompts;
}

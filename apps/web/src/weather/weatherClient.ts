/** Weather proxy helpers — keys stay on Worker. */

export type WeatherForecastPayload = {
  list?: Array<{
    dt?: number;
    pop?: number;
    main?: { temp?: number; humidity?: number };
    wind?: { speed?: number };
    rain?: { "3h"?: number };
    weather?: { id?: number; main?: string; description?: string }[];
  }>;
  city?: { name?: string };
} & Record<string, unknown>;

export type WeatherCurrentPayload = {
  main?: { temp?: number; feels_like?: number; humidity?: number; pressure?: number };
  wind?: { speed?: number; deg?: number };
  weather?: { id?: number; main?: string; description?: string; icon?: string }[];
  clouds?: { all?: number };
  rain?: { "1h"?: number };
  dt?: number;
  name?: string;
} & Record<string, unknown>;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** One weather endpoint result + optional human hint when the call fails. */
async function fetchWeatherEndpoint<T>(url: string): Promise<{ data: T | null; hint?: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      let hint: string | undefined;
      try {
        const j = JSON.parse(text) as { error?: string; configured?: boolean };
        if (res.status === 503 && j.configured === false) {
          hint =
            "Weather backend returned 503 — if this persists, restart the worker after upgrading (weather uses Open-Meteo; no API key).";
        } else if (res.status === 502) {
          hint =
            "Weather upstream failed (Open-Meteo). Check lat/lng, network, or try again — see https://open-meteo.com/";
        } else {
          hint = typeof j.error === "string" ? j.error : `Weather API HTTP ${res.status}`;
        }
      } catch {
        hint = `Weather API HTTP ${res.status}`;
      }
      return { data: null, hint };
    }
    return { data: (await res.json()) as T };
  } catch {
    return {
      data: null,
      hint:
        "Cannot reach the API proxy. Start the worker on port 8787 (e.g. from repo root: pnpm dev:web+worker, or pnpm dev:worker in a second terminal while pnpm dev:web runs).",
    };
  }
}

export type FarmWeatherBundle = {
  current: WeatherCurrentPayload | null;
  forecast: WeatherForecastPayload | null;
  /** Set when both current and forecast failed — usually worker down or missing key */
  loadHint?: string;
};

export async function fetchFarmWeatherBundle(lat: number, lng: number): Promise<FarmWeatherBundle> {
  const currentUrl = `/api/v1/weather/current?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
  const forecastUrl = `/api/v1/weather/forecast?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
  const [cur, fc] = await Promise.all([
    fetchWeatherEndpoint<WeatherCurrentPayload>(currentUrl),
    fetchWeatherEndpoint<WeatherForecastPayload>(forecastUrl),
  ]);
  const hasData = cur.data != null || fc.data != null;
  const loadHint = hasData
    ? undefined
    : cur.hint ?? fc.hint ?? "Weather data unavailable.";
  return { current: cur.data, forecast: fc.data, loadHint };
}

export function fetchFarmForecast(lat: number, lng: number): Promise<WeatherForecastPayload | null> {
  return fetchJson<WeatherForecastPayload>(
    `/api/v1/weather/forecast?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  );
}

export function fetchFarmCurrent(lat: number, lng: number): Promise<WeatherCurrentPayload | null> {
  return fetchJson<WeatherCurrentPayload>(
    `/api/v1/weather/current?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  );
}

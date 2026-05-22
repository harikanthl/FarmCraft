/**
 * Open-Meteo (https://open-meteo.com/) — no API key. Responses are mapped to the
 * OpenWeather-like shapes the web app already expects (main/wind/weather, forecast list).
 */

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  precipitation?: number[];
  relative_humidity_2m?: number[];
  wind_speed_10m?: number[];
  weather_code?: number[];
};

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
};

type OpenMeteoResponse = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
  reason?: string;
  error?: boolean;
};

/** WMO weather interpretation codes (subset) → OpenWeather-style main + description */
function wmoToWeather(code: number | undefined): { id: number; main: string; description: string } {
  const c = code ?? 0;
  if (c === 0) return { id: 800, main: "Clear", description: "clear sky" };
  if (c <= 3) return { id: 802, main: "Clouds", description: "partly cloudy" };
  if (c <= 48) return { id: 701, main: "Mist", description: "fog" };
  if (c <= 57) return { id: 500, main: "Drizzle", description: "drizzle" };
  if (c <= 67) return { id: 500, main: "Rain", description: "rain" };
  if (c <= 77) return { id: 600, main: "Snow", description: "snow" };
  if (c <= 82) return { id: 500, main: "Rain", description: "rain showers" };
  if (c <= 86) return { id: 600, main: "Snow", description: "snow showers" };
  if (c <= 99) return { id: 200, main: "Thunderstorm", description: "thunderstorm" };
  return { id: 800, main: "Clear", description: "clear" };
}

type CacheEntry = { at: number; current: Record<string, unknown>; forecast: Record<string, unknown> };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 120_000;

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function buildOpenMeteoUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "precipitation",
      "relative_humidity_2m",
      "wind_speed_10m",
      "weather_code",
    ].join(","),
    forecast_days: "5",
    wind_speed_unit: "ms",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function mapCurrent(raw: OpenMeteoResponse): Record<string, unknown> {
  const cur = raw.current ?? {};
  const w = wmoToWeather(cur.weather_code);
  return {
    main: {
      temp: cur.temperature_2m,
      feels_like: cur.temperature_2m,
      humidity: cur.relative_humidity_2m,
      pressure: undefined,
    },
    wind: { speed: cur.wind_speed_10m, deg: undefined },
    weather: [w],
    clouds: undefined,
    dt: cur.time ? Math.floor(new Date(cur.time).getTime() / 1000) : undefined,
    name: raw.timezone ?? "",
  };
}

function mapForecast(raw: OpenMeteoResponse): { list: Record<string, unknown>[]; city?: { name?: string } } {
  const h = raw.hourly;
  const list: Record<string, unknown>[] = [];
  if (!h?.time?.length) return { list: [], city: { name: raw.timezone } };

  const n = h.time.length;
  for (let i = 0; i < n; i++) {
    const iso = h.time[i];
    const dt = Math.floor(new Date(iso).getTime() / 1000);
    const pop = ((h.precipitation_probability?.[i] ?? 0) as number) / 100;
    const code = h.weather_code?.[i];
    const w = wmoToWeather(code);
    list.push({
      dt,
      pop,
      main: {
        temp: h.temperature_2m?.[i],
        humidity: h.relative_humidity_2m?.[i],
      },
      wind: { speed: h.wind_speed_10m?.[i] },
      rain: h.precipitation?.[i] != null && (h.precipitation[i] as number) > 0 ? { "3h": h.precipitation[i] } : undefined,
      weather: [w],
    });
  }
  return { list, city: { name: raw.timezone } };
}

export async function getOpenMeteoAsOpenWeatherShapes(
  lat: number,
  lng: number,
): Promise<{ current: Record<string, unknown>; forecast: Record<string, unknown> }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("invalid lat/lng");
  }
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { current: hit.current, forecast: hit.forecast };
  }

  const url = buildOpenMeteoUrl(lat, lng);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text.slice(0, 500));
  }
  const raw = JSON.parse(text) as OpenMeteoResponse;
  if (raw.error) {
    throw new Error(raw.reason ?? "open-meteo error");
  }

  const current = mapCurrent(raw);
  const forecast = mapForecast(raw);
  cache.set(key, { at: Date.now(), current, forecast });
  return { current, forecast };
}

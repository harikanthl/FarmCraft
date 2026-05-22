import type { WeatherCurrentPayload, WeatherForecastPayload } from "@/weather/weatherClient";
import { fetchFarmWeatherBundle } from "@/weather/weatherClient";
import { buildWeatherPrompts } from "@/weather/prompts";
import { useWeatherHistory } from "@/weather/useWeatherHistory";
import { CloudRain, Sun, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

type Props = {
  lat: number | null;
  lng: number | null;
  primaryCropId?: string | null;
  farmId?: string | null;
  /** Optional placeholder/skeleton when farm has no centroid yet. */
  inline?: boolean;
};

/** Compact farm-centroid weather panel powered by the Worker proxy. */
export function WeatherStrip({ lat, lng, primaryCropId, farmId, inline }: Props) {
  const [current, setCurrent] = useState<WeatherCurrentPayload | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastPayload | null>(null);
  const [loadHint, setLoadHint] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    setLoaded(false);
    setLoadHint(undefined);
    void fetchFarmWeatherBundle(lat, lng).then(({ current: c, forecast: f, loadHint: h }) => {
      if (cancelled) return;
      setCurrent(c);
      setForecast(f);
      setLoadHint(h);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const prompts = useMemo(
    () => buildWeatherPrompts({ current, forecast, primaryCropId }),
    [current, forecast, primaryCropId],
  );

  const { points: histPoints } = useWeatherHistory(farmId ?? null);
  const sparkData = useMemo(
    () =>
      histPoints
        .filter((p) => p.temp_c != null)
        .map((p, idx) => ({ idx, temp: p.temp_c as number })),
    [histPoints],
  );

  if (lat == null || lng == null) return null;
  if (!loaded) {
    return (
      <div className={`px-3 py-2 text-xs text-slate-500 dark:text-slate-400 ${inline ? "" : "border-b border-slate-200 dark:border-slate-800"}`}>
        Loading weather…
      </div>
    );
  }

  const temp = current?.main?.temp;
  const humidity = current?.main?.humidity;
  const wind = current?.wind?.speed;
  const main = current?.weather?.[0]?.description ?? current?.weather?.[0]?.main ?? "—";

  if (!current && !forecast) {
    return (
      <div
        className={`space-y-1 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 ${inline ? "" : "border-b border-slate-200 dark:border-slate-800"}`}
      >
        <p className="font-medium text-slate-700 dark:text-slate-300">Weather unavailable</p>
        <p className="leading-snug">{loadHint ?? "Ensure the worker is running on port 8787. Weather uses Open-Meteo (no API key)."}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs ${inline ? "" : "border-b border-slate-200 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900/60"}`}>
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
        <Sun className="h-3.5 w-3.5 text-amber-500" aria-hidden /> {temp != null ? `${Math.round(temp)}°C` : "—"}
        <span className="text-slate-500 dark:text-slate-400">· {main}</span>
      </span>
      {humidity != null ? (
        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
          <CloudRain className="h-3.5 w-3.5 text-sky-600" aria-hidden /> {humidity}% RH
        </span>
      ) : null}
      {wind != null ? (
        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
          <Wind className="h-3.5 w-3.5 text-slate-500" aria-hidden /> {wind.toFixed(1)} m/s
        </span>
      ) : null}
      {farmId && sparkData.length >= 2 ? (
        <span className="inline-flex min-w-[72px] max-w-[140px] flex-1 items-center" title="Daily temperature trend (°C)">
          <ResponsiveContainer width="100%" height={28}>
            <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
              <Line type="monotone" dataKey="temp" stroke="#0ea5e9" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </span>
      ) : null}
      {prompts.length === 0 ? null : (
        <ul className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
          {prompts.map((p) => (
            <li
              key={p.id}
              className={
                p.severity === "alert"
                  ? "rounded bg-red-100 px-2 py-0.5 text-red-900 dark:bg-red-950/60 dark:text-red-100"
                  : p.severity === "warn"
                    ? "rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
                    : "rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }
            >
              {p.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

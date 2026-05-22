import { AUTH_TOKEN_KEY } from "@/auth/authClient";
import { useEffect, useState } from "react";

export type WeatherHistoryPoint = {
  captured_at: number;
  temp_c: number | null;
  humidity: number | null;
  wind_ms: number | null;
  precipitation_mm: number | null;
  condition: string | null;
};

export function useWeatherHistory(farmId: string | null, days = 30): {
  points: WeatherHistoryPoint[];
  loading: boolean;
} {
  const [points, setPoints] = useState<WeatherHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!farmId) {
      setPoints([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const token = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    void fetch(`/api/v1/farms/${encodeURIComponent(farmId)}/weather-history?days=${days}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { points: WeatherHistoryPoint[] }) => {
        if (!cancelled && Array.isArray(body.points)) setPoints(body.points);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, days]);

  return { points, loading };
}

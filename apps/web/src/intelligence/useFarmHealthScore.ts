import type { FarmDotsDatabase } from "@/db/types";
import { computeFarmHealthScore, type FarmHealthScore } from "@/intelligence/healthScore";
import { fetchFarmCurrent, fetchFarmForecast } from "@/weather/weatherClient";
import type { WeatherCurrentPayload, WeatherForecastPayload } from "@/weather/weatherClient";
import type { DiseaseEvent, IrrigationEvent, Plant } from "@farmdots/shared";
import { useEffect, useMemo, useState } from "react";

export function useFarmHealthScore(args: {
  db: FarmDotsDatabase;
  farmId: string | null;
  centroid: { lat: number; lng: number } | null;
}): FarmHealthScore | null {
  const { db, farmId, centroid } = args;

  const [plants, setPlants] = useState<Plant[]>([]);
  const [diseaseEvents, setDiseaseEvents] = useState<DiseaseEvent[]>([]);
  const [irrigationEvents, setIrrigationEvents] = useState<IrrigationEvent[]>([]);
  const [current, setCurrent] = useState<WeatherCurrentPayload | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastPayload | null>(null);

  useEffect(() => {
    if (!farmId) {
      setPlants([]);
      return;
    }
    const sub = db.plants.find({ selector: { farmId } }).$.subscribe((docs) => {
      setPlants(docs.map((d) => d.toJSON() as Plant));
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  useEffect(() => {
    if (!farmId) {
      setIrrigationEvents([]);
      return;
    }
    const sub = db.irrigation_events.find({ selector: { farmId } }).$.subscribe((docs) => {
      setIrrigationEvents(docs.map((d) => d.toJSON() as IrrigationEvent));
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  useEffect(() => {
    if (!farmId) {
      setDiseaseEvents([]);
      return;
    }
    const sub = db.disease_events.find().$.subscribe((docs) => {
      setDiseaseEvents(docs.map((d) => d.toJSON() as DiseaseEvent));
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  useEffect(() => {
    if (!centroid) {
      setCurrent(null);
      setForecast(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchFarmCurrent(centroid.lat, centroid.lng),
      fetchFarmForecast(centroid.lat, centroid.lng),
    ]).then(([c, f]) => {
      if (cancelled) return;
      setCurrent(c);
      setForecast(f);
    });
    return () => {
      cancelled = true;
    };
  }, [centroid?.lat, centroid?.lng]);

  return useMemo(() => {
    if (!farmId) return null;
    return computeFarmHealthScore({
      farmId,
      plants,
      diseaseEvents,
      irrigationEvents,
      current,
      forecast,
    });
  }, [farmId, plants, diseaseEvents, irrigationEvents, current, forecast]);
}

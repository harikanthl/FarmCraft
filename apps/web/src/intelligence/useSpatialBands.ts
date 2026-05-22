import type { FarmDotsDatabase } from "@/db/types";
import {
  computeDiseaseRowBands,
  computeIrrigationRowBands,
  computeYieldRowBands,
  type RowBand,
  type SpatialOverlayMode,
  type ValveBand,
} from "@/intelligence/spatialAggregates";
import type { DiseaseEvent, IrrigationEvent, Plant, Row, Valve } from "@farmdots/shared";
import { useEffect, useMemo, useState } from "react";

export function useSpatialBands(args: {
  db: FarmDotsDatabase;
  farmId: string | null;
  mode: SpatialOverlayMode;
}): { rowBands: RowBand[]; valveBands: ValveBand[] } {
  const { db, farmId, mode } = args;
  const [plants, setPlants] = useState<Plant[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [diseaseEvents, setDiseaseEvents] = useState<DiseaseEvent[]>([]);
  const [irrigationEvents, setIrrigationEvents] = useState<IrrigationEvent[]>([]);

  useEffect(() => {
    if (!farmId || mode === "off") return;
    const subP = db.plants.find({ selector: { farmId } }).$.subscribe((docs) => {
      setPlants(docs.map((d) => d.toJSON() as Plant));
    });
    return () => subP.unsubscribe();
  }, [db, farmId, mode]);

  useEffect(() => {
    if (!farmId || mode === "off") return;
    const subR = db.rows.find({ selector: { farmId } }).$.subscribe((docs) => {
      setRows(docs.map((d) => d.toJSON() as Row));
    });
    const subV = db.valves.find({ selector: { farmId } }).$.subscribe((docs) => {
      setValves(docs.map((d) => d.toJSON() as Valve));
    });
    return () => {
      subR.unsubscribe();
      subV.unsubscribe();
    };
  }, [db, farmId, mode]);

  useEffect(() => {
    if (!farmId || mode !== "disease") return;
    const sub = db.disease_events.find().$.subscribe((docs) => {
      setDiseaseEvents(docs.map((d) => d.toJSON() as DiseaseEvent));
    });
    return () => sub.unsubscribe();
  }, [db, farmId, mode]);

  useEffect(() => {
    if (!farmId || mode !== "irrigation") return;
    const sub = db.irrigation_events.find({ selector: { farmId } }).$.subscribe((docs) => {
      setIrrigationEvents(docs.map((d) => d.toJSON() as IrrigationEvent));
    });
    return () => sub.unsubscribe();
  }, [db, farmId, mode]);

  return useMemo(() => {
    if (mode === "off") return { rowBands: [], valveBands: [] };
    if (mode === "yield") return { rowBands: computeYieldRowBands(plants), valveBands: [] };
    if (mode === "disease")
      return { rowBands: computeDiseaseRowBands({ plants, diseaseEvents }), valveBands: [] };
    const irr = computeIrrigationRowBands({ rows, valves, irrigationEvents });
    return { rowBands: irr.rows, valveBands: irr.valves };
  }, [mode, plants, rows, valves, diseaseEvents, irrigationEvents]);
}

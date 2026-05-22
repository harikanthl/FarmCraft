import type {
  DiseaseEvent,
  Farm,
  GeoJsonPolygon,
  IrrigationEvent,
  Plant,
  Row,
  Valve,
} from "@farmdots/shared";

export type Env = {
  DB: D1Database;
  ASSETS: R2Bucket;
  GEMINI_API_KEY?: string;
  /** Legacy shared dev token. Continues to work but new clients use session tokens. */
  AUTH_DEV_TOKEN?: string;
  /** When "true"/"1", `/auth/request-login` returns the code in the response for local testing. */
  AUTH_DEV_MODE?: string;
  /** Verified sender address for Mailchannels delivery of magic-link codes. */
  EMAIL_FROM?: string;
  /** Base URL of the R Plumber analytics service (e.g. https://analytics.farmdots.app). */
  ANALYTICS_R_URL?: string;
  /** Service token sent as `Authorization: Bearer …` when calling Plumber. */
  ANALYTICS_R_TOKEN?: string;
  /** Sarvam AI subscription key for voice STT/TTS/translate (`ai.md` sections 9, 15, 22). */
  SARVAM_API_KEY?: string;
};

export async function loadFarm(db: D1Database, farmId: string): Promise<Farm | null> {
  const row = await db.prepare("SELECT * FROM farms WHERE id = ?").bind(farmId).first<{
    id: string;
    owner_id: string;
    name: string;
    polygon_json: string;
    irrigation_type: string;
    primary_crop_id: string | null;
    created_at: number;
    updated_at: number;
    version: number;
    source_device_id: string | null;
  }>();
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    polygon: JSON.parse(row.polygon_json) as GeoJsonPolygon,
    irrigationType: row.irrigation_type as Farm["irrigationType"],
    primaryCropId: row.primary_crop_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    sourceDeviceId: row.source_device_id ?? undefined,
  };
}

export async function loadRowsForFarm(db: D1Database, farmId: string): Promise<Row[]> {
  const res = await db.prepare("SELECT * FROM rows WHERE farm_id = ?").bind(farmId).all();
  return (res.results ?? []).map(rowToRow);
}

export async function loadPlantsForFarm(db: D1Database, farmId: string): Promise<Plant[]> {
  const res = await db.prepare("SELECT * FROM plants WHERE farm_id = ?").bind(farmId).all();
  return (res.results ?? []).map(rowToPlant);
}

export async function loadValvesForFarm(db: D1Database, farmId: string): Promise<Valve[]> {
  const res = await db.prepare("SELECT * FROM valves WHERE farm_id = ?").bind(farmId).all();
  return (res.results ?? []).map(rowToValve);
}

export async function loadIrrigationForFarm(db: D1Database, farmId: string): Promise<IrrigationEvent[]> {
  const res = await db.prepare("SELECT * FROM irrigation_events WHERE farm_id = ?").bind(farmId).all();
  return (res.results ?? []).map(rowToIrrigation);
}

export async function loadDiseaseForFarm(db: D1Database, farmId: string): Promise<DiseaseEvent[]> {
  const res = await db
    .prepare(
      `SELECT d.* FROM disease_events d
       INNER JOIN plants p ON p.id = d.plant_id
       WHERE p.farm_id = ?`,
    )
    .bind(farmId)
    .all();
  return (res.results ?? []).map(rowToDisease);
}

export async function loadPlant(db: D1Database, plantId: string): Promise<Plant | null> {
  const row = await db.prepare("SELECT * FROM plants WHERE id = ?").bind(plantId).first();
  if (!row) return null;
  return rowToPlant(row as Record<string, unknown>);
}

export async function loadRow(db: D1Database, rowId: string): Promise<Row | null> {
  const row = await db.prepare("SELECT * FROM rows WHERE id = ?").bind(rowId).first();
  if (!row) return null;
  return rowToRow(row as Record<string, unknown>);
}

export async function loadIrrigationForValves(
  db: D1Database,
  farmId: string,
  valveIds: string[],
): Promise<IrrigationEvent[]> {
  if (valveIds.length === 0) return [];
  const placeholders = valveIds.map(() => "?").join(",");
  const res = await db
    .prepare(
      `SELECT * FROM irrigation_events WHERE farm_id = ? AND valve_id IN (${placeholders})`,
    )
    .bind(farmId, ...valveIds)
    .all();
  return (res.results ?? []).map(rowToIrrigation);
}

export async function loadDiseaseForPlant(db: D1Database, plantId: string): Promise<DiseaseEvent[]> {
  const res = await db.prepare("SELECT * FROM disease_events WHERE plant_id = ?").bind(plantId).all();
  return (res.results ?? []).map(rowToDisease);
}

function rowToPlant(r: Record<string, unknown>): Plant {
  return {
    id: String(r.id),
    farmId: String(r.farm_id),
    rowId: String(r.row_id),
    label: String(r.label),
    lat: Number(r.lat),
    lng: Number(r.lng),
    cropType: String(r.crop_type),
    plantedDate: r.planted_date != null ? Number(r.planted_date) : undefined,
    age: r.age != null ? Number(r.age) : undefined,
    yearlyYield: r.yearly_yield != null ? Number(r.yearly_yield) : undefined,
    healthStatus: r.health_status as Plant["healthStatus"],
    wateringIssues: r.watering_issues ? String(r.watering_issues) : undefined,
    diseaseIssues: r.disease_issues ? String(r.disease_issues) : undefined,
    dripIssues: r.drip_issues ? String(r.drip_issues) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    version: Number(r.version),
    sourceDeviceId: r.source_device_id ? String(r.source_device_id) : undefined,
  };
}

function rowToRow(r: Record<string, unknown>): Row {
  return {
    id: String(r.id),
    farmId: String(r.farm_id),
    name: String(r.name),
    orderIndex: Number(r.order_index),
    valveIds: JSON.parse(String(r.valve_ids)) as string[],
    createdAt: Number(r.created_at),
  };
}

function rowToValve(r: Record<string, unknown>): Valve {
  return {
    id: String(r.id),
    farmId: String(r.farm_id),
    name: String(r.name),
    lat: Number(r.lat),
    lng: Number(r.lng),
    connectedRows: JSON.parse(String(r.connected_rows)) as string[],
    status: r.status as Valve["status"],
    notes: r.notes ? String(r.notes) : undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    version: Number(r.version),
    sourceDeviceId: r.source_device_id ? String(r.source_device_id) : undefined,
  };
}

function rowToIrrigation(r: Record<string, unknown>): IrrigationEvent {
  return {
    id: String(r.id),
    valveId: String(r.valve_id),
    farmId: String(r.farm_id),
    startedAt: Number(r.started_at),
    endedAt: r.ended_at != null ? Number(r.ended_at) : undefined,
    issue: r.issue ? String(r.issue) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
  };
}

function rowToDisease(r: Record<string, unknown>): DiseaseEvent {
  return {
    id: String(r.id),
    plantId: String(r.plant_id),
    diseaseType: String(r.disease_type),
    severity: r.severity as DiseaseEvent["severity"],
    treatment: r.treatment ? String(r.treatment) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
    createdAt: Number(r.created_at),
  };
}

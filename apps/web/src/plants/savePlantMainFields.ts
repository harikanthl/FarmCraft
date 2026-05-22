import type { FarmDotsDatabase } from "@/db/types";
import type { PlantMainFormValues } from "@/forms/schemas";
import type { Plant } from "@farmdots/shared";

/** Derive health flag from free-text issue fields (single source of truth for status updates). */
export function derivePlantHealthStatusFromIssueFields(input: {
  diseaseIssues: string;
  wateringIssues: string;
  dripIssues: string;
}): Plant["healthStatus"] {
  if (input.diseaseIssues.trim()) return "disease";
  if (input.wateringIssues.trim()) return "waterIssue";
  if (input.dripIssues.trim()) return "dripIssue";
  return "healthy";
}

function parseYearlyYield(raw: string | undefined): { value: number } | { clear: true } | { error: string } {
  const s = (raw ?? "").trim();
  if (s === "") return { clear: true };
  const n = Number(s);
  if (!Number.isFinite(n)) return { error: "Yearly yield must be a number." };
  return { value: n };
}

/**
 * Persists plant main attributes on the `plants` collection (RxDB).
 * Uses incremental modify so optional fields can be cleared and `version` / `updatedAt` stay consistent.
 */
export async function savePlantMainFields(db: FarmDotsDatabase, plantId: string, data: PlantMainFormValues): Promise<void> {
  const doc = await db.plants.findOne(plantId).exec();
  if (!doc) throw new Error("Plant not found");

  const yieldResult = parseYearlyYield(data.yearlyYield);
  if ("error" in yieldResult) throw new Error(yieldResult.error);

  const wateringIssues = (data.wateringIssues ?? "").trim();
  const diseaseIssues = (data.diseaseIssues ?? "").trim();
  const dripIssues = (data.dripIssues ?? "").trim();
  const notes = (data.notes ?? "").trim();
  const healthStatus = derivePlantHealthStatusFromIssueFields({ diseaseIssues, wateringIssues, dripIssues });

  await doc.incrementalModify((old) => {
    const o = old as unknown as Plant;
    const next = { ...(old as Record<string, unknown>) } as Record<string, unknown>;
    if ("clear" in yieldResult) {
      delete next.yearlyYield;
    } else {
      next.yearlyYield = yieldResult.value;
    }
    if (wateringIssues) next.wateringIssues = wateringIssues;
    else delete next.wateringIssues;
    if (diseaseIssues) next.diseaseIssues = diseaseIssues;
    else delete next.diseaseIssues;
    if (dripIssues) next.dripIssues = dripIssues;
    else delete next.dripIssues;
    if (notes) next.notes = notes;
    else delete next.notes;
    next.healthStatus = healthStatus;
    next.updatedAt = Date.now();
    next.version = o.version + 1;
    return next as typeof old;
  });
}

/** Apply the same main-field payload to many plants (e.g. bulk edit or replicate). Runs sequentially to avoid revision races. */
export async function savePlantMainFieldsForMany(
  db: FarmDotsDatabase,
  plantIds: readonly string[],
  data: PlantMainFormValues,
): Promise<{ succeeded: string[]; failed: { id: string; message: string }[] }> {
  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];
  for (const id of plantIds) {
    try {
      await savePlantMainFields(db, id, data);
      succeeded.push(id);
    } catch (e) {
      failed.push({ id, message: e instanceof Error ? e.message : "Save failed" });
    }
  }
  return { succeeded, failed };
}

import type { FarmDotsDatabase } from "@/db/types";
import { withinBulkMutation } from "@/sync/mutationGateway";

/** Dexie/RxDB struggle with huge `$in` arrays; primary-key bulkRemove is reliable in chunks. */
const CHUNK_SIZE = 500;

async function bulkRemoveIds(
  db: FarmDotsDatabase,
  collection: "plants" | "valves",
  ids: string[],
): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const result = await db[collection].bulkRemove(chunk);
    if (result.error.length > 0) {
      throw new Error(`Removing ${collection} failed (${result.error.length} write errors).`);
    }
  }
}

async function removeDiseaseEventsForPlantIds(db: FarmDotsDatabase, plantIds: string[]): Promise<void> {
  if (plantIds.length === 0) return;
  for (let i = 0; i < plantIds.length; i += CHUNK_SIZE) {
    const chunk = plantIds.slice(i, i + CHUNK_SIZE);
    await db.disease_events.find({ selector: { plantId: { $in: chunk } } }).remove();
  }
}

function isFullFarmPlantSelection(farmPlantIds: Set<string>, selectedIds: string[]): boolean {
  if (farmPlantIds.size === 0 || selectedIds.length !== farmPlantIds.size) return false;
  for (const id of selectedIds) {
    if (!farmPlantIds.has(id)) return false;
  }
  return true;
}

export type RemovePlantsOptions = {
  /** When the selection is every plant on the farm, delete by `farmId` instead of a giant `$in` list. */
  farmId?: string;
  farmPlantIds?: Set<string>;
};

/**
 * Deletes plant documents by id. Uses farm-scoped remove when the selection is the
 * entire farm; otherwise chunked `bulkRemove` by primary key.
 */
export async function removePlantsByIds(
  db: FarmDotsDatabase,
  ids: string[],
  options?: RemovePlantsOptions,
): Promise<void> {
  if (ids.length === 0) return;

  const farmId = options?.farmId;
  const farmPlantIds = options?.farmPlantIds;

  await withinBulkMutation(db, () =>
    db.lockedRun(async () => {
      if (farmId && farmPlantIds && isFullFarmPlantSelection(farmPlantIds, ids)) {
        const allIds = [...farmPlantIds];
        await removeDiseaseEventsForPlantIds(db, allIds);
        await db.plants.find({ selector: { farmId } }).remove();
        return;
      }

      await removeDiseaseEventsForPlantIds(db, ids);
      await bulkRemoveIds(db, "plants", ids);
    }),
  );
}

export async function removeValvesByIds(db: FarmDotsDatabase, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withinBulkMutation(db, () =>
    db.lockedRun(async () => {
      await bulkRemoveIds(db, "valves", ids);
    }),
  );
}

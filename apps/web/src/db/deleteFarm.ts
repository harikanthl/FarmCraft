import type { FarmDotsDatabase } from "@/db/types";
import { withinBulkMutation } from "@/sync/mutationGateway";

const DISEASE_PLANT_CHUNK = 500;

async function removeDiseaseEventsForPlantIds(db: FarmDotsDatabase, plantIds: string[]): Promise<void> {
  for (let i = 0; i < plantIds.length; i += DISEASE_PLANT_CHUNK) {
    const chunk = plantIds.slice(i, i + DISEASE_PLANT_CHUNK);
    await db.disease_events.find({ selector: { plantId: { $in: chunk } } }).remove();
  }
}

/**
 * Cascade-delete a farm and every record that belongs to it:
 *   - disease_events tied to the farm's plants
 *   - irrigation_events for the farm
 *   - plants, rows, valves for the farm
 *   - the farm document itself
 *
 * Order matters: dependents are removed before parents so a sync push
 * that races a delete never sees orphaned rows referencing a missing farm.
 */
export async function deleteFarmCascade(db: FarmDotsDatabase, farmId: string): Promise<void> {
  await withinBulkMutation(db, async () => {
    const plantDocs = await db.plants.find({ selector: { farmId } }).exec();
    const plantIds = plantDocs.map((d) => (d.toJSON() as { id: string }).id);

    if (plantIds.length > 0) {
      await removeDiseaseEventsForPlantIds(db, plantIds);
    }
    await db.irrigation_events.find({ selector: { farmId } }).remove();
    await db.plants.find({ selector: { farmId } }).remove();
    await db.rows.find({ selector: { farmId } }).remove();
    await db.valves.find({ selector: { farmId } }).remove();

    const farmDoc = await db.farms.findOne(farmId).exec();
    if (farmDoc) await farmDoc.remove();
  });
}

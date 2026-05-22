import type { FarmDotsDatabase } from "@/db/types";
import { withinBulkMutation } from "@/sync/mutationGateway";
import { refreshValveConnectionsForFarm } from "@/valves/syncConnectedRows";
import type { Plant, Row } from "@farmdots/shared";

/** Remove all rows/plants for a farm and insert the generated set (local RxDB). */
export async function replaceFarmRowsAndPlants(db: FarmDotsDatabase, farmId: string, rows: Row[], plants: Plant[]) {
  await withinBulkMutation(db, () =>
    db.lockedRun(async () => {
    const oldRows = await db.rows.find({ selector: { farmId } }).exec();
    const oldPlants = await db.plants.find({ selector: { farmId } }).exec();
    const oldPlantIds = oldPlants.map((d) => d.id as string);
    const oldRowIds = oldRows.map((d) => d.id as string);

    if (oldPlantIds.length > 0) {
      const rm = await db.plants.bulkRemove(oldPlantIds);
      if (rm.error.length > 0) {
        throw new Error(`Removing plants failed (${rm.error.length} write errors).`);
      }
    }
    if (oldRowIds.length > 0) {
      const rm = await db.rows.bulkRemove(oldRowIds);
      if (rm.error.length > 0) {
        throw new Error(`Removing rows failed (${rm.error.length} write errors).`);
      }
    }
    if (rows.length > 0) {
      const ins = await db.rows.bulkInsert(rows as unknown as Record<string, unknown>[]);
      if (ins.error.length > 0) {
        throw new Error(`Inserting rows failed (${ins.error.length} write errors).`);
      }
    }
    if (plants.length > 0) {
      const ins = await db.plants.bulkInsert(plants as unknown as Record<string, unknown>[]);
      if (ins.error.length > 0) {
        throw new Error(`Inserting plants failed (${ins.error.length} write errors).`);
      }
    }
    await refreshValveConnectionsForFarm(db, farmId);
    }),
  );
}

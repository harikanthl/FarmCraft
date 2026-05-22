import type { FarmDotsDatabase } from "@/db/types";
import type { Row } from "@farmdots/shared";

/** Keep Valve.connectedRows derived from Row.valveIds (plan: single source on rows). */
export async function refreshValveConnectionsForFarm(db: FarmDotsDatabase, farmId: string) {
  const rowDocs = await db.rows.find({ selector: { farmId } }).exec();
  const rows = rowDocs.map((d) => d.toJSON() as Row);
  const valveDocs = await db.valves.find({ selector: { farmId } }).exec();
  const now = Date.now();
  for (const v of valveDocs) {
    const json = v.toJSON() as { id: string; version: number };
    const connectedRows = rows.filter((r) => r.valveIds.includes(json.id)).map((r) => r.id);
    await v.patch({
      connectedRows,
      updatedAt: now,
      version: json.version + 1,
    });
  }
}

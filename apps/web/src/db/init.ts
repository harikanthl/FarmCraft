import type { FarmDotsDatabase } from "./types.js";
import { createFarmDotsDatabase } from "./types.js";
import { installMutationGateway } from "@/sync/mutationGateway";

let dbPromise: Promise<FarmDotsDatabase> | null = null;

export function getDatabase(): Promise<FarmDotsDatabase> {
  if (!dbPromise) {
    dbPromise = createFarmDotsDatabase().then((db) => {
      installMutationGateway(db);
      return db;
    });
  }
  return dbPromise;
}

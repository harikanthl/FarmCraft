import { z } from "zod";
import { farmSchema, plantSchema, rowSchema, valveSchema } from "./entities.js";

/** Server-assembled snapshot for the farm workspace UI / Konva canvas. */
export const farmWorkspaceSnapshotSchema = z.object({
  farm: farmSchema,
  rows: z.array(rowSchema),
  plants: z.array(
    plantSchema.pick({
      id: true,
      farmId: true,
      rowId: true,
      label: true,
      lat: true,
      lng: true,
      healthStatus: true,
    }),
  ),
  valves: z.array(
    valveSchema.pick({
      id: true,
      farmId: true,
      name: true,
      lat: true,
      lng: true,
      status: true,
    }),
  ),
});

export type FarmWorkspaceSnapshot = z.infer<typeof farmWorkspaceSnapshotSchema>;

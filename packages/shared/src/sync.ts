import { z } from "zod";

export const syncMetaSchema = z.object({
  updatedAt: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  sourceDeviceId: z.string().optional(),
});

export type SyncMeta = z.infer<typeof syncMetaSchema>;

import { z } from "zod";

/** WGS84 GeoJSON Polygon — ring is [lng, lat][] closed loop */
export const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

export type GeoJsonPolygon = z.infer<typeof geoJsonPolygonSchema>;

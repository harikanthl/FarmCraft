import type { Farm, GeoJsonPolygon } from "@farmdots/shared";

/** RxDB farm doc stores polygon as JSON string */
export type FarmDocument = Omit<Farm, "polygon"> & { polygonJson: string };

export function farmToDoc(farm: Farm): FarmDocument {
  const { polygon, ...rest } = farm;
  return {
    ...rest,
    polygonJson: JSON.stringify(polygon),
  };
}

export function farmFromDoc(doc: FarmDocument): Farm {
  const { polygonJson, ...rest } = doc;
  const polygon = JSON.parse(polygonJson) as GeoJsonPolygon;
  return { ...rest, polygon };
}

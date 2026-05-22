import { describe, expect, it } from "vitest";
import { canvasToLngLat, lngLatToCanvas, polygonViewBox } from "./geoTransform";

describe("geoTransform roundtrip", () => {
  const poly = {
    type: "Polygon" as const,
    coordinates: [
      [
        [10, 20],
        [11, 20],
        [11, 21],
        [10, 21],
        [10, 20],
      ],
    ] as [number, number][][],
  };

  it("canvasToLngLat inverts lngLatToCanvas", () => {
    const box = polygonViewBox(poly);
    const w = 640;
    const h = 480;
    const pad = 24;
    const lng = 10.35;
    const lat = 20.4;
    const { x, y } = lngLatToCanvas(lng, lat, box, w, h, pad);
    const back = canvasToLngLat(x, y, box, w, h, pad);
    expect(back.lng).toBeCloseTo(lng, 10);
    expect(back.lat).toBeCloseTo(lat, 10);
  });
});

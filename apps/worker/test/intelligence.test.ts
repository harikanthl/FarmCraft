import { describe, expect, it } from "vitest";

import { sumForecastPrecipMm } from "../src/intelligence/rules.js";

describe("sumForecastPrecipMm", () => {
  it("sums rain buckets inside the forward-looking window", () => {
    const nowSec = 1_000_000;
    const list = [
      { dt: nowSec + 3600, rain: { "3h": 2 } },
      { dt: nowSec + 7200, rain: { "3h": 4 } },
      { dt: nowSec + 99999 * 3600, rain: { "3h": 100 } },
    ];
    expect(sumForecastPrecipMm(list, nowSec, 48)).toBeCloseTo(6);
  });
});

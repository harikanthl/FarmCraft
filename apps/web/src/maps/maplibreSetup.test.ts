import { describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", () => ({
  default: {
    addProtocol: vi.fn(),
  },
}));

vi.mock("pmtiles", () => ({
  Protocol: class {
    tile = vi.fn();
  },
}));

describe("registerMapProtocols", () => {
  it("registers the pmtiles protocol once across repeated calls", async () => {
    vi.resetModules();
    const ml = (await import("maplibre-gl")).default;
    const { registerMapProtocols } = await import("./maplibreSetup");

    registerMapProtocols();
    registerMapProtocols();

    expect(ml.addProtocol).toHaveBeenCalledTimes(1);
    expect(ml.addProtocol).toHaveBeenCalledWith("pmtiles", expect.any(Function));
  });
});

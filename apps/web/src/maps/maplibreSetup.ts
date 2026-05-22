import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

let protocolsInstalled = false;

/** Register custom URL protocols once per page load (PMTiles + MapLibre). */
export function registerMapProtocols(): void {
  if (protocolsInstalled) return;
  protocolsInstalled = true;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
}

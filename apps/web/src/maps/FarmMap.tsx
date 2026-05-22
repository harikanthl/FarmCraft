import type { FarmDotsDatabase } from "@/db/types";
import { farmFromDoc, type FarmDocument } from "@/db/adapters";
import { plantMarkerStyle } from "@/plants/markerStyle";
import { FarmPolygonEditor } from "@/maps/FarmPolygonEditor";
import {
  isActiveThematicOverlay,
  thematicOverlayPaint,
  type ThematicOverlayId,
} from "@/maps/regionalOverlays";
import type { Farm, GeoJsonPolygon, Plant, Valve } from "@farmdots/shared";
import type { StyleSpecification } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";

export type MapInteractionMode = "idle" | "drawFarm" | "placeValve";

export type FlyToTarget = { lat: number; lng: number; seq: number };

type BaseLayerId = "osm" | "satellite" | "terrain";

const RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
    terrain: {
      type: "raster",
      tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
  },
  layers: [
    { id: "osm", type: "raster", source: "osm", layout: { visibility: "visible" } },
    { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
    { id: "terrain", type: "raster", source: "terrain", layout: { visibility: "none" } },
  ],
};

type Props = {
  db: FarmDotsDatabase;
  activeFarmId: string | null;
  mode: MapInteractionMode;
  farmDrawPoints: [number, number][];
  onFarmDrawPoint: (lng: number, lat: number) => void;
  onPlantTap: (plantId: string) => void;
  onPlaceValve: (lng: number, lat: number) => void;
  onSelectFarm?: (farmId: string) => void;
  flyTo?: FlyToTarget | null;
  enablePolygonEdit?: boolean;
  onFarmPolygonEdited?: (polygon: GeoJsonPolygon) => void;
  /** Thematic tint on the active farm polygon (stub until regional PMTiles layers land). */
  thematicOverlay?: ThematicOverlayId;
};

export function FarmMap({
  db,
  activeFarmId,
  mode,
  farmDrawPoints,
  onFarmDrawPoint,
  onPlantTap,
  onPlaceValve,
  onSelectFarm,
  flyTo,
  enablePolygonEdit = false,
  onFarmPolygonEdited,
  thematicOverlay = "off",
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayerId>("osm");
  const [popup, setPopup] = useState<{
    lng: number;
    lat: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  const [farm, setFarm] = useState<Farm | null>(null);
  const [allFarms, setAllFarms] = useState<Farm[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);

  const center = useMemo(() => {
    if (farm?.polygon) {
      const c = turf.centroid(turf.polygon(farm.polygon.coordinates));
      return { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
    }
    return { lat: 12.97, lng: 77.59 };
  }, [farm]);

  const [viewState, setViewState] = useState({
    longitude: center.lng,
    latitude: center.lat,
    zoom: farm ? 16 : 5,
  });

  useEffect(() => {
    setViewState((v) => ({
      ...v,
      longitude: center.lng,
      latitude: center.lat,
      zoom: farm ? 16 : v.zoom,
    }));
  }, [center.lat, center.lng, farm]);

  useEffect(() => {
    if (!flyTo) return;
    setViewState((v) => ({
      ...v,
      longitude: flyTo.lng,
      latitude: flyTo.lat,
      zoom: 16,
    }));
  }, [flyTo?.lng, flyTo?.lat, flyTo?.seq]);

  useEffect(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!activeFarmId) {
      setFarm(null);
      return;
    }
    const sub = db.farms.findOne(activeFarmId).$.subscribe((doc) => {
      if (!doc) {
        setFarm(null);
        return;
      }
      try {
        setFarm(farmFromDoc(doc.toJSON() as Parameters<typeof farmFromDoc>[0]));
      } catch (e) {
        console.error("[FarmDots] Invalid farm document", e);
        setFarm(null);
      }
    });
    return () => sub.unsubscribe();
  }, [db, activeFarmId]);

  useEffect(() => {
    const sub = db.farms.find().$.subscribe((docs) => {
      const farms: Farm[] = [];
      for (const d of docs) {
        try {
          farms.push(farmFromDoc(d.toJSON() as FarmDocument));
        } catch (e) {
          console.error("[FarmDots] Skipping invalid farm doc", e);
        }
      }
      setAllFarms(farms);
    });
    return () => sub.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!activeFarmId) {
      setPlants([]);
      return;
    }
    const q = db.plants.find({ selector: { farmId: activeFarmId } });
    const sub = q.$.subscribe((docs) => {
      setPlants(docs.map((d) => d.toMutableJSON() as Plant));
    });
    return () => sub.unsubscribe();
  }, [db, activeFarmId]);

  useEffect(() => {
    if (!activeFarmId) {
      setValves([]);
      return;
    }
    const q = db.valves.find({ selector: { farmId: activeFarmId } });
    const sub = q.$.subscribe((docs) => {
      setValves(docs.map((d) => d.toMutableJSON() as Valve));
    });
    return () => sub.unsubscribe();
  }, [db, activeFarmId]);

  useEffect(() => {
    if (!farm?.polygon || !mapRef.current) return;
    const [minX, minY, maxX, maxY] = turf.bbox(turf.polygon(farm.polygon.coordinates));
    mapRef.current.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 48, duration: 400 },
    );
  }, [farm?.polygon, farm?.id]);

  const inactiveFarmsFc = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: allFarms
        .filter((f) => f.id !== activeFarmId)
        .map((f) => ({
          type: "Feature" as const,
          properties: { id: f.id, name: f.name },
          geometry: f.polygon,
        })),
    }),
    [allFarms, activeFarmId],
  );

  const activeFarmFc = useMemo(() => {
    if (!farm?.polygon) return null;
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { name: farm.name },
          geometry: farm.polygon,
        },
      ],
    };
  }, [farm]);

  const previewRing = useMemo(() => {
    if (farmDrawPoints.length === 0) return null;
    const ring = [...farmDrawPoints];
    if (ring.length >= 3) ring.push(ring[0]!);
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: ring },
        },
      ],
    };
  }, [farmDrawPoints]);

  const drawPtsFc = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: farmDrawPoints.map(([lng, lat]) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: [lng, lat] },
      })),
    }),
    [farmDrawPoints],
  );

  const plantsFc = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: plants.map((p) => {
        const style = plantMarkerStyle(p);
        return {
          type: "Feature" as const,
          properties: { id: p.id, label: p.label, stroke: style.stroke, fill: style.fill },
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        };
      }),
    }),
    [plants],
  );

  const valvesFc = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: valves.map((v) => ({
        type: "Feature" as const,
        properties: { id: v.id, name: v.name, status: v.status },
        geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] },
      })),
    }),
    [valves],
  );

  const applyBaseLayer = useCallback((id: BaseLayerId) => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    const layers: BaseLayerId[] = ["osm", "satellite", "terrain"];
    for (const lid of layers) {
      m.setLayoutProperty(lid, "visibility", lid === id ? "visible" : "none");
    }
    setBaseLayer(id);
  }, []);

  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m?.loaded()) return;
    applyBaseLayer(baseLayer);
  }, [applyBaseLayer, baseLayer, mapReady]);

  const handleLayerInteraction = (e: maplibregl.MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) {
      if (mode === "drawFarm") onFarmDrawPoint(e.lngLat.lng, e.lngLat.lat);
      if (mode === "placeValve") onPlaceValve(e.lngLat.lng, e.lngLat.lat);
      setPopup(null);
      return;
    }
    const layerId = f.layer?.id;
    if (layerId === "inactive-farms-fill" && onSelectFarm && f.properties?.id) {
      onSelectFarm(String(f.properties.id));
      return;
    }
    if (layerId === "plants-circle" && f.properties?.id) {
      onPlantTap(String(f.properties.id));
      const coords = (f.geometry as { type: string; coordinates: number[] }).coordinates;
      setPopup({
        lng: coords[0],
        lat: coords[1],
        title: String(f.properties.label ?? "Plant"),
      });
      return;
    }
    if (layerId === "valves-circle") {
      const coords = (f.geometry as { type: string; coordinates: number[] }).coordinates;
      setPopup({
        lng: coords[0],
        lat: coords[1],
        title: String(f.properties?.name ?? "Valve"),
        subtitle: String(f.properties?.status ?? ""),
      });
      return;
    }
    setPopup(null);
  };

  const handleMapClick = (e: maplibregl.MapLayerMouseEvent) => {
    if (!e.features?.length) {
      if (mode === "drawFarm") onFarmDrawPoint(e.lngLat.lng, e.lngLat.lat);
      if (mode === "placeValve") onPlaceValve(e.lngLat.lng, e.lngLat.lat);
      setPopup(null);
    }
  };

  if (!mapReady) {
    return (
      <div className="flex h-full min-h-[240px] w-full items-center justify-center bg-slate-100 text-sm text-slate-600">
        Preparing map…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute left-2 top-[4.75rem] z-10 flex gap-1 rounded-md bg-white/90 p-1 text-[10px] shadow dark:bg-slate-900/90"
        role="group"
        aria-label="Base map layer"
      >
        {(
          [
            ["osm", "Map"],
            ["satellite", "Sat"],
            ["terrain", "Topo"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded px-2 py-0.5 font-medium ${
              baseLayer === id ? "bg-emerald-600 text-white" : "text-slate-700 dark:text-slate-200"
            }`}
            onClick={() => applyBaseLayer(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <Map
        ref={mapRef}
        mapLib={maplibregl}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={() => applyBaseLayer(baseLayer)}
        mapStyle={RASTER_STYLE}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["inactive-farms-fill", "plants-circle", "valves-circle"]}
        onClick={(e) => {
          if (e.features?.length) {
            handleLayerInteraction(e);
            return;
          }
          handleMapClick(e);
        }}
      >
        <NavigationControl position="top-left" showCompass={false} />

        <Source id="inactive-farms" type="geojson" data={inactiveFarmsFc}>
          <Layer
            id="inactive-farms-fill"
            type="fill"
            paint={{
              "fill-color": "#94a3b8",
              "fill-opacity": 0.08,
            }}
          />
          <Layer
            id="inactive-farms-outline"
            type="line"
            paint={{
              "line-color": "#64748b",
              "line-dasharray": [2, 2],
              "line-width": 1.5,
            }}
          />
        </Source>

        {activeFarmFc ? (
          <Source id="active-farm" type="geojson" data={activeFarmFc}>
            <Layer
              id="active-farm-fill"
              type="fill"
              paint={{
                "fill-color": "#15803d",
                "fill-opacity": 0.12,
              }}
            />
            {isActiveThematicOverlay(thematicOverlay) ? (
              <Layer id="active-farm-thematic" type="fill" paint={thematicOverlayPaint(thematicOverlay)} />
            ) : null}
            <Layer
              id="active-farm-outline"
              type="line"
              paint={{
                "line-color": "#15803d",
                "line-width": 2,
              }}
            />
          </Source>
        ) : null}

        {previewRing ? (
          <Source id="preview-ring" type="geojson" data={previewRing}>
            <Layer
              id="preview-line"
              type="line"
              paint={{
                "line-color": "#ca8a04",
                "line-dasharray": [2, 2],
                "line-width": 2,
              }}
            />
          </Source>
        ) : null}

        <Source id="draw-pts" type="geojson" data={drawPtsFc}>
          <Layer
            id="draw-pts-circle"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "#facc15",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ca8a04",
            }}
          />
        </Source>

        <Source id="plants" type="geojson" data={plantsFc}>
          <Layer
            id="plants-circle"
            type="circle"
            paint={{
              "circle-radius": 9,
              "circle-color": ["get", "fill"],
              "circle-stroke-width": 2,
              "circle-stroke-color": ["get", "stroke"],
            }}
          />
        </Source>

        <Source id="valves" type="geojson" data={valvesFc}>
          <Layer
            id="valves-circle"
            type="circle"
            paint={{
              "circle-radius": 11,
              "circle-color": "#0ea5e9",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#0369a1",
            }}
          />
        </Source>

        {farm?.polygon && enablePolygonEdit && onFarmPolygonEdited ? (
          <FarmPolygonEditor polygon={farm.polygon} onEdited={onFarmPolygonEdited} />
        ) : null}

        {popup ? (
          <Popup longitude={popup.lng} latitude={popup.lat} anchor="bottom" onClose={() => setPopup(null)}>
            <div className="text-sm">
              <div className="font-semibold">{popup.title}</div>
              {popup.subtitle ? <div className="text-slate-600">{popup.subtitle}</div> : null}
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}

# PMTiles build pipeline (stub)

This folder documents the intended **Planetiler** basemap + **Tippecanoe** thematic overlay pipeline for FarmDots regional layers.

## Local fallback

From the repo root:

```bash
pnpm tiles:overlays
```

The script logs a stub message. Replace it with your Planetiler / Tippecanoe commands and upload artifacts to R2; the Worker serves them via `GET /tiles/:file` with HTTP Range (see `apps/worker`).

## Container path

`Dockerfile` is a placeholder. For production, pin JVM-based Planetiler and tippecanoe images or multi-stage builds, then wire upload to your bucket.

Suggested artifact names (examples):

- `basemap.pmtiles` — vector basemap
- `overlay-yield.pmtiles`, `overlay-disease.pmtiles`, … — Tippecanoe MBTiles → PMTiles per theme

Web style stub: `apps/web/src/maps/styles/basemap.json` uses a `pmtiles://` source URL pattern to swap in once tiles are hosted.

# FarmDots — R analytics service (Plumber)

Deterministic statistical endpoints called by the Cloudflare Worker BFF only.
The web app never talks to this service directly.

## Endpoints

All endpoints accept a JSON `FarmSnapshot` payload built by the Worker (or
client-pushed to the Worker, never directly) and return a small JSON object.

| Method | Path                          | Purpose                                                |
| ------ | ----------------------------- | ------------------------------------------------------ |
| POST   | `/analytics/farm-score`       | Composite farm score with breakdown                    |
| POST   | `/analytics/yield-forecast`   | Per-row yield band forecast                            |
| POST   | `/analytics/disease-risk`     | Crop/region disease pressure index                     |
| POST   | `/analytics/irrigation-stats` | Valve-level irrigation summary (volume / recency)      |

The Worker reaches the service via:

- `ANALYTICS_R_URL` — base URL (e.g. `https://analytics.farmdots.app`)
- `ANALYTICS_R_TOKEN` — `Authorization: Bearer …` shared secret

## Run locally

```bash
cd apps/analytics-r
Rscript -e "install.packages(c('plumber','jsonlite'), repos='https://cloud.r-project.org')"
Rscript plumber.R
```

Service listens on `:8000` by default. Override with `PORT=…`.

## Docker

```bash
docker build -t farmdots/analytics-r .
docker run -p 8000:8000 -e ANALYTICS_R_TOKEN=dev farmdots/analytics-r
```

## Payload shape (FarmSnapshot)

```json
{
  "farm": { "id": "uuid", "name": "Mango block", "irrigationType": "drip", "primaryCropId": "mango" },
  "plants": [{ "id": "uuid", "rowId": "uuid", "healthStatus": "healthy", "yearlyYield": 120 }],
  "rows":   [{ "id": "uuid" }],
  "valves": [{ "id": "uuid", "connectedRows": ["uuid"] }],
  "irrigationEvents": [{ "valveId": "uuid", "startedAt": 1715800000000, "endedAt": 1715803600000 }],
  "diseaseEvents":    [{ "plantId": "uuid", "severity": "low",  "createdAt": 1715800000000 }],
  "weather": { "humidity": 78, "windSpeed": 4.2 }
}
```

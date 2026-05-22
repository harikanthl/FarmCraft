library(plumber)
library(jsonlite)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

clamp01 <- function(x) {
  if (is.null(x) || length(x) == 0 || is.na(x)) return(0)
  max(0, min(1, x))
}

band_from_score <- function(s) {
  if (s >= 0.66) "good" else if (s >= 0.33) "watch" else "bad"
}

mean_or <- function(x, default = NA_real_) {
  x <- x[is.finite(x)]
  if (length(x) == 0) default else mean(x)
}

check_token <- function(req, res) {
  expected <- Sys.getenv("ANALYTICS_R_TOKEN", unset = "")
  if (nchar(expected) == 0) return(TRUE)
  auth <- req$HTTP_AUTHORIZATION
  if (is.null(auth)) auth <- ""
  ok <- identical(sub("^Bearer\\s+", "", auth, ignore.case = TRUE), expected)
  if (!ok) {
    res$status <- 401
    return(list(error = "unauthorized"))
  }
  TRUE
}

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

#* @apiTitle FarmDots Analytics
#* @apiDescription Deterministic R endpoints fronted by the Cloudflare Worker.

#* Health probe
#* @get /health
function() list(ok = TRUE, service = "farmdots-analytics-r")

#* Composite farm score (mirrors web `computeFarmHealthScore` for parity).
#* @post /analytics/farm-score
function(req, res) {
  ok <- check_token(req, res); if (!isTRUE(ok)) return(ok)
  body <- tryCatch(jsonlite::fromJSON(req$postBody, simplifyVector = FALSE), error = function(e) NULL)
  if (is.null(body)) { res$status <- 400; return(list(error = "invalid json")) }
  plants <- body$plants %||% list()
  diseases <- body$diseaseEvents %||% list()
  irrigations <- body$irrigationEvents %||% list()
  weather <- body$weather %||% list()
  now_ms <- as.numeric(Sys.time()) * 1000

  health_points <- list(healthy = 100, unknown = 70, waterIssue = 40, dripIssue = 40, disease = 20)
  ph <- sapply(plants, function(p) health_points[[p$healthStatus %||% "unknown"]] %||% 60)
  plant_score <- if (length(ph) == 0) 70 else mean(ph)

  denom <- max(length(plants), 1)
  recent <- Filter(function(d) !is.null(d$createdAt) && (now_ms - d$createdAt) <= 30 * 24 * 3600 * 1000, diseases)
  ratio <- length(recent) / denom
  disease_score <- max(0, min(100, 100 - ratio * 500))

  fresh <- Filter(function(e) !is.null(e$startedAt) && (now_ms - e$startedAt) <= 7 * 24 * 3600 * 1000, irrigations)
  irrigation_score <- if (length(irrigations) == 0) 50
                      else if (length(fresh) > 0) 90
                      else 40

  weather_score <- 85
  hum <- weather$humidity %||% NA
  if (!is.na(hum) && hum >= 80) weather_score <- weather_score - min(20, (hum - 80) * 1.5)
  wind <- weather$windSpeed %||% NA
  if (!is.na(wind) && wind >= 12) weather_score <- weather_score - min(20, (wind - 12) * 2)
  weather_score <- max(0, min(100, weather_score))

  composite <- round(plant_score * 0.35 + disease_score * 0.25 + irrigation_score * 0.20 + weather_score * 0.20)
  list(
    score = composite,
    band = if (composite >= 75) "good" else if (composite >= 50) "watch" else "poor",
    breakdown = list(
      plantHealth = round(plant_score),
      disease = round(disease_score),
      irrigation = round(irrigation_score),
      weather = round(weather_score)
    )
  )
}

#* Yield forecast per row from per-plant `yearlyYield` distribution.
#* @post /analytics/yield-forecast
function(req, res) {
  ok <- check_token(req, res); if (!isTRUE(ok)) return(ok)
  body <- tryCatch(jsonlite::fromJSON(req$postBody, simplifyVector = FALSE), error = function(e) NULL)
  if (is.null(body)) { res$status <- 400; return(list(error = "invalid json")) }
  plants <- body$plants %||% list()
  by_row <- list()
  for (p in plants) {
    y <- p$yearlyYield
    if (is.null(y) || !is.numeric(y) || !is.finite(y)) next
    rid <- p$rowId
    if (is.null(rid)) next
    by_row[[rid]] <- c(by_row[[rid]], y)
  }
  rows <- mapply(function(rid, ys) list(rowId = rid, avgYield = mean(ys), n = length(ys)),
                 names(by_row), by_row, SIMPLIFY = FALSE, USE.NAMES = FALSE)
  if (length(rows) == 0) return(list(rows = list(), summary = list(median = NA, n = 0)))
  avgs <- sapply(rows, function(r) r$avgYield)
  mn <- min(avgs); mx <- max(avgs); span <- mx - mn
  rows <- lapply(rows, function(r) {
    s <- if (span > 0) (r$avgYield - mn) / span else 0.5
    r$band <- band_from_score(s)
    r$score <- clamp01(s)
    r
  })
  list(rows = rows, summary = list(median = stats::median(avgs), n = length(avgs)))
}

#* Disease pressure index per crop / row.
#* @post /analytics/disease-risk
function(req, res) {
  ok <- check_token(req, res); if (!isTRUE(ok)) return(ok)
  body <- tryCatch(jsonlite::fromJSON(req$postBody, simplifyVector = FALSE), error = function(e) NULL)
  if (is.null(body)) { res$status <- 400; return(list(error = "invalid json")) }
  diseases <- body$diseaseEvents %||% list()
  weight <- function(sev) if (identical(sev, "high")) 3 else if (identical(sev, "medium")) 2 else 1
  totals <- list()
  for (d in diseases) {
    pid <- d$plantId; if (is.null(pid)) next
    totals[[pid]] <- (totals[[pid]] %||% 0) + weight(d$severity)
  }
  list(
    plantsAffected = length(totals),
    totalSeverity = sum(unlist(totals, use.names = FALSE)),
    perPlant = lapply(names(totals), function(pid) list(plantId = pid, severity = totals[[pid]]))
  )
}

#* Irrigation summary per valve.
#* @post /analytics/irrigation-stats
function(req, res) {
  ok <- check_token(req, res); if (!isTRUE(ok)) return(ok)
  body <- tryCatch(jsonlite::fromJSON(req$postBody, simplifyVector = FALSE), error = function(e) NULL)
  if (is.null(body)) { res$status <- 400; return(list(error = "invalid json")) }
  events <- body$irrigationEvents %||% list()
  by_valve <- list()
  for (e in events) {
    v <- e$valveId; if (is.null(v)) next
    cur <- by_valve[[v]] %||% list(count = 0, totalMs = 0, lastEnd = 0)
    dur <- (e$endedAt %||% e$startedAt) - e$startedAt
    cur$count <- cur$count + 1
    cur$totalMs <- cur$totalMs + max(0, dur)
    cur$lastEnd <- max(cur$lastEnd, e$endedAt %||% e$startedAt)
    by_valve[[v]] <- cur
  }
  list(
    valves = lapply(names(by_valve), function(v) list(
      valveId = v,
      count = by_valve[[v]]$count,
      totalMs = by_valve[[v]]$totalMs,
      lastEndMs = by_valve[[v]]$lastEnd
    ))
  )
}

`%||%` <- function(a, b) if (is.null(a)) b else a

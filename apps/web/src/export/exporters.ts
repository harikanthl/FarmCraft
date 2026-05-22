import type { DiseaseEvent, IrrigationEvent, Plant, Row } from "@farmdots/shared";
import * as XLSX from "xlsx";

function rowsToSheet(rows: Record<string, unknown>[], columns: string[]) {
  const aoa = [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  return ws;
}

export function exportPlantsXlsx(plants: Plant[], filename = "plants.xlsx") {
  const cols = [
    "id",
    "farmId",
    "rowId",
    "label",
    "lat",
    "lng",
    "cropType",
    "yearlyYield",
    "healthStatus",
    "wateringIssues",
    "diseaseIssues",
    "dripIssues",
    "notes",
    "createdAt",
    "updatedAt",
    "version",
  ];
  const wb = XLSX.utils.book_new();
  const asRecords = plants.map((p) => ({ ...p }) as unknown as Record<string, unknown>);
  const ws = rowsToSheet(asRecords, cols);
  XLSX.utils.book_append_sheet(wb, ws, "plants");
  XLSX.writeFile(wb, filename);
}

export function exportRowsCsv(rows: Row[], filename = "rows.csv") {
  const headers = ["id", "farmId", "name", "orderIndex", "valveIds", "createdAt"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.id, r.farmId, JSON.stringify(r.name), r.orderIndex, JSON.stringify(r.valveIds), r.createdAt].join(
        ",",
      ),
    ),
  ];
  downloadText(lines.join("\n"), filename, "text/csv");
}

export function exportIrrigationCsv(events: IrrigationEvent[], filename = "irrigation.csv") {
  const headers = ["id", "valveId", "farmId", "startedAt", "endedAt", "issue", "notes"];
  const lines = [
    headers.join(","),
    ...events.map((e) =>
      [e.id, e.valveId, e.farmId, e.startedAt, e.endedAt ?? "", escapeCsv(e.issue), escapeCsv(e.notes)].join(
        ",",
      ),
    ),
  ];
  downloadText(lines.join("\n"), filename, "text/csv");
}

export function exportDiseaseCsv(events: DiseaseEvent[], filename = "disease.csv") {
  const headers = ["id", "plantId", "diseaseType", "severity", "treatment", "notes", "createdAt"];
  const lines = [
    headers.join(","),
    ...events.map((e) =>
      [
        e.id,
        e.plantId,
        JSON.stringify(e.diseaseType),
        e.severity,
        escapeCsv(e.treatment),
        escapeCsv(e.notes),
        e.createdAt,
      ].join(","),
    ),
  ];
  downloadText(lines.join("\n"), filename, "text/csv");
}

function escapeCsv(s: string | undefined) {
  if (s == null) return "";
  return JSON.stringify(s);
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

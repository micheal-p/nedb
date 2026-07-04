// ── lib/excel-export.ts ─────────────────────────────────────────────────────
// Client-only. Builds a multi-sheet .xlsx from a ReportModel using ExcelJS, with
// the main chart embedded as an image (SheetJS/xlsx cannot embed images — that's
// why this path uses ExcelJS). Sheets:
//   1. Overview  — letterhead, KPIs, summary statistics, embedded chart image
//   2. Full Data — every period with derived analytical columns (YoY, MoM, rolling…)
// The analytical columns mean an analyst can rebuild any chart natively in Excel.

import type { ReportModel } from "@/lib/report-model";

const GREEN = "FF0E7A3C";
const INK = "FF0A0A0A";
const HEADER_BG = "FF0E7A3C";
const ALT_BG = "FFF4F2EC";

function num(v: number | null, dp = 2): number | string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v.toFixed(dp));
}

export async function exportReportXlsx(model: ReportModel, chartPng: string | null) {
  // Loaded on demand so ExcelJS stays out of the main bundle and off the server path.
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NEDB — Energy Commission of Nigeria";
  wb.created = new Date();

  // ── Sheet 1: Overview ──────────────────────────────────────────────────────
  const ov = wb.addWorksheet("Overview", { views: [{ showGridLines: false }] });
  ov.columns = [{ width: 26 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];

  ov.mergeCells("A1:E1");
  const t = ov.getCell("A1");
  t.value = "ENERGY COMMISSION OF NIGERIA — National Energy Data Bank";
  t.font = { bold: true, size: 13, color: { argb: GREEN } };

  ov.mergeCells("A2:E2");
  ov.getCell("A2").value = model.meta.name;
  ov.getCell("A2").font = { bold: true, size: 16, color: { argb: INK } };

  ov.mergeCells("A3:E3");
  ov.getCell("A3").value =
    `${model.meta.sector} · ${model.meta.frequency} · Unit: ${model.meta.unit} · ` +
    `${model.meta.recordCount} records · Generated ${new Date(model.meta.generatedAt).toLocaleString("en-NG")}`;
  ov.getCell("A3").font = { size: 10, color: { argb: "FF5C5650" } };

  // KPI block
  let r = 5;
  ov.getCell(`A${r}`).value = "KEY INDICATORS";
  ov.getCell(`A${r}`).font = { bold: true, size: 11, color: { argb: INK } };
  r++;
  const kpiRows: [string, number | string][] = [
    ["Latest value", `${num(model.kpis.latest)} ${model.meta.unit} (${model.kpis.latestPeriod})`],
    ["Year-on-Year change", model.kpis.yoyPct === null ? "—" : `${model.kpis.yoyPct >= 0 ? "+" : ""}${num(model.kpis.yoyPct, 1)}%`],
    ["Period-on-Period change", model.kpis.popPct === null ? "—" : `${model.kpis.popPct >= 0 ? "+" : ""}${num(model.kpis.popPct, 1)}%`],
    ["CAGR", model.kpis.cagr === null ? "—" : `${model.kpis.cagr >= 0 ? "+" : ""}${num(model.kpis.cagr, 1)}%`],
    ["Rolling average (latest)", num(model.kpis.rolling)],
    ["Minimum", num(model.kpis.min)],
    ["Maximum", num(model.kpis.max)],
    ["Mean", num(model.kpis.mean)],
    ["Volatility (coeff. of variation)", `${num(model.kpis.volatilityPct, 0)}%`],
  ];
  for (const [label, val] of kpiRows) {
    ov.getCell(`A${r}`).value = label;
    ov.getCell(`A${r}`).font = { color: { argb: "FF5C5650" }, size: 10 };
    ov.mergeCells(`B${r}:C${r}`);
    ov.getCell(`B${r}`).value = val;
    ov.getCell(`B${r}`).font = { bold: true, color: { argb: INK }, size: 10 };
    r++;
  }

  // Embedded chart image
  if (chartPng) {
    const imgId = wb.addImage({ base64: chartPng, extension: "png" });
    ov.mergeCells(`A${r + 1}:E${r + 1}`);
    ov.getCell(`A${r + 1}`).value = "TREND CHART";
    ov.getCell(`A${r + 1}`).font = { bold: true, size: 11, color: { argb: INK } };
    ov.addImage(imgId, {
      tl: { col: 0, row: r + 1 },
      ext: { width: 620, height: 300 },
    });
  }

  // ── Sheet 2: Full Data ──────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Full Data", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = [
    "Period", "Region", `Value (${model.meta.unit})`,
    "YoY %", "Period-on-Period %", `Rolling Avg (${model.meta.smoothingWindow}p)`,
    "Cumulative", "Index (base 100)",
  ];
  ws.columns = headers.map((h) => ({ header: h, width: Math.max(12, h.length + 2) }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  model.rows.forEach((row, i) => {
    const xr = ws.addRow([
      row.period,
      row.region,
      Number(row.value.toFixed(4)),
      row.yoyPct === null ? null : Number(row.yoyPct.toFixed(2)),
      row.popPct === null ? null : Number(row.popPct.toFixed(2)),
      row.rolling === null ? null : Number(row.rolling.toFixed(2)),
      Number(row.cumulative.toFixed(2)),
      Number(row.index.toFixed(1)),
    ]);
    if (i % 2 === 1) {
      xr.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_BG } };
      });
    }
  });

  // Footer note sheet
  const notes = wb.addWorksheet("Notes");
  notes.columns = [{ width: 100 }];
  notes.getCell("A1").value = `Source: ${model.meta.sourceAgency ?? "ECN / NEDB"}`;
  notes.getCell("A2").value = "Cite as: ECN-NEDB, " + new Date().getFullYear();
  notes.getCell("A3").value = "YoY compares each period to the same period one year prior. ±derived columns computed at export time from committed records.";
  if (model.meta.whatIs) notes.getCell("A5").value = "What this is: " + model.meta.whatIs;
  if (model.meta.howToRead) notes.getCell("A6").value = "How to read: " + model.meta.howToRead;
  if (model.meta.whyItMatters) notes.getCell("A7").value = "Why it matters: " + model.meta.whyItMatters;

  // Trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NEDB_${model.meta.seriesId}_report.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

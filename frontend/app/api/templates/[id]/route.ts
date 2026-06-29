import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/supabase-server";
import { err } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: series } = await db().from("series_types").select("name, unit_default").eq("id", id).single();
  if (!series) return err("series not found", 404);

  const headers = ["period", "region", "fuel_product", "value", "unit", "source", "notes", "methodology_version"];
  const sample  = ["2023-01", "NGA", "", "12345.67", series.unit_default, "NUPRC", "", "v1"];

  const guide = [
    ["Field", "Required", "Format / Allowed Values", "Example"],
    ["period", "Yes", "YYYY (annual) | YYYY-MM (monthly) | YYYY-QN (quarterly)", "2023-01"],
    ["region", "No", "ISO 3166-2:NG code or NGA for national aggregate", "NGA"],
    ["fuel_product", "No", "PMS, AGO, LPG, Crude, NG, HHK, DPK, ATK, Charcoal, etc.", "PMS"],
    ["value", "Yes", "Numeric (commas allowed)", "12345.67"],
    ["unit", "Yes", `Barrels | Barrels/day | GWh | MW | Litres | Metric Tonnes | etc. (default: ${series.unit_default})`, series.unit_default],
    ["source", "No", "Reporting agency abbreviation", "NUPRC"],
    ["notes", "No", "Free text annotation", "Revised figure"],
    ["methodology_version", "No", "Leave blank for v1", "v1"],
  ];

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wsG = XLSX.utils.aoa_to_sheet(guide);

  // Column widths
  ws["!cols"]  = headers.map(() => ({ wch: 20 }));
  wsG["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 58 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.utils.book_append_sheet(wb, wsG, "Field Guide");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `NEDB_${id}_template.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

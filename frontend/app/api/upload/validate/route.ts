import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/supabase-server";
import { requireAuth, ok, err } from "@/lib/api-helpers";

const VALID_UNITS = new Set([
  "Barrels", "Barrels/day", "MMSCFD", "MMSCF", "Litres", "Metric Tonnes",
  "GWh", "MWh", "MW", "MWh/hr", "MWh/day", "Thousand Barrels",
  "Million Barrels", "BCF", "TCF", "KG", "Tonnes", "Number", "%",
]);

function parsePeriodDate(period: string): string | null {
  // Annual: 2023
  if (/^\d{4}$/.test(period)) return `${period}-01-01`;
  // Monthly: 2023-01
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  // Quarterly: 2023-Q1
  const qm = period.match(/^(\d{4})-Q([1-4])$/);
  if (qm) { const m = (parseInt(qm[2]) - 1) * 3 + 1; return `${qm[1]}-${String(m).padStart(2, "0")}-01`; }
  // Daily: 2023-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  return null;
}

interface ValidatedRow {
  series_type_id: string;
  period: string;
  period_date: string;
  region: string;
  fuel_product: string | null;
  value: number;
  unit: string;
  source: string | null;
  notes: string | null;
  methodology_version: string;
  upload_session_id: number;
}

interface ValidationError {
  row_number: number;
  column_name: string;
  error_type: string;
  error_message: string;
  raw_value?: string | null;
}

function validateRows(rawRows: Record<string, string>[], seriesTypeId: string, sessionId: number) {
  const validRows: ValidatedRow[] = [];
  const errors: ValidationError[] = [];

  rawRows.forEach((raw, i) => {
    const rowNum = i + 2; // 1-indexed, skip header
    const rowErrs: ValidationError[] = [];

    const period   = (raw["period"] ?? "").trim();
    const valueStr = (raw["value"]  ?? "").trim();
    const unit     = (raw["unit"]   ?? "").trim();

    // period
    let periodDate = "";
    if (!period) {
      rowErrs.push({ row_number: rowNum, column_name: "period", error_type: "missing_required", error_message: "period is required" });
    } else {
      const pd = parsePeriodDate(period);
      if (!pd) rowErrs.push({ row_number: rowNum, column_name: "period", error_type: "bad_format", error_message: `cannot parse period "${period}": use YYYY, YYYY-MM, or YYYY-QN`, raw_value: period });
      else periodDate = pd;
    }

    // value
    let value = 0;
    if (!valueStr) {
      rowErrs.push({ row_number: rowNum, column_name: "value", error_type: "missing_required", error_message: "value is required" });
    } else {
      const cleaned = valueStr.replace(/,/g, "");
      const v = parseFloat(cleaned);
      if (isNaN(v)) rowErrs.push({ row_number: rowNum, column_name: "value", error_type: "bad_format", error_message: `value "${valueStr}" is not a number`, raw_value: valueStr });
      else value = v;
    }

    // unit
    if (!unit) {
      rowErrs.push({ row_number: rowNum, column_name: "unit", error_type: "missing_required", error_message: "unit is required" });
    } else if (!VALID_UNITS.has(unit)) {
      rowErrs.push({ row_number: rowNum, column_name: "unit", error_type: "invalid_unit", error_message: `unit "${unit}" is not in the allowed codelist`, raw_value: unit });
    }

    if (rowErrs.length) { errors.push(...rowErrs); return; }

    validRows.push({
      series_type_id: seriesTypeId,
      period,
      period_date: periodDate,
      region: (raw["region"] ?? "NGA").trim() || "NGA",
      fuel_product: (raw["fuel_product"] ?? "").trim() || null,
      value,
      unit,
      source: (raw["source"] ?? "").trim() || null,
      notes:  (raw["notes"]  ?? "").trim() || null,
      methodology_version: (raw["methodology_version"] ?? "v1").trim() || "v1",
      upload_session_id: sessionId,
    });
  });

  return { validRows, errors };
}

export async function POST(req: NextRequest) {
  const claims = await requireAuth(req);
  if (!claims) return err("authentication required", 401);

  const formData = await req.formData().catch(() => null);
  if (!formData) return err("multipart form required", 400);

  const seriesTypeId = formData.get("series_type_id") as string;
  const file = formData.get("file") as File | null;
  if (!seriesTypeId || !file) return err("series_type_id and file are required", 400);

  // Create upload session
  const client = db();
  const { data: session, error: sessErr } = await client
    .from("upload_sessions")
    .insert({ series_type_id: seriesTypeId, filename: file.name, uploaded_by: claims.full_name, status: "pending" })
    .select("id")
    .single();
  if (sessErr || !session) return err("failed to create upload session", 500);

  const sessionId = session.id as number;

  // Parse file
  const buf = await file.arrayBuffer();
  let rawRows: Record<string, string>[] = [];

  try {
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  } catch {
    return err("could not parse file — ensure it is a valid CSV or XLSX", 400);
  }

  if (!rawRows.length) return err("file has no data rows", 400);

  const { validRows, errors } = validateRows(rawRows, seriesTypeId, sessionId);

  const status = errors.length > 0 ? (validRows.length > 0 ? "validated" : "rejected") : "validated";

  // Store validated rows as JSONB so commit can read them without Redis
  await client.from("upload_sessions").update({
    status,
    row_count: validRows.length,
    error_count: errors.length,
    validated_rows: validRows,
  }).eq("id", sessionId);

  // Store validation errors
  if (errors.length) {
    await client.from("validation_errors").insert(
      errors.map((e) => ({ session_id: sessionId, ...e }))
    );
  }

  return ok({
    session_id: sessionId,
    total_rows: rawRows.length,
    valid_rows: validRows.length,
    errors,
    status,
  });
}

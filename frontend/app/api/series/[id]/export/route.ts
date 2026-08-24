import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/supabase-server";
import { authorizeApiCall, getPublished, publicColumns } from "@/lib/api-exposure";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApiCall(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const published = await getPublished(id);
  if (!published) return NextResponse.json({ error: "Series not found or not published for public access." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "csv"; // csv | xlsx
  const region = searchParams.get("region") ?? null;
  const year   = searchParams.get("year")   ?? null;

  const client = db();

  const { data: series } = await client
    .from("series_types")
    .select("id, name, sector, unit_default, frequency")
    .eq("id", id)
    .single();

  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  let query = client
    .from("energy_records")
    .select(publicColumns(published.public_fields).join(", "))
    .eq("series_type_id", id)
    .order("period_date", { ascending: true });

  if (region) query = query.eq("region", region);
  if (year)   query = query.gte("period_date", `${year}-01-01`).lte("period_date", `${year}-12-31`);

  const { data: records } = await query;

  // Column headings follow whatever the administrator published for this
  // series, so the export can never contain a field the API withholds.
  const HEADINGS: Record<string, string> = {
    period: "Period", period_date: "Date", region: "Region", value: "Value",
    unit: "Unit", source: "Source", fuel_product: "Fuel / Product",
  };
  const cols = publicColumns(published.public_fields);
  const rows = ((records ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of cols) out[HEADINGS[c] ?? c] = r[c] ?? "";
    return out;
  });

  const filename = `NEDB_${id}_${year ?? "all"}${region ? `_${region}` : ""}`;

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    // Data sheet
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Metadata sheet
    const meta = XLSX.utils.aoa_to_sheet([
      ["National Energy Data Bank (NEDB)"],
      ["Energy Commission of Nigeria (ECN)"],
      [""],
      ["Series:",    series.name],
      ["Sector:",    series.sector],
      ["Unit:",      series.unit_default],
      ["Frequency:", series.frequency],
      ["Records:",   rows.length],
      ["Exported:",  new Date().toISOString().slice(0, 10)],
      [""],
      ["Source: NEDB — nedb.vercel.app"],
      ["Data is published under the ECN Open Data policy."],
    ]);
    XLSX.utils.book_append_sheet(wb, meta, "Metadata");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: CSV
  const header  = Object.keys(rows[0] ?? {}).join(",");
  const csvRows = rows.map((r) =>
    Object.values(r).map((v) =>
      typeof v === "string" && (v.includes(",") || v.includes('"'))
        ? `"${v.replace(/"/g, '""')}"`
        : v
    ).join(",")
  );
  const csv = [
    `# NEDB — ${series.name} (${series.unit_default}) — Energy Commission of Nigeria`,
    `# Exported: ${new Date().toISOString().slice(0, 10)}`,
    header,
    ...csvRows,
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

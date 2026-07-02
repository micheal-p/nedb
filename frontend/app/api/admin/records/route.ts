import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const series = searchParams.get("series") ?? null;
  const year   = searchParams.get("year")   ?? null;
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

  let query = db()
    .from("energy_records")
    .select("id, series_type_id, period, period_date, region, value, unit, source, notes, created_at")
    .order("period_date", { ascending: false })
    .limit(limit);

  if (series) query = query.eq("series_type_id", series);
  if (year)   query = query.gte("period_date", `${year}-01-01`).lte("period_date", `${year}-12-31`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

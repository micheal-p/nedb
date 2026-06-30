import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatPeriod(period: string): string {
  // "2024-01" → "Jan 2024", "2024-Q1" → "Q1 2024", "2024" → "2024"
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [yr, mo] = period.split("-");
    return `${MONTHS_SHORT[parseInt(mo) - 1]} ${yr}`;
  }
  if (/^\d{4}-Q\d$/.test(period)) {
    const [yr, q] = period.split("-");
    return `${q} ${yr}`;
  }
  return period;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year") ?? "2024";
  const state = searchParams.get("state") ?? null;

  let query = db()
    .from("energy_records")
    .select("series_type_id, period, period_date, value, unit, region, fuel_product, source")
    .gte("period_date", `${year}-01-01`)
    .lte("period_date", `${year}-12-31`)
    .order("period_date");

  if (state) query = query.eq("region", state);

  const { data, error } = await query;
  if (error) return NextResponse.json({}, { status: 500 });

  // Group by series_type_id → [{period, value, unit, source}]
  const grouped: Record<string, { period: string; value: number; unit: string; source?: string }[]> = {};

  for (const row of data ?? []) {
    const key = row.series_type_id as string;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      period: formatPeriod(row.period as string),
      value:  Number(row.value),
      unit:   row.unit as string,
      source: row.source as string | undefined,
    });
  }

  // Also return available years (distinct) for the period navigator
  const { data: yrs } = await db()
    .from("energy_records")
    .select("period_date")
    .order("period_date");

  const years = [...new Set((yrs ?? []).map((r) => new Date(r.period_date as string).getFullYear()))].sort();

  // Summary stats per series (latest value + count)
  const summary: Record<string, { count: number; latest?: number; unit?: string }> = {};
  for (const [key, rows] of Object.entries(grouped)) {
    summary[key] = { count: rows.length, latest: rows[rows.length - 1]?.value, unit: rows[rows.length - 1]?.unit };
  }

  // State-level map: latest value per series × state (region != 'NGA' and not null)
  const { data: stateRows } = await db()
    .from("energy_records")
    .select("series_type_id, region, value, period_date")
    .not("region", "in", '("NGA","","national")')
    .not("region", "is", null)
    .order("period_date");

  // For each series+region keep only the latest record's value
  const latestPerRegion: Record<string, { date: string; value: number }> = {};
  for (const row of stateRows ?? []) {
    const key = `${row.series_type_id}::${row.region}`;
    if (!latestPerRegion[key] || row.period_date > latestPerRegion[key].date) {
      latestPerRegion[key] = { date: row.period_date as string, value: Number(row.value) };
    }
  }
  const stateMap: Record<string, Record<string, number>> = {};
  for (const [key, { value }] of Object.entries(latestPerRegion)) {
    const [seriesId, region] = key.split("::");
    if (!stateMap[seriesId]) stateMap[seriesId] = {};
    stateMap[seriesId][region] = value;
  }

  return NextResponse.json({ series: grouped, years, summary, year, stateMap });
}

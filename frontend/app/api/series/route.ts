import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

export async function GET() {
  // Direct query with count using subquery — works without a stored procedure
  const { data, error } = await db()
    .from("series_types")
    .select(`
      id, name, sector, subsector, unit_default, frequency, viz_types, created_at, description, methodology, source_agency,
      energy_records(count)
    `)
    .order("sector").order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (data ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    record_count: (s.energy_records as { count: number }[])?.[0]?.count ?? 0,
    energy_records: undefined,
  }));

  return NextResponse.json(shaped);
}

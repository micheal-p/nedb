import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { cacheGet, cacheSet } from "@/lib/redis";

const CACHE_KEY = "series:list";
const TTL = 900; // 15 min

export async function GET() {
  const cached = await cacheGet<unknown[]>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

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

  await cacheSet(CACHE_KEY, shaped, TTL);
  return NextResponse.json(shaped);
}

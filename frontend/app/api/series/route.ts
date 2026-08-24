import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { authorizeApiCall } from "@/lib/api-exposure";

const CACHE_KEY = "series:list:public";
const TTL = 900; // 15 min

// GET /api/series — the published catalogue.
// Only series an administrator has published are listed; everything else is
// invisible to the public API, including its existence.
export async function GET(req: NextRequest) {
  const auth = await authorizeApiCall(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const cached = await cacheGet<unknown[]>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const { data, error } = await db()
    .from("series_types")
    .select(`
      id, name, sector, subsector, unit_default, frequency, viz_types, created_at, description, methodology, source_agency, public_note,
      energy_records(count)
    `)
    .eq("is_public", true)
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

import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await db()
    .from("series_types")
    .select(`
      id, name, sector, subsector, unit_default, frequency, viz_types, created_at, description, methodology, source_agency,
      energy_records(count)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return err("series not found", 404);

  const shaped = {
    ...data,
    record_count: (data.energy_records as { count: number }[])?.[0]?.count ?? 0,
    energy_records: undefined,
  };

  return ok(shaped);
}

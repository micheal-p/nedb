import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const page  = Math.max(1, parseInt(sp.get("page")  ?? "1"));
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") ?? "100")));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  let query = db()
    .from("energy_records")
    .select("*", { count: "exact" })
    .eq("series_type_id", id)
    .order("period_date", { ascending: true })
    .range(from, to);

  if (sp.get("region"))      query = query.eq("region", sp.get("region")!);
  if (sp.get("period_from")) query = query.gte("period_date", sp.get("period_from")!);
  if (sp.get("period_to"))   query = query.lte("period_date", sp.get("period_to")!);

  const { data, count } = await query;
  return ok({ rows: data ?? [], total: count ?? 0, page, limit });
}

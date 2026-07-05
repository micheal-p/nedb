import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/lgas?state=Lagos — LGAs for a state (or all 774 without the filter).
// Backs the LGA picker in the manual data-entry form.
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");

  let q = db()
    .from("lgas")
    .select("id, lga_code, name, state_name")
    .order("name");

  if (state) q = q.eq("state_name", state);

  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

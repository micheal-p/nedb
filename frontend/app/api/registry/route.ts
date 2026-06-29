import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";

export async function GET() {
  const { data, error } = await db()
    .from("companies_registry")
    .select("*")
    .order("operator_type")
    .order("company");
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body?.company || !body?.operator_type || !body?.sector)
    return err("company, operator_type and sector are required", 400);

  const { data, error } = await db()
    .from("companies_registry")
    .insert({
      company: body.company,
      oml_blocks: body.oml_blocks ?? null,
      operator_type: body.operator_type,
      sector: body.sector,
      status: body.status ?? "Active",
      created_by: auth.username,
    })
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok(data, 201);
}

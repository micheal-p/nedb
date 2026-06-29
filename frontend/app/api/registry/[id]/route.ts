import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("body required", 400);

  const { data, error } = await db()
    .from("companies_registry")
    .update({
      company: body.company,
      oml_blocks: body.oml_blocks ?? null,
      operator_type: body.operator_type,
      sector: body.sector,
      status: body.status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const { id } = await params;
  const { error } = await db().from("companies_registry").delete().eq("id", id);
  if (error) return err(error.message, 500);
  return ok({ deleted: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { cacheDel } from "@/lib/redis";

// GET /api/pena/forms/:id/responses — filterable response list (staff only).
// Filters: ?state=Lagos&lga=Ikeja&tier=D&income_min=0&income_max=50000
// ?format=csv streams the full filtered set as CSV (internal use — includes PII).
// DELETE ?response_id=N — remove one response (admin only; NDPA removal right).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const { id } = await params;

  const sp = new URL(req.url).searchParams;
  const csv = sp.get("format") === "csv";

  let q = db()
    .from("pena_responses")
    .select("id, answers, state_name, lga_id, lga_name, address_text, lat, lng, email, income, light_hours, energy_expense, tier, created_at", { count: "exact" })
    .eq("form_id", id)
    .order("created_at", { ascending: false });

  if (sp.get("state"))      q = q.eq("state_name", sp.get("state"));
  if (sp.get("lga"))        q = q.eq("lga_name", sp.get("lga"));
  if (sp.get("lga_id"))     q = q.eq("lga_id", sp.get("lga_id"));
  if (sp.get("tier"))       q = q.eq("tier", sp.get("tier"));
  if (sp.get("income_min")) q = q.gte("income", Number(sp.get("income_min")));
  if (sp.get("income_max")) q = q.lte("income", Number(sp.get("income_max")));

  if (!csv) {
    const limit  = Math.min(Number(sp.get("limit") ?? 100), 500);
    const offset = Number(sp.get("offset") ?? 0);
    q = q.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await q;
  if (error) return err(error.message, 500);

  if (csv) {
    // Column set = union of answer keys, in first-seen order, + extracted fields
    const keys: string[] = [];
    for (const r of data ?? []) {
      for (const k of Object.keys(r.answers ?? {})) if (!keys.includes(k)) keys.push(k);
    }
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = [...keys, "state", "lga", "lat", "lng", "tier", "submitted_at"];
    const lines = [head.join(",")];
    for (const r of data ?? []) {
      lines.push([
        ...keys.map((k) => esc((r.answers ?? {})[k])),
        esc(r.state_name), esc(r.lga_name), esc(r.lat), esc(r.lng), esc(r.tier), esc(r.created_at),
      ].join(","));
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pena-${id}-responses.csv"`,
      },
    });
  }

  return ok({ total: count ?? 0, rows: data ?? [] });
}

// DELETE /api/pena/forms/:id/responses?response_id=N — NDPA "right to removal".
// Admin-only; busts the public aggregate cache so the open-data page updates.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);
  const { id } = await params;

  const responseId = new URL(req.url).searchParams.get("response_id");
  if (!responseId) return err("response_id is required");

  const { data: gone, error } = await db()
    .from("pena_responses")
    .delete()
    .eq("form_id", id)
    .eq("id", responseId)
    .select("id")
    .single();
  if (error || !gone) return err("Response not found", 404);

  const { data: form } = await db().from("pena_forms").select("slug").eq("id", id).single();
  if (form?.slug) await cacheDel(`pena:pub:${form.slug}`);

  return ok({ success: true, deleted: gone.id });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { cacheDel } from "@/lib/redis";

// GET /api/pena/forms/:id/responses — filterable response list.
// Filters: ?state=Lagos&lga=Ikeja&tier=D&income_min=0&income_max=50000
// PII policy: admins see everything; non-admin staff get analytics fields
// only — email, address, coordinates and PII-flagged answers are redacted
// (matching the consent promise that personal details stay confidential).
// ?format=csv (admin only) streams the full filtered set, paged past
// PostgREST's 1000-row cap so large surveys are never silently truncated.
// DELETE ?response_id=N — remove one response (admin only; NDPA removal right).

const SELECT = "id, answers, state_name, lga_id, lga_name, address_text, lat, lng, email, income, light_hours, energy_expense, tier, verify_status, created_at";

type Row = {
  id: number; answers: Record<string, unknown>; state_name: string | null; lga_id: number | null;
  lga_name: string | null; address_text: string | null; lat: number | null; lng: number | null;
  email: string | null; income: number | null; light_hours: number | null; energy_expense: number | null;
  tier: string | null; verify_status: string; created_at: string;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const isAdmin = (auth as { role?: string }).role === "admin";
  const { id } = await params;

  const sp = new URL(req.url).searchParams;
  const csv = sp.get("format") === "csv";
  if (csv && !isAdmin) return err("CSV export contains personal data — administrator only.", 403);

  const baseQuery = () => {
    let q = db()
      .from("pena_responses")
      .select(SELECT, { count: "exact" })
      .eq("form_id", id)
      .order("created_at", { ascending: false });
    if (sp.get("state"))      q = q.eq("state_name", sp.get("state"));
    if (sp.get("lga"))        q = q.eq("lga_name", sp.get("lga"));
    if (sp.get("lga_id"))     q = q.eq("lga_id", sp.get("lga_id"));
    if (sp.get("tier"))       q = q.eq("tier", sp.get("tier"));
    if (sp.get("verify"))     q = q.eq("verify_status", sp.get("verify"));
    if (sp.get("income_min")) q = q.gte("income", Number(sp.get("income_min")));
    if (sp.get("income_max")) q = q.lte("income", Number(sp.get("income_max")));
    return q;
  };

  if (csv) {
    // Page through everything — an unranged select caps at 1000 rows and
    // would silently truncate large surveys.
    const all: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await baseQuery().range(from, from + 999);
      if (error) return err(error.message, 500);
      all.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    const keys: string[] = [];
    for (const r of all) {
      for (const k of Object.keys(r.answers ?? {})) if (!keys.includes(k)) keys.push(k);
    }
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = [...keys, "state", "lga", "lat", "lng", "tier", "verify_status", "submitted_at"];
    const lines = [head.join(",")];
    for (const r of all) {
      lines.push([
        ...keys.map((k) => esc((r.answers ?? {})[k])),
        esc(r.state_name), esc(r.lga_name), esc(r.lat), esc(r.lng), esc(r.tier), esc(r.verify_status), esc(r.created_at),
      ].join(","));
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pena-${id}-responses.csv"`,
      },
    });
  }

  const limit  = Math.min(Number(sp.get("limit") ?? 100), 500);
  const offset = Number(sp.get("offset") ?? 0);
  const { data, error, count } = await baseQuery().range(offset, offset + limit - 1);
  if (error) return err(error.message, 500);

  let rows = (data ?? []) as Row[];
  if (!isAdmin) {
    // Redact PII for non-admin staff: direct columns + answers whose
    // question is flagged is_pii.
    const { data: piiQs } = await db()
      .from("pena_questions").select("slug").eq("form_id", id).eq("is_pii", true);
    const piiSlugs = new Set((piiQs ?? []).map((q) => q.slug));
    rows = rows.map((r) => ({
      ...r,
      email: null,
      address_text: null,
      lat: null,
      lng: null,
      answers: Object.fromEntries(Object.entries(r.answers ?? {}).filter(([k]) => !piiSlugs.has(k))),
    }));
  }

  return ok({ total: count ?? 0, rows, redacted: !isAdmin });
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

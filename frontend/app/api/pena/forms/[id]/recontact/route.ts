import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { err, requireAdmin } from "@/lib/api-helpers";
import { logView } from "@/lib/pena-access";

// GET /api/pena/forms/:id/recontact — the wave-two outreach list: contact
// details of respondents who TICKED the follow-up box, and nobody else. CSV,
// administrator only, and logged as an export, because this is exactly the
// kind of identifiable extraction the access log exists for.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Administrator only — the outreach list is identifiable personal data.", 403);
  const { id } = await params;

  const { data: form } = await db().from("pena_forms").select("id, title").eq("id", id).single();
  if (!form) return err("Assessment not found", 404);

  await logView(Number(id), String(admin.username ?? admin.sub ?? "unknown"), "export", true);

  const rows: { email: string | null; state_name: string | null; lga_name: string | null; answers: Record<string, unknown> }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("pena_responses")
      .select("email, state_name, lga_name, answers")
      .eq("form_id", id)
      .eq("verify_status", "verified")
      .eq("recontact_ok", true)
      .order("id")
      .range(from, from + 999);
    if (error) return err(error.message, 500);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const esc = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+@\t\r]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const phoneOf = (a: Record<string, unknown>) => {
    const k = Object.keys(a).find((x) => /phone/i.test(x));
    return k ? a[k] : "";
  };
  const lines = ["email,phone,state,lga"];
  for (const r of rows) lines.push([esc(r.email), esc(phoneOf(r.answers ?? {})), esc(r.state_name), esc(r.lga_name)].join(","));

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recontact-${id}.csv"`,
    },
  });
}

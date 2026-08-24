import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole } from "@/lib/api-helpers";
import { getBulletinData } from "@/lib/bulletin-data";
import { logAudit } from "@/lib/audit";

// GET /api/bulletin/editions — public list of published editions (newest
// first). Staff (editor+) see drafts too when ?all=1.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wantAll = searchParams.get("all") === "1";
  const staff = wantAll ? await requireRole(req, "editor") : null;

  let q = db()
    .from("bulletin_editions")
    .select("id, edition_no, title, period_label, status, data_cutoff, published_at, created_by, published_by")
    .order("edition_no", { ascending: false });
  if (!staff) q = q.eq("status", "published");

  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

// POST /api/bulletin/editions — editor+ creates a draft edition. The current
// committed statistics are frozen into the snapshot at this moment (the data
// cutoff); later uploads do not change the edition.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "editor");
  if (!auth) return err("editor access required", 403);

  const body = await req.json().catch(() => ({}));
  const periodLabel: string = (body.period_label ?? "").trim() || new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  const snapshot = await getBulletinData();

  const { data: last } = await db()
    .from("bulletin_editions")
    .select("edition_no")
    .order("edition_no", { ascending: false })
    .limit(1)
    .single();
  const editionNo = (last?.edition_no ?? 0) + 1;

  const { data, error } = await db()
    .from("bulletin_editions")
    .insert({
      edition_no: editionNo,
      period_label: periodLabel,
      status: "draft",
      snapshot,
      data_cutoff: snapshot.generated_at,
      created_by: String(auth.username ?? auth.sub ?? "unknown"),
    })
    .select("id, edition_no, period_label, status")
    .single();

  if (error) return err(error.message, 500);
  await logAudit({
    action: "BULLETIN_DRAFT",
    performed_by: String(auth.username ?? auth.sub ?? "unknown"),
    notes: `Created bulletin draft No. ${editionNo} (${periodLabel})`,
  });
  return ok(data, 201);
}

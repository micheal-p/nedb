import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// GET    /api/papers/:no — the full paper (published, or any for admins).
// PATCH  /api/papers/:no — admin: publish/unpublish, title, authors.
// DELETE /api/papers/:no — admin: drafts only. A published paper is part of
//        the record; it can be withdrawn from view but never erased.
// The :no segment is the numeric suffix of the paper number (e.g. "01" of
// NEDB/WP/2026/01) plus the year — passed as "2026-01".

function toPaperNo(seg: string): string | null {
  const m = seg.match(/^(\d{4})-(\d{2,})$/);
  return m ? `NEDB/WP/${m[1]}/${m[2]}` : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const paperNo = toPaperNo(no);
  if (!paperNo) return err("Not found", 404);
  const admin = await requireAdmin(req);

  const { data: p } = await db()
    .from("working_papers")
    .select("paper_no, title, authors, status, published_at, created_at, body, data_vintages(label, checksum)")
    .eq("paper_no", paperNo)
    .single();
  if (!p || (p.status !== "published" && !admin)) return err("Not found", 404);
  return ok({ ...p, vintage: (p.data_vintages as unknown as { label: string; checksum: string } | null) ?? null, data_vintages: undefined });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);
  const { no } = await params;
  const paperNo = toPaperNo(no);
  if (!paperNo) return err("Not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const patch: Record<string, unknown> = {};
  if (body.title?.trim()) patch.title = body.title.trim();
  if (body.authors !== undefined) patch.authors = body.authors?.trim() || null;
  if (body.status === "published") { patch.status = "published"; patch.published_at = new Date().toISOString(); }
  if (body.status === "draft") { patch.status = "draft"; }
  if (!Object.keys(patch).length) return err("nothing to do");

  const { data: p, error } = await db()
    .from("working_papers").update(patch).eq("paper_no", paperNo)
    .select("paper_no, title, status, published_at").single();
  if (error || !p) return err(error?.message ?? "Not found", error ? 500 : 404);

  if (body.status) {
    await logAudit({
      action: body.status === "published" ? "PAPER_PUBLISHED" : "PAPER_WITHDRAWN",
      performed_by: String(admin.username ?? admin.sub ?? "unknown"),
      notes: `${body.status === "published" ? "Published" : "Withdrew"} working paper ${paperNo} ("${p.title}")`,
    });
  }
  return ok(p);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);
  const { no } = await params;
  const paperNo = toPaperNo(no);
  if (!paperNo) return err("Not found", 404);

  const { data: gone, error } = await db()
    .from("working_papers").delete().eq("paper_no", paperNo).eq("status", "draft")
    .select("paper_no").single();
  if (error || !gone) return err("Only draft papers can be deleted — withdraw a published one instead.", 400);
  await logAudit({ action: "PAPER_DELETED", performed_by: String(admin.username ?? admin.sub ?? "unknown"), notes: `Deleted draft working paper ${paperNo}` });
  return ok({ success: true });
}

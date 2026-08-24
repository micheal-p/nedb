import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

// GET /api/bulletin/stories — published stories are public; ?all=1 shows
// drafts to editors and above.
export async function GET(req: NextRequest) {
  const wantAll = new URL(req.url).searchParams.get("all") === "1";
  const staff = wantAll ? await requireRole(req, "editor") : null;

  let q = db()
    .from("bulletin_stories")
    .select("id, slug, title, standfirst, sector, edition_no, status, author, published_at, created_at, created_by")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!staff) q = q.eq("status", "published");

  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

// POST /api/bulletin/stories — editor drafts a story
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "editor");
  if (!auth) return err("editor access required", 403);

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) return err("title is required");

  const base = slugify(title) || `story-${Date.now()}`;
  // Slugs are permanent public URLs, so collisions get a numeric suffix rather
  // than overwriting somebody else's piece.
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await db().from("bulletin_stories").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await db()
    .from("bulletin_stories")
    .insert({
      slug, title,
      standfirst: String(body?.standfirst ?? "").trim() || null,
      body: String(body?.body ?? ""),
      sector: body?.sector || null,
      edition_no: body?.edition_no ?? null,
      author: String(body?.author ?? "").trim() || null,
      status: "draft",
      created_by: String(auth.username ?? auth.sub ?? "unknown"),
    })
    .select("id, slug, title, status")
    .single();

  if (error) return err(error.message, 500);
  await logAudit({
    action: "STORY_DRAFT",
    performed_by: String(auth.username ?? auth.sub ?? "unknown"),
    notes: `Drafted story "${title}"`,
  });
  return ok(data, 201);
}

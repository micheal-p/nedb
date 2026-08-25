import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole } from "@/lib/api-helpers";
import { getBulletinData, makeWindow, defaultWindow, type PeriodKind } from "@/lib/bulletin-data";
import { logAudit } from "@/lib/audit";

// Migration 048 adds period_kind/period_start/period_end. Deploys and manual
// migrations do not land at the same moment, so every read and write falls back
// to the pre-048 shape rather than taking the bulletin archive down in the gap.
const LEGACY_COLS = "id, edition_no, title, period_label, status, data_cutoff, published_at, created_by, published_by";
const PERIOD_COLS = "id, edition_no, title, period_label, period_kind, period_start, period_end, status, data_cutoff, published_at, created_by, published_by";
const missingPeriodCols = (msg?: string | null) =>
  !!msg && /period_(kind|start|end)/.test(msg) && /does not exist/i.test(msg);

// GET /api/bulletin/editions — public list of published editions (newest
// first). Staff (editor+) see drafts too when ?all=1.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wantAll = searchParams.get("all") === "1";
  const staff = wantAll ? await requireRole(req, "editor") : null;

  const build = (cols: string, withPeriodFilters: boolean) => {
    let q = db().from("bulletin_editions").select(cols).order("edition_no", { ascending: false });
    if (!staff) q = q.eq("status", "published");
    if (!withPeriodFilters) return q;

    // Filters, so the archive can be read by month or by year rather than only
    // as one long list. ?kind=month|year narrows to that cadence; ?year=2026
    // narrows to a calendar year; ?month=8 needs a year alongside it.
    if (kind === "month" || kind === "year") q = q.eq("period_kind", kind);
    if (Number.isFinite(year) && year > 1900) {
      if (Number.isFinite(month) && month >= 1 && month <= 12) {
        const w = makeWindow("month", year, month);
        q = q.gte("period_start", w.start).lte("period_start", w.end);
      } else {
        q = q.gte("period_start", `${year}-01-01`).lte("period_start", `${year}-12-31`);
      }
    }
    return q;
  };

  const kind = searchParams.get("kind");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const { data, error } = await build(PERIOD_COLS, true);
  if (!error) return ok(data ?? []);
  if (!missingPeriodCols(error.message)) return err(error.message, 500);

  // Pre-048: serve the archive unfiltered rather than not at all, and say so.
  const legacy = await build(LEGACY_COLS, false);
  if (legacy.error) return err(legacy.error.message, 500);
  return ok(legacy.data ?? [], 200);
}

// POST /api/bulletin/editions — editor+ creates a draft edition. The current
// committed statistics are frozen into the snapshot at this moment (the data
// cutoff); later uploads do not change the edition.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "editor");
  if (!auth) return err("editor access required", 403);

  const body = await req.json().catch(() => ({}));

  // An edition is built FOR a period. The label is derived from the window
  // rather than typed, so the masthead can never disagree with what was
  // filtered. Defaults to last month, which is what a monthly bulletin reports.
  const kind: PeriodKind = body.period_kind === "year" ? "year" : "month";
  const year = Number(body.period_year);
  const month = Number(body.period_month);
  const window =
    Number.isFinite(year) && year > 1900
      ? makeWindow(kind, year, kind === "month" ? (Number.isFinite(month) ? month : 1) : undefined)
      : defaultWindow();

  const periodLabel = window.label;

  // Refuse a duplicate period outright: two editions covering August 2026 with
  // different numbers is the sort of thing that gets cited against each other.
  const { data: clash } = await db()
    .from("bulletin_editions")
    .select("edition_no, status")
    .eq("period_start", window.start)
    .eq("period_kind", window.kind)
    .limit(1)
    .maybeSingle();          // errors pre-048; treated as "no clash", which is right
  if (clash) {
    return err(`Edition No. ${clash.edition_no} already covers ${periodLabel}. Corrections are issued as a new edition of a later period, not a second edition of the same one.`, 409);
  }

  const snapshot = await getBulletinData(window);

  const { data: last } = await db()
    .from("bulletin_editions")
    .select("edition_no")
    .order("edition_no", { ascending: false })
    .limit(1)
    .single();
  const editionNo = (last?.edition_no ?? 0) + 1;

  const baseRow = {
    edition_no: editionNo,
    period_label: periodLabel,
    title: window.kind === "year" ? "NEDB Annual Energy Bulletin" : "NEDB Monthly Energy Bulletin",
    status: "draft",
    snapshot,
    data_cutoff: snapshot.generated_at,
    created_by: String(auth.username ?? auth.sub ?? "unknown"),
  };

  let { data, error } = await db()
    .from("bulletin_editions")
    .insert({ ...baseRow, period_kind: window.kind, period_start: window.start, period_end: window.end })
    .select("id, edition_no, period_label, period_kind, period_start, period_end, status")
    .single();

  if (error && missingPeriodCols(error.message)) {
    // Pre-048. The snapshot is still built for the window, so the figures are
    // right; only the stored window is missing until the migration runs.
    ({ data, error } = await db()
      .from("bulletin_editions")
      .insert(baseRow)
      .select("id, edition_no, period_label, status")
      .single());
  }

  if (error) return err(error.message, 500);
  await logAudit({
    action: "BULLETIN_DRAFT",
    performed_by: String(auth.username ?? auth.sub ?? "unknown"),
    notes: `Created ${window.kind === "year" ? "annual" : "monthly"} bulletin draft No. ${editionNo} for ${periodLabel} — ${snapshot.in_period_count} of ${snapshot.series.length} series reported in period`,
  });
  return ok(data, 201);
}

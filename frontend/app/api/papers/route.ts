import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { analyse } from "@/lib/pena-analysis";
import { buildSeriesEvidence, SERIES_PAPER_PROMPT_RULES } from "@/lib/series-paper";
import { geminiConfigured, geminiGenerate } from "@/lib/gemini";
import { citedRecordIds } from "@/lib/records-ground";
import { buildPublicAggregates } from "@/lib/pena-public";
import { K_ANON_MIN, type PenaTier } from "@/lib/pena";
import { logAudit } from "@/lib/audit";

// GET  /api/papers — published working papers, newest first (admin sees all).
// POST /api/papers — generate one (admin). Two kinds:
//   assessment (default): the PENA analysis engine writes findings from the
//     k-anonymised aggregates. Fully deterministic.
//   series: the AI research kind. lib/series-paper.ts builds the evidence —
//     record lines and derived figures, every one carrying its [rec N]
//     marker — and Gemini writes ONLY the words over it. Regenerate against
//     a newer vintage and the paper improves because its evidence did; the
//     model still cannot state a number the bank does not hold. Both kinds
//     stay drafts until a person reads and publishes them.

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  let q = db()
    .from("working_papers")
    .select("paper_no, title, authors, status, published_at, created_at, vintage_id, data_vintages(label, checksum)")
    .order("created_at", { ascending: false });
  if (!admin) q = q.eq("status", "published");
  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok((data ?? []).map((p) => ({
    ...p,
    vintage: (p.data_vintages as unknown as { label: string; checksum: string } | null) ?? null,
    data_vintages: undefined,
  })));
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);
  const who = String(admin.username ?? admin.sub ?? "unknown");

  const body = await req.json().catch(() => null);

  // ── Series kind: AI-written over deterministic evidence ──────────────────
  if (body?.kind === "series") {
    if (!geminiConfigured()) return err("Series papers need the writing engine — set GEMINI_API_KEY.", 503);
    const seriesIds: string[] = Array.isArray(body.series_ids) ? body.series_ids.map(String).slice(0, 8) : [];
    if (!seriesIds.length) return err("series_ids is required — pick up to 8 published series.");

    let vintage: { id: number; label: string; checksum: string; snapshot?: unknown } | null = null;
    if (body.vintage_id) {
      const { data: v } = await db()
        .from("data_vintages").select("id, label, checksum, snapshot").eq("id", Number(body.vintage_id)).single();
      if (!v) return err("Vintage not found", 404);
      vintage = v;
    }

    const evidence = await buildSeriesEvidence(
      seriesIds,
      (vintage?.snapshot ?? null) as Parameters<typeof buildSeriesEvidence>[1]
    );
    if (!evidence.records.length) return err("None of the chosen series hold national records to write from.");

    const prompt = `${SERIES_PAPER_PROMPT_RULES}

EVIDENCE:
${evidence.contextLines}`;

    let narrative: string | null = null;
    try {
      narrative = await geminiGenerate(prompt);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Writing failed", 502);
    }
    if (!narrative) return err("The writing engine returned nothing — try again.", 502);

    // Citation audit: which stated markers resolve to real evidence records.
    const stated = citedRecordIds(narrative);
    const known = new Set(evidence.records.map((r) => r.id));
    const unverified = stated.filter((id) => !known.has(id));

    const year = new Date().getFullYear();
    const prefix = `NEDB/WP/${year}/`;
    const { count } = await db()
      .from("working_papers").select("id", { count: "exact", head: true }).like("paper_no", `${prefix}%`);
    const paper_no = `${prefix}${String((count ?? 0) + 1).padStart(2, "0")}`;

    const { data: row, error } = await db()
      .from("working_papers")
      .insert({
        paper_no,
        title: body.title?.trim() || `The state of ${evidence.series.map((x) => x.name).join(", ")}`,
        authors: body.authors?.trim() || null,
        vintage_id: vintage?.id ?? null,
        pena_form_id: null,
        body: {
          kind: "series",
          generated_at: new Date().toISOString(),
          vintage: vintage ? { label: vintage.label, checksum: vintage.checksum } : null,
          series: evidence.series,
          narrative,
          cited_records: evidence.records.filter((r) => stated.includes(r.id)),
          unverified_markers: unverified,
          methods: {
            evidence: "Committed national records of the named series, with derived year-on-year, maximum and minimum figures computed deterministically by the platform. The language model wrote the prose only; it performed no calculation.",
            citation: "Every figure carries a [rec N] marker naming the committed record it was copied from. Markers that matched no record are listed and flagged rather than hidden.",
            review: "Machine-drafted, human-published: the paper stays a draft until an administrator has read it in full.",
          },
        },
        status: "draft",
        created_by: who,
      })
      .select("paper_no, title, status, created_at")
      .single();
    if (error) return err(error.message, 500);

    await logAudit({ action: "PAPER_GENERATED", performed_by: who, notes: `Generated series working paper ${paper_no} (${seriesIds.join(", ")})${vintage ? ` against vintage ${vintage.label}` : ""}${unverified.length ? ` — ${unverified.length} unverified marker(s) flagged` : ""}` });
    return ok({ ...row, unverified_markers: unverified }, 201);
  }

  const formId = Number(body?.pena_form_id);
  if (!formId) return err("pena_form_id is required");

  const { data: form } = await db()
    .from("pena_forms").select("id, title, slug, is_public_stats, status, target_population, setting").eq("id", formId).single();
  if (!form) return err("Assessment not found", 404);
  if (!form.is_public_stats || form.status === "draft")
    return err("Only published assessments can become working papers — their aggregates must already be open data.");

  let vintage: { id: number; label: string; checksum: string } | null = null;
  if (body?.vintage_id) {
    const { data: v } = await db()
      .from("data_vintages").select("id, label, checksum").eq("id", Number(body.vintage_id)).single();
    if (!v) return err("Vintage not found", 404);
    vintage = v;
  }

  const agg = await buildPublicAggregates(form.id);
  if (agg.collecting)
    return err(`Below the ${K_ANON_MIN}-response privacy floor (${agg.total_responses} verified) — no findings can be published yet.`);

  const analysis = analyse({
    title: body?.title?.trim() || form.title,
    total: agg.total_responses,
    stats: agg.stats!,
    tier_distribution: (agg.tier_distribution ?? []).map((t) => ({ tier: t.tier as PenaTier, count: t.count })),
    by_state: agg.by_state.map((s) => ({
      name: s.name, count: s.count, avg_income: s.avg_income,
      avg_light_hours: s.avg_light_hours, avg_energy_expense: s.avg_energy_expense, tiers: s.tiers,
    })),
    energy_sources: agg.energy_sources,
  });

  // Sequence: NEDB/WP/yyyy/01, 02, …
  const year = new Date().getFullYear();
  const prefix = `NEDB/WP/${year}/`;
  const { count } = await db()
    .from("working_papers").select("id", { count: "exact", head: true }).like("paper_no", `${prefix}%`);
  const paper_no = `${prefix}${String((count ?? 0) + 1).padStart(2, "0")}`;

  const paperBody = {
    generated_at: new Date().toISOString(),
    assessment: { id: form.id, slug: form.slug, title: form.title },
    vintage: vintage ? { label: vintage.label, checksum: vintage.checksum } : null,
    summary: analysis.summary,
    findings: analysis.findings,
    caveats: analysis.caveats,
    aggregates: {
      total_responses: agg.total_responses,
      stats: agg.stats,
      tier_distribution: agg.tier_distribution,
      energy_sources: agg.energy_sources,
      by_state: agg.by_state,
    },
    methods: {
      instrument: "PENA — Profiling & Energy Needs Assessment, structured field questionnaire",
      population: form.target_population
        ? `${form.target_population}${form.setting ? ` (${form.setting} setting)` : ""}. Respondents who completed the assessment; verified responses only. Not a probability sample of Nigeria.`
        : "Respondents who completed the assessment; verified responses only. Not a probability sample of Nigeria.",
      tier_method: "Deterministic A–E classification from daily supply hours and energy burden (energy expense ÷ income); thresholds stored with the form.",
      privacy: `k-anonymity floor of ${K_ANON_MIN}: any state or LGA group under ${K_ANON_MIN} responses is suppressed. Personal data withheld under NDPA 2023; the consent statement each respondent accepted is stored with their response.`,
    },
  };

  const { data: row, error } = await db()
    .from("working_papers")
    .insert({
      paper_no,
      title: body?.title?.trim() || `${form.title}: findings`,
      authors: body?.authors?.trim() || null,
      vintage_id: vintage?.id ?? null,
      pena_form_id: form.id,
      body: paperBody,
      status: "draft",
      created_by: who,
    })
    .select("paper_no, title, status, created_at")
    .single();
  if (error) return err(error.message, 500);

  await logAudit({ action: "PAPER_GENERATED", performed_by: who, notes: `Generated working paper ${paper_no} from "${form.title}"${vintage ? ` against vintage ${vintage.label}` : ""}` });
  return ok(row, 201);
}

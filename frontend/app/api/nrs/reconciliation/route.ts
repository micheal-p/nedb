import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { reconcile, type Declaration, type Telemetry } from "@/lib/reconciliation";
import { verifyChain } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

async function referenceFx(req: NextRequest): Promise<number | null> {
  try {
    const origin = new URL(req.url).origin;
    const r = await fetch(`${origin}/api/cbn-rate`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = await r.json();
    const rate = Number(j?.rate ?? j?.usd_ngn ?? j?.value);
    return Number.isFinite(rate) && rate > 100 ? rate : null;
  } catch {
    return null;
  }
}

async function loadPeriod(period: string) {
  const [{ data: decl }, { data: tele }] = await Promise.all([
    db().from("company_declarations")
      .select("company_name, oml_block, period, kind, volume, volume_unit, value_usd, value_ngn, fx_rate, supersedes_id, id")
      .eq("period", period),
    db().from("telemetry_readings")
      .select("company_name, oml_block, period, metric, value, unit, quality")
      .eq("period", period),
  ]);

  // A superseded entry must not be counted twice — the correction replaces it.
  const superseded = new Set((decl ?? []).map((d) => d.supersedes_id).filter(Boolean) as number[]);
  const live = (decl ?? []).filter((d) => !superseded.has(d.id as number)) as unknown as Declaration[];
  return { declarations: live, telemetry: (tele ?? []) as Telemetry[] };
}

// GET /api/nrs/reconciliation?period=2026-07 — run the engine (read-only).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("authentication required", 401);

  const period = new URL(req.url).searchParams.get("period");
  if (!period) return err("period is required, e.g. ?period=2026-07");

  const [{ declarations, telemetry }, fx, chain] = await Promise.all([
    loadPeriod(period),
    referenceFx(req),
    verifyChain(),
  ]);

  const result = reconcile(period, declarations, telemetry, fx);
  return ok({ ...result, chain });
}

// POST /api/nrs/reconciliation — run and STORE the outcome, so a finding can
// be cited later exactly as it stood when it was raised.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required to record a reconciliation run", 403);

  const body = await req.json().catch(() => null);
  const period = String(body?.period ?? "");
  if (!period) return err("period is required");

  const [{ declarations, telemetry }, fx] = await Promise.all([loadPeriod(period), referenceFx(req)]);
  const result = reconcile(period, declarations, telemetry, fx);

  const { data, error } = await db()
    .from("reconciliation_runs")
    .insert({
      period,
      fx_rate: fx,
      findings: result.findings,
      total_checked: result.checked,
      total_flagged: result.findings.length,
      run_by: String(admin.username ?? admin.sub ?? "unknown"),
    })
    .select("id, run_at")
    .single();
  if (error) return err(error.message, 500);

  await logAudit({
    action: "RECONCILIATION_RUN",
    performed_by: String(admin.username ?? admin.sub ?? "unknown"),
    period,
    notes: `Reconciliation for ${period} — ${result.checked} entities checked, ${result.findings.length} findings`,
  });

  return ok({ run_id: data.id, run_at: data.run_at, ...result }, 201);
}

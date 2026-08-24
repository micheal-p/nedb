// ── lib/reconciliation.ts ───────────────────────────────────────────────────
// The reconciliation engine.
//
// For a period it lines up, per company and OML block, four independent
// pictures of the same activity:
//
//   declared production   (what the company filed)
//   metered production    (what the telemetry measured)
//   declared sales/export (what the company says it sold)
//   tax and royalty paid  (what the revenue service received)
//
// and reports where they disagree by more than tolerance. Every monetary
// comparison is done in BOTH currencies: an upstream sale is priced in dollars
// while the assessment is raised in naira, so a single-currency check either
// misses an FX-driven gap or invents one.

export type Declaration = {
  company_name: string;
  oml_block: string | null;
  period: string;
  kind: string;
  volume: number | null;
  volume_unit: string | null;
  value_usd: number | null;
  value_ngn: number | null;
  fx_rate: number | null;
};

export type Telemetry = {
  company_name: string | null;
  oml_block: string | null;
  period: string;
  metric: string;
  value: number;
  unit: string;
  quality: string;
};

export type Finding = {
  company: string;
  oml: string | null;
  severity: "high" | "medium" | "low";
  code: string;
  headline: string;
  detail: string;
  declared?: number | null;
  measured?: number | null;
  variancePct?: number | null;
};

export type ReconResult = {
  period: string;
  fxRate: number | null;
  checked: number;
  findings: Finding[];
  units: {
    company: string;
    oml: string | null;
    production: number | null;
    metered: number | null;
    sales: number | null;
    exportVol: number | null;
    salesUsd: number | null;
    salesNgn: number | null;
    taxNgn: number | null;
    royaltyNgn: number | null;
    effectiveRatePct: number | null;
  }[];
};

/** Volume tolerance before a gap is worth reporting (metering is not exact). */
const VOLUME_TOLERANCE_PCT = 3;
/** FX tolerance: a filing converted at a rate this far from the reference. */
const FX_TOLERANCE_PCT = 5;

const key = (c: string, o: string | null) => `${c}||${o ?? ""}`;
const pct = (a: number, b: number) => (b === 0 ? null : ((a - b) / Math.abs(b)) * 100);

export function reconcile(
  period: string,
  declarations: Declaration[],
  telemetry: Telemetry[],
  fxRate: number | null
): ReconResult {
  const groups = new Map<string, { company: string; oml: string | null }>();
  for (const d of declarations) groups.set(key(d.company_name, d.oml_block), { company: d.company_name, oml: d.oml_block });
  for (const t of telemetry) if (t.company_name) groups.set(key(t.company_name, t.oml_block), { company: t.company_name, oml: t.oml_block });

  const findings: Finding[] = [];
  const units: ReconResult["units"] = [];

  const sum = (rows: { volume?: number | null; value_usd?: number | null; value_ngn?: number | null }[], f: "volume" | "value_usd" | "value_ngn") =>
    rows.reduce((a, r) => a + Number(r[f] ?? 0), 0) || null;

  for (const [k, g] of groups) {
    const mine = declarations.filter((d) => key(d.company_name, d.oml_block) === k);
    const meters = telemetry.filter((t) => t.company_name && key(t.company_name, t.oml_block) === k);

    const production = sum(mine.filter((d) => d.kind === "production"), "volume");
    const sales      = sum(mine.filter((d) => d.kind === "sales"), "volume");
    const exportVol  = sum(mine.filter((d) => d.kind === "export"), "volume");
    const salesUsd   = sum(mine.filter((d) => d.kind === "sales" || d.kind === "export"), "value_usd");
    const salesNgn   = sum(mine.filter((d) => d.kind === "sales" || d.kind === "export"), "value_ngn");
    const taxNgn     = sum(mine.filter((d) => d.kind === "tax_paid"), "value_ngn");
    const royaltyNgn = sum(mine.filter((d) => d.kind === "royalty_paid"), "value_ngn");

    const meteredRows = meters.filter((t) => t.metric === "production" && t.quality !== "missing");
    const metered = meteredRows.length ? meteredRows.reduce((a, t) => a + Number(t.value), 0) : null;

    // ── 1. Declared production vs metered production ─────────────────────
    if (production !== null && metered !== null) {
      const v = pct(production, metered);
      if (v !== null && Math.abs(v) > VOLUME_TOLERANCE_PCT) {
        findings.push({
          company: g.company, oml: g.oml,
          severity: Math.abs(v) > 10 ? "high" : "medium",
          code: "PROD_VS_METER",
          headline: `Declared production is ${Math.abs(v).toFixed(1)}% ${v > 0 ? "above" : "below"} metered volume`,
          detail: `Declared ${production.toLocaleString()} against ${metered.toLocaleString()} measured by telemetry for ${period}. Tolerance is ${VOLUME_TOLERANCE_PCT}%.`,
          declared: production, measured: metered, variancePct: v,
        });
      }
    } else if (production !== null && metered === null) {
      findings.push({
        company: g.company, oml: g.oml, severity: "low", code: "NO_METER",
        headline: "No telemetry to verify this declaration against",
        detail: `Production of ${production.toLocaleString()} was declared for ${period} with no metered readings on file. The figure is unverified.`,
        declared: production, measured: null, variancePct: null,
      });
    } else if (production === null && metered !== null) {
      findings.push({
        company: g.company, oml: g.oml, severity: "high", code: "MISSING_DECLARATION",
        headline: "Metered production with no declaration filed",
        detail: `Telemetry recorded ${metered.toLocaleString()} for ${period} but no production declaration was filed.`,
        declared: null, measured: metered, variancePct: null,
      });
    }

    // ── 2. Sales and export cannot exceed what was produced ──────────────
    const disposed = (sales ?? 0) + (exportVol ?? 0);
    if (production !== null && disposed > 0) {
      const v = pct(disposed, production);
      if (v !== null && v > VOLUME_TOLERANCE_PCT) {
        findings.push({
          company: g.company, oml: g.oml, severity: "high", code: "DISPOSAL_EXCEEDS_PRODUCTION",
          headline: `Sales and exports exceed declared production by ${v.toFixed(1)}%`,
          detail: `${disposed.toLocaleString()} disposed against ${production.toLocaleString()} produced in ${period}. Either production is understated or volumes were carried over from a prior period without disclosure.`,
          declared: disposed, measured: production, variancePct: v,
        });
      }
    }

    // ── 3. Dual-currency check on the filing itself ──────────────────────
    for (const d of mine) {
      if (d.value_usd && d.value_ngn && d.fx_rate) {
        const implied = d.value_ngn / d.value_usd;
        const v = pct(implied, d.fx_rate);
        if (v !== null && Math.abs(v) > 1) {
          findings.push({
            company: g.company, oml: g.oml, severity: "medium", code: "FX_INTERNAL_MISMATCH",
            headline: "Naira and dollar amounts do not agree with the stated FX rate",
            detail: `A ${d.kind} filing states ${d.value_usd.toLocaleString()} USD and ${d.value_ngn.toLocaleString()} NGN at ${d.fx_rate}, which implies ${implied.toFixed(2)} — a ${Math.abs(v).toFixed(1)}% difference.`,
            variancePct: v,
          });
        }
      }
      if (fxRate && d.fx_rate) {
        const v = pct(d.fx_rate, fxRate);
        if (v !== null && Math.abs(v) > FX_TOLERANCE_PCT) {
          findings.push({
            company: g.company, oml: g.oml, severity: "medium", code: "FX_OFF_REFERENCE",
            headline: `Filing converted at a rate ${Math.abs(v).toFixed(1)}% off the reference rate`,
            detail: `A ${d.kind} filing used ${d.fx_rate} NGN/USD against a reference of ${fxRate.toFixed(2)}. A favourable rate understates the naira base the assessment is raised on.`,
            variancePct: v,
          });
        }
      }
    }

    // ── 4. Effective rate: what actually reached the revenue service ─────
    const revenueBaseNgn = salesNgn ?? (salesUsd && fxRate ? salesUsd * fxRate : null);
    const paid = (taxNgn ?? 0) + (royaltyNgn ?? 0);
    const effectiveRatePct = revenueBaseNgn && revenueBaseNgn > 0 ? (paid / revenueBaseNgn) * 100 : null;

    if (revenueBaseNgn && revenueBaseNgn > 0 && paid === 0) {
      findings.push({
        company: g.company, oml: g.oml, severity: "high", code: "NO_REMITTANCE",
        headline: "Revenue declared with no tax or royalty remitted",
        detail: `₦${Math.round(revenueBaseNgn).toLocaleString()} of sales or export revenue was declared for ${period} with no tax or royalty payment recorded against it.`,
      });
    } else if (effectiveRatePct !== null && effectiveRatePct < 5) {
      findings.push({
        company: g.company, oml: g.oml, severity: "medium", code: "LOW_EFFECTIVE_RATE",
        headline: `Effective remittance is ${effectiveRatePct.toFixed(1)}% of declared revenue`,
        detail: `₦${Math.round(paid).toLocaleString()} remitted against ₦${Math.round(revenueBaseNgn!).toLocaleString()} declared. Low relative to peers — worth an assessment review, not necessarily an irregularity.`,
        variancePct: effectiveRatePct,
      });
    }

    // ── 5. Metering quality ──────────────────────────────────────────────
    const suspect = meters.filter((t) => t.quality === "suspect").length;
    if (suspect > 0) {
      findings.push({
        company: g.company, oml: g.oml, severity: "low", code: "SUSPECT_TELEMETRY",
        headline: `${suspect} metered reading${suspect === 1 ? "" : "s"} flagged as suspect`,
        detail: "Readings flagged by the device or the ingest pipeline. Verification against these readings is weakened until they are resolved.",
      });
    }

    units.push({
      company: g.company, oml: g.oml,
      production, metered, sales, exportVol, salesUsd, salesNgn, taxNgn, royaltyNgn, effectiveRatePct,
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return { period, fxRate, checked: groups.size, findings, units };
}

"use client";

// ── NrsCompliance ───────────────────────────────────────────────────────────
// The Nigeria Revenue Service view of the sector: not "what did the country
// produce" but "does each company's filing reconcile with what was measured,
// what was sold, and what was remitted".
//
// Three parts: the integrity of the ledger itself, the reconciliation findings
// for a period, and the per-entity table the findings are drawn from.

import { useState, useEffect, useCallback } from "react";
import { getTokenFresh } from "@/lib/auth";

type Finding = {
  company: string; oml: string | null; severity: "high" | "medium" | "low";
  code: string; headline: string; detail: string;
  declared?: number | null; measured?: number | null; variancePct?: number | null;
};

type Unit = {
  company: string; oml: string | null;
  production: number | null; metered: number | null; sales: number | null; exportVol: number | null;
  salesUsd: number | null; salesNgn: number | null; taxNgn: number | null; royaltyNgn: number | null;
  effectiveRatePct: number | null;
};

type Chain = { entries: number; intact: boolean; brokenAt: number | null; reason: string | null };

type Recon = { period: string; fxRate: number | null; checked: number; findings: Finding[]; units: Unit[]; chain: Chain };

const SEV_COLOR = { high: "var(--red)", medium: "var(--amber)", low: "var(--ink-4)" } as const;

const ngn = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);
const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString()}`);
const vol = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString());

function defaultPeriod(year: number) {
  const now = new Date();
  const m = year === now.getFullYear() ? Math.max(1, now.getMonth()) : 12;
  return `${year}-${String(m).padStart(2, "0")}`;
}

export default function NrsCompliance({ year }: { year: number }) {
  const [period, setPeriod] = useState(() => defaultPeriod(year));
  const [data, setData] = useState<Recon | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openUnit, setOpenUnit] = useState<string | null>(null);

  useEffect(() => { setPeriod(defaultPeriod(year)); }, [year]);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const token = await getTokenFresh();
      const r = await fetch(`/api/nrs/reconciliation?period=${encodeURIComponent(period)}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) { setFailed(true); setData(null); return; }
      setData(await r.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const high = data?.findings.filter((f) => f.severity === "high").length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Ledger integrity — the claim that makes the rest citable */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Declaration Ledger</span>
          <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Append-only, hash-chained</span>
        </div>
        <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          {data?.chain ? (
            <>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
                background: data.chain.intact ? "var(--green-tint)" : "var(--red-tint)",
                border: `1px solid ${data.chain.intact ? "var(--green)" : "var(--red)"}`,
                color: data.chain.intact ? "var(--green-deep)" : "var(--red)",
                fontSize: "0.8rem", fontWeight: 700,
              }}>
                {data.chain.intact ? "✓ Ledger intact" : "✕ Ledger integrity broken"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.6, flex: 1, minWidth: 240 }}>
                {data.chain.intact
                  ? <>All {data.chain.entries.toLocaleString()} filed entries verify against their recorded hashes. Any edit to a historical filing would break the chain and show here.</>
                  : <><strong>Entry #{data.chain.brokenAt} failed verification: {data.chain.reason}.</strong> Figures at or after this entry cannot be relied on until investigated.</>}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.78rem", color: "var(--ink-5)" }}>Ledger status unavailable.</div>
          )}
        </div>
      </div>

      {/* Reconciliation */}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: "0.6rem" }}>
          <span className="panel-title">Reconciliation</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}
              style={{ padding: "4px 8px", fontSize: "0.74rem", border: "1px solid var(--border)", borderRadius: 2, background: "var(--surface-white)", color: "var(--ink-2)" }}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {data?.fxRate && (
              <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>
                Reference FX ₦{data.fxRate.toFixed(2)}/$
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: "1rem 1.25rem" }}>
          {loading ? (
            <div style={{ fontSize: "0.8rem", color: "var(--ink-5)" }}>Running reconciliation…</div>
          ) : failed ? (
            <div style={{ fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
              The reconciliation service could not be reached. Figures are unchanged; try the period selector again.
            </div>
          ) : !data || data.checked === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
              No declarations or metered readings on file for {period}. Reconciliation reports nothing rather than
              implying a clean period — an empty ledger is not a clean bill of health.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {[
                  { label: "Entities checked", value: String(data.checked), tone: "var(--ink)" },
                  { label: "Findings", value: String(data.findings.length), tone: data.findings.length ? "var(--amber)" : "var(--green)" },
                  { label: "High severity", value: String(high), tone: high ? "var(--red)" : "var(--green)" },
                ].map((s) => (
                  <div key={s.label}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.tone, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {data.findings.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "var(--green-deep)", background: "var(--green-tint)", border: "1px solid var(--green-line)", padding: "0.7rem 1rem" }}>
                  Every filed declaration reconciles with metered volumes and recorded remittances within tolerance for {period}.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {data.findings.map((f, i) => (
                    <div key={i} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: `3px solid ${SEV_COLOR[f.severity]}`, padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: SEV_COLOR[f.severity] }}>{f.severity}</span>
                        <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--ink)" }}>{f.company}</span>
                        {f.oml && <span style={{ fontSize: "0.7rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{f.oml}</span>}
                        <code style={{ fontSize: "0.62rem", color: "var(--ink-5)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>{f.code}</code>
                      </div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-2)", marginBottom: 2 }}>{f.headline}</div>
                      <div style={{ fontSize: "0.76rem", color: "var(--ink-3)", lineHeight: 1.6 }}>{f.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="chart-source">
          Declared figures come from the append-only declaration ledger; measured figures from registered telemetry.
          Currency checks use both the filing&apos;s own rate and the reference rate. Findings are indicative and warrant review, not automatic assessment.
        </div>
      </div>

      {/* Per-entity table */}
      {data && data.units.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">By Company and Block — {period}</span>
            <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Naira and dollars side by side</span>
          </div>
          <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="data-table" style={{ fontSize: "0.75rem" }}>
              <thead>
                <tr>
                  <th>Company</th><th>Block</th>
                  <th style={{ textAlign: "right" }}>Declared</th>
                  <th style={{ textAlign: "right" }}>Metered</th>
                  <th style={{ textAlign: "right" }}>Sold + exported</th>
                  <th style={{ textAlign: "right" }}>Revenue (USD)</th>
                  <th style={{ textAlign: "right" }}>Revenue (NGN)</th>
                  <th style={{ textAlign: "right" }}>Remitted</th>
                  <th style={{ textAlign: "right" }}>Effective</th>
                </tr>
              </thead>
              <tbody>
                {data.units.map((u) => {
                  const k = `${u.company}|${u.oml ?? ""}`;
                  const gap = u.production != null && u.metered != null && u.metered !== 0
                    ? ((u.production - u.metered) / Math.abs(u.metered)) * 100 : null;
                  return (
                    <tr key={k} onClick={() => setOpenUnit(openUnit === k ? null : k)} style={{ cursor: "pointer" }}>
                      <td className="td-primary">{u.company}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{u.oml ?? "—"}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{vol(u.production)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: gap != null && Math.abs(gap) > 3 ? "var(--red)" : undefined }}>
                        {vol(u.metered)}{gap != null && Math.abs(gap) > 3 ? ` (${gap > 0 ? "▲" : "▼"}${Math.abs(gap).toFixed(1)}%)` : ""}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{vol((u.sales ?? 0) + (u.exportVol ?? 0) || null)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(u.salesUsd)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ngn(u.salesNgn)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ngn((u.taxNgn ?? 0) + (u.royaltyNgn ?? 0) || null)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: u.effectiveRatePct == null ? "var(--ink-5)" : u.effectiveRatePct < 5 ? "var(--amber)" : "var(--ink)" }}>
                        {u.effectiveRatePct == null ? "—" : `${u.effectiveRatePct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="chart-source">
            &quot;Effective&quot; is tax plus royalty remitted as a share of declared revenue. It is a screening ratio, not a statutory rate.
          </div>
        </div>
      )}
    </div>
  );
}

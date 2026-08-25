// ── components/BulletinView.tsx ─────────────────────────────────────────────
// Presentational bulletin body shared by the live provisional view
// (/bulletin) and frozen editions (/bulletin/[no]). Server-renderable.

import Link from "next/link";
import CoatOfArms from "@/components/layout/CoatOfArms";
import PrintButton from "@/components/ui/PrintButton";
import { SECTOR_LABEL, type BulletinData } from "@/lib/bulletin-data";

export type BulletinMeta = {
  editionNo?: number;
  periodLabel: string;
  publishedAt?: string | null;
  dataCutoff: string;
  provisional: boolean;          // true = live working view, not an edition
  commentary?: Record<string, string>;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

export default function BulletinView({ data, meta }: { data: BulletinData; meta: BulletinMeta }) {
  const { series, sectorStats, totalRecords, movers } = data;
  const heading = meta.editionNo != null ? `No. ${meta.editionNo} · ${meta.periodLabel}` : meta.periodLabel;

  // When SOME series reported in period, the out-of-period ones are worth
  // badging individually. When NONE did, badging all fifteen is noise, so the
  // page says it once and says it plainly instead.
  const num = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : v.toLocaleString("en-NG", { maximumFractionDigits: 0 });

  const pctCell = (v: number | null) =>
    v === null ? (
      <span style={{ color: "var(--ink-5)" }}>—</span>
    ) : (
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: v >= 0 ? "var(--green)" : "var(--red)" }}>
        {v >= 0 ? "▲ +" : "▼ −"}{Math.abs(v).toFixed(1)}%
      </span>
    );

  const kindWord = data.window?.kind === "year" ? "Annual" : data.window?.kind === "quarter" ? "Quarterly" : "Monthly";

  const someInPeriod = (data.in_period_count ?? 0) > 0;
  const noneInPeriod = !!data.window && (data.in_period_count ?? 0) === 0;

  return (
    <>
      {/* Publication cover page — print only */}
      <div className="print-only bulletin-cover" style={{ display: "none" }}>
        <CoatOfArms size={90} />
        <div className="cover-republic">FEDERAL REPUBLIC OF NIGERIA</div>
        <div className="cover-org">ENERGY COMMISSION OF NIGERIA</div>
        <div className="cover-title">NEDB Monthly<br />Energy Bulletin</div>
        <div className="cover-edition">{meta.editionNo != null ? `No. ${meta.editionNo} · ` : ""}{meta.periodLabel}</div>
        <div className="cover-rule" />
        <div className="cover-meta">
          Data cutoff: {fmtDate(meta.dataCutoff)}
          {meta.publishedAt ? <><br />Published: {fmtDate(meta.publishedAt)}</> : null}
        </div>
        <div className="cover-stamp">{meta.provisional ? "PROVISIONAL — WORKING VIEW" : "OFFICIAL DATA PUBLICATION"}</div>
        <div className="cover-contents">
          <div className="c-head">CONTENTS</div>
          <div className="c-item">1 &nbsp; Summary</div>
          <div className="c-item">2 &nbsp; Sector Coverage{meta.commentary && Object.values(meta.commentary).some((x) => x?.trim()) ? " and Commentary" : ""}</div>
          {movers && movers.length > 0 && <div className="c-item">3 &nbsp; Biggest Year on Year Movers</div>}
          <div className="c-item">{movers && movers.length > 0 ? "4" : "3"} &nbsp; All Series, Status Overview</div>
        </div>
        <div className="cover-foot">
          National Energy Data Bank · Energy Commission of Nigeria · energy.gov.ng
        </div>
      </div>

      <div className="print-only print-header" style={{ display: "none" }}>
        <CoatOfArms size={48} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ecn-logo.png" alt="ECN" style={{ height: 48, width: "auto", objectFit: "contain" }} />
        <div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: "1rem", marginLeft: "0.25rem" }}>
          <div className="print-header-org">ENERGY COMMISSION OF NIGERIA (ECN)</div>
          <div className="print-header-title">NEDB {kindWord} Energy Bulletin{meta.editionNo != null ? ` — No. ${meta.editionNo}` : ""}</div>
          <div className="print-header-meta">
            {meta.periodLabel}
            {data.window ? ` (${data.window.start} to ${data.window.end})` : ""}
            {" · "}Data cutoff {fmtDate(meta.dataCutoff)}
            {data.window && typeof data.in_period_count === "number"
              ? ` · ${data.in_period_count} of ${data.series.length} series reported in period`
              : ""}
          </div>
        </div>
        <div className="print-header-ecn">{meta.provisional ? "PROVISIONAL" : "OFFICIAL DATA PUBLICATION"}</div>
      </div>

      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="page-wrap">
          <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem" }}>/</span>
            <Link href="/bulletin" style={{ color: "var(--green)", fontWeight: 600 }}>Energy Bulletin</Link>
            {meta.editionNo != null && <><span style={{ margin: "0 0.5rem" }}>/</span><span>No. {meta.editionNo}</span></>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: "0.5rem", flexWrap: "wrap" }}>
                <span className="tag tag-green">ECN / NEDB</span>
                <span className="tag tag-muted">{heading}</span>
                {meta.provisional
                  ? <span className="tag tag-amber">Provisional — not yet an edition</span>
                  : <span className="tag tag-ink">Published edition — frozen</span>}
              </div>
              <h1 style={{ fontSize: "1.625rem", fontWeight: 700, color: "var(--ink)" }}>
                NEDB {kindWord} Energy Bulletin
              </h1>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.35rem", lineHeight: 1.6 }}>
                {meta.provisional
                  ? "Working view computed from live committed records. Figures change as data lands; the numbered editions below are the citable record."
                  : `Statistical summary across all NEDB data series. Data cutoff ${fmtDate(meta.dataCutoff)}${meta.publishedAt ? `, published ${fmtDate(meta.publishedAt)}` : ""}. This edition is frozen; corrections are issued in the next edition.`}
              </p>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <PrintButton />
            </div>
          </div>
        </div>
      </div>

      {noneInPeriod && (
        <div style={{ background: "var(--surface)", padding: "1.25rem 0 0" }}>
          <div className="page-wrap">
            <div style={{ background: "var(--amber-tint)", border: "1px solid var(--amber)", borderLeft: "3px solid var(--amber)", padding: "0.85rem 1.1rem" }}>
              <div className="eyebrow" style={{ color: "var(--amber)", marginBottom: 4 }}>Coverage for this period</div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-2)", lineHeight: 1.7 }}>
                <strong>No series holds a record for {meta.periodLabel}.</strong>{" "}Every figure below is the latest available
                from an earlier period, shown with its own date so it is never mistaken for this period&apos;s. A bulletin
                can only report what has been committed; filling the monthly series is what turns this into a monthly
                bulletin in substance rather than in name.
              </div>
            </div>
          </div>
        </div>
      )}

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {[
              { label: "Total Records", value: totalRecords.toLocaleString() },
              { label: "Data Series", value: String(series.length) },
              { label: "Sectors Covered", value: String(Object.keys(sectorStats).length) },
              { label: "Data Cutoff", value: fmtDate(meta.dataCutoff) },
            ].map((card) => (
              <div key={card.label} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{card.value}</div>
                <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Sector breakdown with commentary */}
          <div className="panel" style={{ marginBottom: "1.5rem" }}>
            <div className="panel-header">
              <span className="panel-title">Sector Coverage</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>Sector</th>
                  <th style={{ textAlign: "right", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>Series</th>
                  <th style={{ textAlign: "right", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>Records</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sectorStats).map(([key, stat]) => (
                  <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{SECTOR_LABEL[key] ?? stat.label}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}>{stat.count}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}>{stat.records.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sector commentary — written by the editor, approved on publish */}
          {meta.commentary && Object.values(meta.commentary).some((t) => t?.trim()) && (
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Commentary</span>
              </div>
              <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {Object.entries(meta.commentary).filter(([, t]) => t?.trim()).map(([sector, text]) => (
                  <div key={sector}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-4)", marginBottom: 4 }}>{SECTOR_LABEL[sector] ?? sector}</div>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink-2)", lineHeight: 1.7, margin: 0 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top movers */}
          {movers && movers.length > 0 && (
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Biggest Year-on-Year Movers</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Latest period vs. same period prior year</span>
              </div>
              <div className="table-scroll">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Series", "Period", "Latest Value", "YoY Change"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Series" ? "left" : "right", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movers.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <Link href={`/series/${s.id}`} style={{ color: "var(--green)", fontWeight: 600, textDecoration: "none" }}>{s.name}</Link>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.78rem", color: "var(--ink-4)" }}>
                        {s.latest_period ?? "—"}
                        {s.in_period === false && someInPeriod && (
                          <span title="This series has no record in the edition's period. This is its latest available figure."
                            style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 700, color: "var(--amber)", border: "1px solid var(--amber)", padding: "0 4px", whiteSpace: "nowrap" }}>
                            OUT OF PERIOD
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}>
                        {s.latest !== null ? `${Number(s.latest).toLocaleString()} ${s.unit}` : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        {s.yoy_pct !== null ? (
                          <span title={s.change_basis ?? undefined} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "0.82rem", color: s.yoy_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                            {s.yoy_pct >= 0 ? "▲ +" : "▼ −"}{Math.abs(s.yoy_pct).toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* ── Differential analysis ────────────────────────────────────
              What this period did against the one before it and against the
              same period a year earlier. Both totals are shown, not just the
              percentages, so the arithmetic can be checked rather than trusted. */}
          {data.comparison && data.series.some((x) => x.period_total !== null) && (
            <div className="panel print-break" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Differential Analysis — {meta.periodLabel}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>
                  against {data.comparison.previous.label}
                  {data.comparison.sameWindow ? "" : ` and ${data.comparison.year_ago.label}`}
                </span>
              </div>
              <div className="scroll-x">
                <table className="data-table" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>Series</th>
                      <th style={{ textAlign: "right" }}>{meta.periodLabel}</th>
                      <th style={{ textAlign: "right" }}>{data.comparison.previous.label}</th>
                      <th style={{ textAlign: "right" }}>Change</th>
                      {!data.comparison.sameWindow && <>
                        <th style={{ textAlign: "right" }}>{data.comparison.year_ago.label}</th>
                        <th style={{ textAlign: "right" }}>Change</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.filter((x) => x.period_total !== null).map((x) => (
                      <tr key={x.id}>
                        <td className="td-primary">
                          {x.name}
                          <span style={{ marginLeft: 6, fontSize: "0.62rem", color: "var(--ink-5)" }}>
                            {x.period_records} rec
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                          {num(x.period_total)} <span style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>{x.unit}</span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ink-4)" }}>{num(x.previous_total)}</td>
                        <td style={{ textAlign: "right" }}>{pctCell(x.vs_previous_pct)}</td>
                        {!data.comparison!.sameWindow && <>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ink-4)" }}>{num(x.year_ago_total)}</td>
                          <td style={{ textAlign: "right" }}>{pctCell(x.vs_year_ago_pct)}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chart-source">
                A period total is the sum of every committed record inside the window, so a quarter of a monthly series is
                three months added together. Where a period holds records in more than one unit the total is withheld
                rather than added. A dash means the comparison period holds nothing to compare against.
              </div>
            </div>
          )}

          {/* ── Q1 to Q4 ──────────────────────────────────────────────────── */}
          {data.quarters && (
            <div className="panel print-break" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Q1 to Q4 — {data.window?.start.slice(0, 4)}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>
                  {data.quarters.map((q) => `${q.label.split(" ")[0]} ${q.reporting}`).join(" · ")} series reporting
                </span>
              </div>
              <div className="scroll-x">
                <table className="data-table" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>Series</th>
                      <th style={{ textAlign: "right" }}>Unit</th>
                      {data.quarters.map((q) => <th key={q.quarter} style={{ textAlign: "right" }}>Q{q.quarter}</th>)}
                      <th style={{ textAlign: "right" }}>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series
                      .filter((x) => data.quarters!.some((q) => q.totals[x.id] !== null))
                      .map((x) => {
                        const vals = data.quarters!.map((q) => q.totals[x.id]);
                        const yearTotal = vals.every((v) => v === null)
                          ? null
                          : vals.reduce((a: number, v) => a + (v ?? 0), 0);
                        const annualStamp = data.quarters![0]?.annualStamped?.includes(x.id);
                        return (
                          <tr key={x.id}>
                            <td className="td-primary">
                              {x.name}
                              {annualStamp && (
                                <span title="This series reports annually. Its figure sits in the quarter its single date falls in; it is not split across the year."
                                  style={{ marginLeft: 6, fontSize: "0.6rem", fontWeight: 700, color: "var(--amber)", border: "1px solid var(--amber)", padding: "0 4px", whiteSpace: "nowrap" }}>
                                  ANNUAL FIGURE
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "right", fontSize: "0.7rem", color: "var(--ink-5)" }}>{x.unit}</td>
                            {vals.map((v, i) => (
                              <td key={i} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: v === null ? "var(--ink-5)" : "var(--ink)" }}>
                                {num(v)}
                              </td>
                            ))}
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{num(yearTotal)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="chart-source">
                Each cell is the sum of committed records inside that quarter. A dash means the quarter holds no record for
                that series, which is not the same as a zero. The year column adds the quarters that do exist, so it
                understates any series with a gap. Rows marked ANNUAL FIGURE report once a year: that value sits in
                whichever quarter its single date falls in and is not a quarterly split, so read it as the year&apos;s
                total rather than as that quarter&apos;s activity.
              </div>
            </div>
          )}

          {/* All series table */}
          <div className="panel print-break">
            <div className="panel-header">
              <span className="panel-title">All Series — Status Overview</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Series", "Sector", "Frequency", "Records", "Latest Period", "Latest Value", "YoY"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Series" || h === "Sector" ? "left" : "right", padding: "0.5rem 1rem", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.625rem 1rem", fontWeight: 500, whiteSpace: "nowrap" }}>
                        <Link href={`/series/${s.id}`} style={{ color: "var(--green)", textDecoration: "none" }}>{s.name}</Link>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "var(--ink-4)", textTransform: "capitalize" }}>{s.sector}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", textTransform: "capitalize", color: "var(--ink-4)" }}>
                        {s.cadence ?? s.frequency}
                        {s.cadence && s.frequency && s.cadence !== s.frequency && (
                          <span title={`The registry declares this series ${s.frequency}, but its records arrive ${s.cadence}. The records are what is shown.`}
                            style={{ marginLeft: 5, fontSize: "0.58rem", fontWeight: 700, color: "var(--amber)", textTransform: "none" }}>
                            ≠{s.frequency}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.record_count.toLocaleString()}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.72rem", color: "var(--ink-5)" }}>
                        {s.latest_period ?? "—"}
                        {s.in_period === false && someInPeriod && (
                          <span title="No record in this edition's period; latest available shown."
                            style={{ marginLeft: 5, fontSize: "0.58rem", fontWeight: 700, color: "var(--amber)" }}>
                            ·OOP
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {s.latest !== null ? `${Number(s.latest).toLocaleString()} ${s.unit}` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right" }}>
                        {s.yoy_pct !== null ? (
                          <span title={s.change_basis ?? undefined} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "0.75rem", color: s.yoy_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                            {s.yoy_pct >= 0 ? "▲ +" : "▼ −"}{Math.abs(s.yoy_pct).toFixed(1)}%
                          </span>
                        ) : <span style={{ color: "var(--ink-5)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="chart-source">
              Source: National Energy Data Bank, Energy Commission of Nigeria · Data cutoff {fmtDate(meta.dataCutoff)} · Figures are provisional and subject to revision; see the Data Revision Log.
            </div>
          </div>

          <div className="print-only" style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #ccc", fontSize: "0.7rem", color: "#777" }}>
            National Energy Data Bank (NEDB) · Energy Commission of Nigeria · energy.gov.ng<br />
            Cite as: NEDB {kindWord} Energy Bulletin{meta.editionNo != null ? `, No. ${meta.editionNo}` : ""}, {meta.periodLabel}. Energy Commission of Nigeria.
          </div>
        </div>
      </main>
    </>
  );
}

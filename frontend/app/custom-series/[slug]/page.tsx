import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { db } from "@/lib/supabase-server";
import CustomSeriesChartPanel, {
  type CustomColumn, type CustomRecord,
} from "@/components/databank/CustomSeriesChartPanel";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getData(slug: string) {
  const { data: series } = await db()
    .from("custom_series")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!series) return null;

  const [{ data: columns }, { data: records, count }] = await Promise.all([
    db().from("custom_columns").select("*").eq("series_id", series.id).order("display_order"),
    db().from("custom_records").select("*", { count: "exact" }).eq("series_id", series.id).order("period_date", { ascending: true }).limit(500),
  ]);

  return { series, columns: (columns ?? []) as CustomColumn[], records: (records ?? []) as CustomRecord[], total: count ?? 0 };
}

function fmtVal(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "number") return val.toLocaleString("en-NG", { maximumFractionDigits: 4 });
  return String(val);
}

export default async function PublicCustomSeries({ params }: Props) {
  const { slug } = await params;
  const result = await getData(slug);

  if (!result) {
    return (
      <>
        <Navbar active="databank" />
        <div style={{ padding: "8rem 2rem", textAlign: "center" }}>
          <h1 style={{ color: "var(--ink)", marginBottom: "1rem" }}>Series not found</h1>
          <Link href="/" className="btn btn-secondary">Back to Data Bank</Link>
        </div>
        <Footer />
      </>
    );
  }

  const { series, columns, records, total } = result;
  const orderedCols = [...columns].sort((a, b) => a.display_order - b.display_order);

  return (
    <>
      <Navbar active="databank" />

      {/* ── SUB-HEADER ── */}
      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "1.5rem 0" }}>
        <div className="page-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.875rem", fontSize: "0.75rem", color: "var(--ink-4)" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ color: "var(--ink-5)" }}>/</span>
            <span style={{ color: "var(--ink-4)" }}>Custom Data Tables</span>
            <span style={{ color: "var(--ink-5)" }}>/</span>
            <span style={{ color: "var(--ink)" }}>{series.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
                <span className="tag tag-green">custom series</span>
                <span className="tag tag-muted">{series.geo_resolution}</span>
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.15 }}>
                {series.name}
              </h1>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.35rem" }}>
                {total.toLocaleString()} records &nbsp;·&nbsp; {`${columns.length} columns`} &nbsp;·&nbsp;
                NEDB ID: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{series.slug}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">

          {/* ── VISUALISATION (3 public modes) ── */}
          <div style={{ marginBottom: "1.75rem" }}>
            <CustomSeriesChartPanel seriesName={series.name} columns={orderedCols} records={records} />
          </div>

          {/* ── DATA INTELLIGENCE ── */}
          {(series.what_is || series.how_to_read || series.why_it_matters) && (
            <div style={{ marginBottom: "1.75rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.875rem" }}>Data Intelligence</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                {series.what_is && (
                  <div style={{ padding: "1.1rem 1.25rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.5rem" }}>What Is This?</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.what_is}</p>
                  </div>
                )}
                {series.how_to_read && (
                  <div style={{ padding: "1.1rem 1.25rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid #1D4ED8", borderRadius: "var(--r-md)" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1D4ED8", marginBottom: "0.5rem" }}>How to Read</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.how_to_read}</p>
                  </div>
                )}
                {series.why_it_matters && (
                  <div style={{ padding: "1.1rem 1.25rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid #B45309", borderRadius: "var(--r-md)" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B45309", marginBottom: "0.5rem" }}>Why It Matters</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.why_it_matters}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DATA TABLE ── */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Full Data Table — {series.name}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{total.toLocaleString()} records</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {orderedCols.map((c) => (
                      <th key={c.slug}>
                        {c.name}
                        {c.unit && <span style={{ fontWeight: 400, color: "var(--ink-5)", marginLeft: 4 }}>({c.unit})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...records].reverse().map((rec, i) => (
                    <tr key={i}>
                      <td className="td-primary" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{rec.period_date}</td>
                      {orderedCols.map((c) => (
                        <td key={c.slug} style={{ fontFamily: c.column_type === "numeric" || c.column_type === "cbn_rate" ? "var(--font-mono)" : undefined, color: c.is_readonly ? "var(--green)" : undefined, fontWeight: c.is_readonly ? 600 : undefined }}>
                          {fmtVal(rec.data?.[c.slug])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {series.description && (
            <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.35rem" }}>About this Series</div>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.description}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

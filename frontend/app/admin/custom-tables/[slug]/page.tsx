"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";

type Column = {
  id: number; name: string; slug: string; column_type: string;
  unit: string | null; is_required: boolean; is_readonly: boolean; display_order: number;
};

type SeriesDetail = {
  id: number; slug: string; name: string; description: string;
  what_is: string | null; how_to_read: string | null; why_it_matters: string | null;
  geo_resolution: string; is_public: boolean;
  columns: Column[];
  records: Record<string, unknown>[];
  total_records: number;
};

function fmtVal(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return val.toLocaleString("en-NG", { maximumFractionDigits: 4 });
  return String(val);
}

function AddRecordPanel({ series, onAdded }: { series: SeriesDetail; onAdded: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [cbnRate, setCbnRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasCbnCol = series.columns.some((c) => c.column_type === "cbn_rate");

  useEffect(() => {
    if (!hasCbnCol) return;
    fetch("/api/cbn-rate")
      .then((r) => r.json())
      .then((j) => { if (j.rate) setCbnRate(j.rate); })
      .catch(() => {});
  }, [hasCbnCol]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");

    // find date column
    const datePeriodCol = series.columns.find((c) => c.column_type === "date") ?? series.columns[0];
    const periodDate = values[datePeriodCol.slug];
    if (!periodDate) { setError("Date is required"); return; }

    // build data payload — exclude readonly cols (they're auto-filled server-side)
    const data: Record<string, unknown> = { period_date: periodDate };
    for (const col of series.columns) {
      if (col.is_readonly) continue;
      data[col.slug] = col.column_type === "numeric" ? parseFloat(values[col.slug] ?? "0") : (values[col.slug] ?? "");
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/custom-series/${series.slug}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Failed to save"); return; }
      setSuccess(`Record saved. CBN rate applied: ₦${j.cbn_rate_applied?.toLocaleString("en-NG", { maximumFractionDigits: 2 }) ?? "N/A"}`);
      setValues({});
      onAdded();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: "1.5rem" }}>
      <div className="panel-header">
        <span className="panel-title">Add Record</span>
        {hasCbnCol && (
          <span style={{ fontSize: "0.72rem", color: "var(--green)", fontWeight: 600 }}>
            Live CBN Rate: {cbnRate ? `₦${cbnRate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}/USD` : "Fetching…"}
          </span>
        )}
      </div>
      <div style={{ padding: "1.25rem" }}>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.875rem", marginBottom: "1rem" }}>
            {series.columns.map((col) => (
              <div key={col.slug}>
                <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {col.name}
                  {col.unit && <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 4 }}>({col.unit})</span>}
                  {col.is_required && !col.is_readonly && <span style={{ color: "var(--red)", marginLeft: 2 }}>*</span>}
                </label>
                {col.is_readonly ? (
                  <div style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 5, fontSize: "0.82rem", fontFamily: "var(--font-mono)", background: "var(--surface)", color: "var(--green)", fontWeight: 700 }}>
                    {cbnRate ? `${cbnRate.toFixed(2)} (auto)` : "Auto-filled on save"}
                  </div>
                ) : (
                  <input
                    type={col.column_type === "numeric" ? "number" : col.column_type === "date" ? "date" : "text"}
                    value={values[col.slug] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [col.slug]: e.target.value }))}
                    step={col.column_type === "numeric" ? "any" : undefined}
                    required={col.is_required}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 5, fontSize: "0.82rem", boxSizing: "border-box" }}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <div style={{ marginBottom: "0.75rem", fontSize: "0.78rem", color: "var(--red)", background: "#FEE2E2", padding: "0.5rem 0.75rem", borderRadius: 4 }}>{error}</div>}
          {success && <div style={{ marginBottom: "0.75rem", fontSize: "0.78rem", color: "var(--green)", background: "var(--green-tint)", padding: "0.5rem 0.75rem", borderRadius: 4 }}>{success}</div>}
          <button type="submit" disabled={saving} style={{ padding: "0.6rem 1.5rem", background: saving ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : "Save Record"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CustomTableDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/custom-series/${slug}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        setSeries(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login"); return; }
    load();
  }, [router, load]);

  if (loading) return <div style={{ padding: "4rem", textAlign: "center", color: "var(--ink-5)" }}>Loading…</div>;
  if (notFound || !series) return <div style={{ padding: "4rem", textAlign: "center" }}><p>Series not found.</p><Link href="/admin/custom-tables">← Back</Link></div>;

  const dataColumns = series.columns.slice().sort((a, b) => a.display_order - b.display_order);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Breadcrumb + title */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginBottom: "0.5rem" }}>
            <Link href="/admin" style={{ color: "var(--green)" }}>Admin</Link>
            {" / "}
            <Link href="/admin/custom-tables" style={{ color: "var(--green)" }}>Custom Tables</Link>
            {" / "}
            <span>{series.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>{series.name}</h1>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)", marginTop: "0.25rem" }}>{series.slug}</div>
              {series.description && <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.375rem" }}>{series.description}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, background: "var(--green-tint)", color: "var(--green)", padding: "3px 10px", borderRadius: 20, border: "1px solid var(--green-line)" }}>
                {series.total_records.toLocaleString()} records
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-4)", background: "var(--surface)", border: "1px solid var(--border)", padding: "3px 10px", borderRadius: 20 }}>
                {series.columns.length} columns
              </span>
            </div>
          </div>
        </div>

        {/* Intelligence blocks */}
        {(series.what_is || series.how_to_read || series.why_it_matters) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.875rem", marginBottom: "1.5rem" }}>
            {series.what_is && (
              <div style={{ padding: "1rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.4rem" }}>What Is This?</div>
                <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>{series.what_is}</p>
              </div>
            )}
            {series.how_to_read && (
              <div style={{ padding: "1rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid #1D4ED8", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1D4ED8", marginBottom: "0.4rem" }}>How to Read</div>
                <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>{series.how_to_read}</p>
              </div>
            )}
            {series.why_it_matters && (
              <div style={{ padding: "1rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid #B45309", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B45309", marginBottom: "0.4rem" }}>Why It Matters</div>
                <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>{series.why_it_matters}</p>
              </div>
            )}
          </div>
        )}

        {/* Add record form */}
        <AddRecordPanel series={series} onAdded={load} />

        {/* Records table */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Records</span>
            <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{series.total_records.toLocaleString()} total</span>
          </div>
          {series.records.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.82rem" }}>No records yet. Use the form above to add the first entry.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {dataColumns.map((col) => (
                      <th key={col.slug}>
                        {col.name}
                        {col.unit && <span style={{ fontWeight: 400, color: "var(--ink-5)", marginLeft: 4 }}>({col.unit})</span>}
                        {col.is_readonly && <span style={{ marginLeft: 4, fontSize: "0.6rem", color: "var(--green)", fontWeight: 700 }}>AUTO</span>}
                      </th>
                    ))}
                    <th>Entered by</th>
                  </tr>
                </thead>
                <tbody>
                  {series.records.map((rec, i) => {
                    const d = rec.data as Record<string, unknown>;
                    return (
                      <tr key={i}>
                        <td className="td-primary" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                          {rec.period_date as string}
                        </td>
                        {dataColumns.map((col) => (
                          <td key={col.slug} style={{ fontFamily: col.column_type === "numeric" || col.column_type === "cbn_rate" ? "var(--font-mono)" : undefined, color: col.is_readonly ? "var(--green)" : undefined, fontWeight: col.is_readonly ? 600 : undefined }}>
                            {fmtVal(d[col.slug])}
                          </td>
                        ))}
                        <td style={{ color: "var(--ink-5)", fontSize: "0.72rem" }}>{rec.created_by as string}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

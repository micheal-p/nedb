import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { db } from "@/lib/supabase-server";

// ── Public revision log ─────────────────────────────────────────────────────
// Every change to published figures, visible to anyone — the transparency
// practice that separates a statistical office from a spreadsheet.

export const revalidate = 300;

const ACTION_LABEL: Record<string, string> = {
  auto_ingest: "Auto-ingested",
  edit: "Value revised",
  delete: "Record removed",
  commit: "Dataset committed",
  freeze: "Period frozen",
  unfreeze: "Period unfrozen",
};

export default async function RevisionsPage() {
  const { data } = await db()
    .from("audit_log")
    .select("action, series_type_id, period, region, old_value, new_value, performed_at, notes")
    .order("performed_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];

  return (
    <>
      <Navbar active="databank" />

      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "1.5rem 0" }}>
        <div className="page-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
            <span className="tag tag-green">Transparency</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)" }}>Data Revision Log</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.4rem", maxWidth: 620, lineHeight: 1.6 }}>
            Every change to published NEDB figures is recorded and shown here — additions, revisions and removals,
            whether entered by ECN staff or ingested automatically from source agencies.
          </p>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Latest 100 revisions</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.82rem" }}>
                No revisions recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.75rem" }}>
                  <thead><tr><th>When</th><th>Action</th><th>Series</th><th>Period</th><th>Old → New</th><th>By</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                          {new Date(r.performed_at).toLocaleString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                        <td className="td-primary">{r.series_type_id ?? "—"}</td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>{r.period ?? "—"}{r.region && r.region !== "NGA" ? ` · ${r.region}` : ""}</td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>
                          {r.old_value !== null ? Number(r.old_value).toLocaleString() : "—"}
                          {" → "}
                          {r.new_value !== null ? Number(r.new_value).toLocaleString() : "—"}
                        </td>
                        <td style={{ color: "var(--ink-5)" }}>
                          {r.action === "auto_ingest" || String(r.notes ?? "").includes("OWID") ? "Automated pipeline" : "ECN staff"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p style={{ fontSize: "0.7rem", color: "var(--ink-5)", marginTop: "0.75rem" }}>
            Staff identities are recorded internally for audit purposes but not published.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}

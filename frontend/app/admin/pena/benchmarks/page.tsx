"use client";

// Admin editor for the NBS benchmark figures (population & poverty rate per
// state + the national population row) that drive PENA coverage metrics.
// Values seed from migration 036; edits here update every map, tooltip and
// table that shows coverage or the poverty benchmark.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getRole } from "@/lib/auth";
import { type NbsRow } from "@/lib/nbs-benchmarks";

type EditRow = { state_name: string; lga_name: string; population: string; poverty_rate: string; source: string };

const cell: React.CSSProperties = { padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem", fontFamily: "var(--font-mono)", width: "100%", boxSizing: "border-box", background: "#fff" };

export default function NbsBenchmarksPage() {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>([]);
  const [fromDefaults, setFromDefaults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/pena/benchmarks"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    fetch("/api/pena/benchmarks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows: NbsRow[]; from_defaults?: boolean } | null) => {
        if (!j) { setError("Failed to load benchmarks"); return; }
        setFromDefaults(!!j.from_defaults);
        setRows(j.rows
          .filter((r) => !r.lga_name || !r.lga_name.trim())
          .map((r) => ({
            state_name: r.state_name,
            lga_name: "",
            population: r.population == null ? "" : String(r.population),
            poverty_rate: r.poverty_rate == null ? "" : String(r.poverty_rate),
            source: (r as { source?: string }).source ?? "",
          })));
      })
      .catch(() => setError("Failed to load benchmarks"))
      .finally(() => setLoading(false));
  }, [router]);

  function update(i: number, field: "population" | "poverty_rate", val: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  }

  async function save() {
    setSaving(true); setError(""); setMsg("");
    try {
      const res = await fetch("/api/pena/benchmarks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Save failed"); return; }
      setFromDefaults(false);
      setMsg(`Saved ${j.saved} rows — coverage figures update everywhere immediately.`);
      setTimeout(() => setMsg(""), 3500);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const national = rows.find((r) => r.state_name === "NIGERIA");
  const states = rows.filter((r) => r.state_name !== "NIGERIA");

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin · PENA</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>NBS Benchmarks</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem", maxWidth: 560, lineHeight: 1.55 }}>
              Population and poverty figures used to compute survey coverage. Update them whenever NBS/NPC
              publishes newer tables — every PENA map, tooltip and summary reads from here.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/admin/pena" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Assessments</Link>
            <button onClick={save} disabled={saving || loading}
              style={{ padding: "0.6rem 1.5rem", background: saving ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save All"}
            </button>
          </div>
        </div>

        {fromDefaults && (
          <div style={{ fontSize: "0.76rem", color: "var(--ink-3)", background: "var(--green-tint)", border: "1px solid var(--green-line)", padding: "0.625rem 1rem", borderRadius: 6, marginBottom: "1rem", lineHeight: 1.5 }}>
            Showing built-in defaults — the nbs_benchmarks table has no rows yet (run migration 036, or just press
            Save All to write these values to the database).
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : (
          <>
            {national && (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", borderRadius: "var(--r-md)", padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)", minWidth: 160 }}>NIGERIA (national)</div>
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 2 }}>Population</label>
                  <input value={national.population} inputMode="numeric"
                    onChange={(e) => update(rows.indexOf(national), "population", e.target.value)} style={cell} />
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", flex: "1 1 200px" }}>{national.source}</div>
              </div>
            )}

            <div className="chart-panel">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", fontSize: "0.78rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>State</th>
                      <th style={{ textAlign: "left", width: 160 }}>Population</th>
                      <th style={{ textAlign: "left", width: 120 }}>Poverty Rate %</th>
                      <th style={{ textAlign: "left" }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {states.map((r) => (
                      <tr key={r.state_name}>
                        <td style={{ fontWeight: 600 }}>{r.state_name}</td>
                        <td><input value={r.population} inputMode="numeric" onChange={(e) => update(rows.indexOf(r), "population", e.target.value)} style={cell} /></td>
                        <td><input value={r.poverty_rate} inputMode="decimal" onChange={(e) => update(rows.indexOf(r), "poverty_rate", e.target.value)} style={cell} /></td>
                        <td style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>{r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chart-source">
                Defaults: UN World Population Prospects 2024 (mid-2026 estimate, 242.4m) distributed by NPC 2006 census shares ·
                NLSS 2018/19 poverty headcount · Borno's NLSS rate was not published. LGA-level population rows can be added later via the same table.
              </div>
            </div>
          </>
        )}

        {(msg || error) && (
          <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", padding: "0.75rem 1.25rem", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, background: error ? "#FEE2E2" : "var(--green)", color: error ? "var(--red)" : "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 50 }}>
            {error || msg}
          </div>
        )}
      </div>
    </div>
  );
}

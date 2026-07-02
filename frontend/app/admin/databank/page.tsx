"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTokenFresh, getRole, clearTokens } from "@/lib/auth";
import CoatOfArms from "@/components/layout/CoatOfArms";

interface EnergyRec {
  id: number;
  series_type_id: string;
  period: string;
  period_date: string;
  region: string;
  value: number | null;
  unit: string;
  source: string | null;
  notes: string | null;
  upload_session_id: number | null;
  created_at: string;
}

const SERIES_NAMES: Record<string, string> = {
  crude_oil_production:      "Crude Oil Production",
  electricity_generation:    "Electricity Generation",
  electricity_consumption:   "Electricity Consumption",
  electricity_sent_out:      "Electricity Sent Out",
  pms_sales:                 "PMS (Petrol) Sales",
  lpg_sales:                 "LPG Sales",
  natural_gas_production:    "Natural Gas Production",
  natural_gas_utilisation:   "Natural Gas Utilisation",
  renewable_energy_capacity: "Renewable Energy Capacity",
  energy_access_rate:        "Energy Access Rate",
  co2_emissions:             "CO₂ Emissions",
  fuelwood_consumption:      "Fuelwood Consumption",
};

export default function DataBankPage() {
  const router = useRouter();
  const [records, setRecords]       = useState<EnergyRec[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<"tree" | "table">("tree");
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [filterSeries, setFilterSeries] = useState("");
  const [filterYear, setFilterYear]     = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [search, setSearch]         = useState("");
  const [deleting, setDeleting]     = useState<number | null>(null);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [headerOpen, setHeaderOpen] = useState(false);

  // Record history modal
  interface AuditEntry { id: number; action: string; old_value: number | null; new_value: number | null; performed_by: string; performed_at: string; notes: string | null; }
  const [historyRec, setHistoryRec]   = useState<EnergyRec | null>(null);
  const [historyLog, setHistoryLog]   = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    const token = await getTokenFresh();
    if (!token) { router.replace("/data-point/login?redirect=/admin/databank"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/records?limit=2000", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch {
      setMsg({ type: "err", text: "Failed to load records." });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function deleteRecord(id: number) {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    setDeleting(id);
    const token = await getTokenFresh();
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/records/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRecords(r => r.filter(x => x.id !== id));
        setMsg({ type: "ok", text: "Record deleted." });
      } else {
        setMsg({ type: "err", text: "Delete failed." });
      }
    } catch {
      setMsg({ type: "err", text: "Delete failed." });
    } finally {
      setDeleting(null);
    }
  }

  async function openHistory(rec: EnergyRec) {
    setHistoryRec(rec); setHistoryLog([]); setHistoryLoading(true);
    const token = await getTokenFresh(); if (!token) return;
    const res = await fetch(`/api/admin/audit?record=${rec.id}`, { headers: { Authorization: `Bearer ${token}` } });
    setHistoryLog(res.ok ? (await res.json()).entries ?? [] : []);
    setHistoryLoading(false);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Filter
  const filtered = records.filter(r => {
    if (filterSeries && r.series_type_id !== filterSeries) return false;
    if (filterYear && !r.period.startsWith(filterYear)) return false;
    if (filterRegion && !(r.region ?? "").toLowerCase().includes(filterRegion.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.series_type_id.includes(q) && !r.period.includes(q) &&
          !(r.region ?? "").toLowerCase().includes(q) && !String(r.value ?? "").includes(q)) return false;
    }
    return true;
  });

  // Group by series
  const grouped: Record<string, EnergyRec[]> = {};
  for (const r of filtered) {
    if (!grouped[r.series_type_id]) grouped[r.series_type_id] = [];
    grouped[r.series_type_id].push(r);
  }

  const years   = [...new Set(records.map(r => r.period?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const regions = [...new Set(records.map(r => r.region).filter(Boolean))].sort();

  const TAB: (a: boolean) => React.CSSProperties = (a) => ({
    padding: "0.5rem 1rem", border: "none", background: "none",
    borderBottom: a ? "2px solid var(--green)" : "2px solid transparent",
    color: a ? "var(--green)" : "var(--ink-4)", fontWeight: a ? 700 : 500,
    fontSize: "0.78rem", cursor: "pointer", whiteSpace: "nowrap",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      {/* Header */}
      <div style={{ background: "var(--ink)", borderBottom: "3px solid var(--green)" }}>
        <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CoatOfArms size={32} />
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>Storage Bank</div>
              <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>All Records · NEDB Data Management</div>
            </div>
          </div>
          <div className="admin-header-actions-desktop" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Link href="/admin" className="btn btn-ghost btn-sm">Admin Panel</Link>
            <Link href="/upload" className="btn btn-ghost btn-sm">Upload Data</Link>
            <button onClick={() => { clearTokens(); window.location.href = "/"; }} className="btn btn-ghost btn-sm" style={{ color: "#fca5a5" }}>Log Out</button>
          </div>
          <button className="admin-header-hamburger" onClick={() => setHeaderOpen(o => !o)} aria-label="Menu"
            style={{ display: "none", flexDirection: "column", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 8 }}>
            <span style={{ display: "block", width: 20, height: 2, background: "#fff" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "#fff" }} />
            <span style={{ display: "block", width: 20, height: 2, background: "#fff" }} />
          </button>
        </div>
        {headerOpen && (
          <div className="admin-header-dropdown">
            <Link href="/admin" className="admin-header-item" onClick={() => setHeaderOpen(false)}>Admin Panel</Link>
            <Link href="/upload" className="admin-header-item" onClick={() => setHeaderOpen(false)}>Upload Data</Link>
            <button onClick={() => { clearTokens(); window.location.href = "/"; }} className="admin-header-item admin-header-item--logout">Log Out</button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Title + view toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Data Storage Bank</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: 4 }}>
              {records.length.toLocaleString()} records across {Object.keys(SERIES_NAMES).filter(k => grouped[k]).length} series
              {" · "}browse, review and manage all committed data
            </p>
          </div>
          <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <button style={TAB(view === "tree")}  onClick={() => setView("tree")}>Tree View</button>
            <button style={TAB(view === "table")} onClick={() => setView("table")}>Flat Table</button>
          </div>
        </div>

        {msg && (
          <div style={{ padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem", background: msg.type === "ok" ? "var(--green-tint)" : "rgba(192,57,43,0.08)", border: `1px solid ${msg.type === "ok" ? "var(--green-line)" : "rgba(192,57,43,0.2)"}`, color: msg.type === "ok" ? "var(--green-deep)" : "#C0392B", fontSize: "0.82rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit", opacity: 0.5, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Series</label>
            <select className="form-input form-select" style={{ fontSize: "0.78rem", padding: "0.35rem 0.5rem" }} value={filterSeries} onChange={e => setFilterSeries(e.target.value)}>
              <option value="">All series</option>
              {Object.entries(SERIES_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Year</label>
            <select className="form-input form-select" style={{ fontSize: "0.78rem", padding: "0.35rem 0.5rem" }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Region</label>
            <select className="form-input form-select" style={{ fontSize: "0.78rem", padding: "0.35rem 0.5rem" }} value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
              <option value="">All regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Search</label>
            <input className="form-input" placeholder="Period, value, region…" style={{ fontSize: "0.78rem", padding: "0.35rem 0.5rem" }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "var(--ink-4)", fontSize: "0.85rem" }}>Loading records…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "var(--ink-4)", fontSize: "0.85rem" }}>No records match the current filter.</div>
        ) : view === "tree" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: "0.25rem", alignItems: "center" }}>
              <button onClick={() => setExpanded(new Set(Object.keys(grouped)))} className="btn btn-sm" style={{ background: "none", border: "1px solid var(--border)", color: "var(--ink-4)", fontSize: "0.72rem" }}>Expand all</button>
              <button onClick={() => setExpanded(new Set())} className="btn btn-sm" style={{ background: "none", border: "1px solid var(--border)", color: "var(--ink-4)", fontSize: "0.72rem" }}>Collapse all</button>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-5)", marginLeft: 8 }}>{filtered.length.toLocaleString()} records</span>
            </div>

            {Object.entries(grouped).map(([seriesId, rows]) => {
              const open = expanded.has(seriesId);
              const byYear: Record<string, EnergyRec[]> = {};
              for (const r of rows) {
                const y = r.period?.slice(0, 4) ?? "Unknown";
                if (!byYear[y]) byYear[y] = [];
                byYear[y].push(r);
              }
              return (
                <div key={seriesId} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
                  <button
                    onClick={() => toggleExpand(seriesId)}
                    style={{ width: "100%", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: 12, background: open ? "var(--green-tint)" : "var(--surface-raised)", border: "none", cursor: "pointer", textAlign: "left", borderBottom: open ? "1px solid var(--border)" : "none" }}
                  >
                    <span style={{ fontSize: "0.75rem", color: open ? "var(--green-deep)" : "var(--ink-4)", transition: "transform 0.15s", display: "inline-block", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)" }}>{SERIES_NAMES[seriesId] ?? seriesId}</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{seriesId}</div>
                    </div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "var(--surface-muted)", color: "var(--ink-4)", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>{rows.length} records</span>
                    <Link href={`/series/${seriesId}`} style={{ fontSize: "0.65rem", color: "var(--green)", textDecoration: "none", padding: "2px 8px", border: "1px solid var(--green-line)", borderRadius: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>View Series →</Link>
                  </button>

                  {open && Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a)).map(([year, yearRows]) => (
                    <div key={year}>
                      <div style={{ padding: "0.35rem 1.25rem 0.35rem 2.75rem", background: "var(--surface-muted)", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)" }}>
                        {year} · {yearRows.length} records
                      </div>
                      <div className="data-table-wrap" style={{ border: "none", borderRadius: 0, borderBottom: "1px solid var(--border)" }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>Region</th>
                              <th style={{ textAlign: "right" }}>Value</th>
                              <th>Unit</th>
                              <th>Source</th>
                              <th>Committed</th>
                              <th style={{ width: 52 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearRows.sort((a, b) => a.period_date.localeCompare(b.period_date)).map(r => (
                              <tr key={r.id}>
                                <td className="td-mono td-primary">{r.period}</td>
                                <td style={{ fontSize: "0.78rem" }}>{r.region}</td>
                                <td className="td-num">{r.value != null ? Number(r.value).toLocaleString() : "—"}</td>
                                <td style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{r.unit}</td>
                                <td style={{ fontSize: "0.72rem", color: "var(--ink-4)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source ?? "—"}</td>
                                <td style={{ fontSize: "0.68rem", color: "var(--ink-5)", whiteSpace: "nowrap" }}>
                                  {r.created_at ? new Date(r.created_at).toLocaleDateString("en-NG") : "—"}
                                </td>
                                <td style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => openHistory(r)} style={{ padding: "2px 8px", fontSize: "0.68rem", background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--ink-4)", cursor: "pointer" }}>Hist</button>
                                  <button
                                    onClick={() => deleteRecord(r.id)}
                                    disabled={deleting === r.id}
                                    style={{ padding: "2px 8px", fontSize: "0.68rem", background: "none", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 4, color: "#C0392B", cursor: "pointer", opacity: deleting === r.id ? 0.4 : 1 }}
                                  >
                                    {deleting === r.id ? "…" : "Del"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          /* FLAT TABLE */
          <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1.25rem", background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{filtered.length.toLocaleString()} records</span>
            </div>
            <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>Series</th>
                    <th>Period</th>
                    <th>Region</th>
                    <th style={{ textAlign: "right" }}>Value</th>
                    <th>Unit</th>
                    <th>Source</th>
                    <th>Committed</th>
                    <th style={{ width: 52 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ color: "var(--ink-5)", fontSize: "0.68rem" }}>{i + 1}</td>
                      <td style={{ fontSize: "0.72rem", color: "var(--green-deep)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SERIES_NAMES[r.series_type_id] ?? r.series_type_id}</td>
                      <td className="td-mono td-primary">{r.period}</td>
                      <td style={{ fontSize: "0.78rem" }}>{r.region}</td>
                      <td className="td-num">{r.value != null ? Number(r.value).toLocaleString() : "—"}</td>
                      <td style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{r.unit}</td>
                      <td style={{ fontSize: "0.72rem", color: "var(--ink-4)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source ?? "—"}</td>
                      <td style={{ fontSize: "0.68rem", color: "var(--ink-5)", whiteSpace: "nowrap" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("en-NG") : "—"}
                      </td>
                      <td style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openHistory(r)} style={{ padding: "2px 8px", fontSize: "0.68rem", background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--ink-4)", cursor: "pointer" }}>Hist</button>
                        <button
                          onClick={() => deleteRecord(r.id)}
                          disabled={deleting === r.id}
                          style={{ padding: "2px 8px", fontSize: "0.68rem", background: "none", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 4, color: "#C0392B", cursor: "pointer" }}
                        >
                          {deleting === r.id ? "…" : "Del"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── HISTORY MODAL ── */}
      {historyRec && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setHistoryRec(null)}>
          <div style={{ background: "#fff", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 640, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                  Record #{historyRec.id} — Change History
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                  {historyRec.series_type_id} · {historyRec.period} · {historyRec.region}
                </div>
                <div style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--ink-4)" }}>
                  Current value: <strong>{historyRec.value != null ? Number(historyRec.value).toLocaleString() : "—"} {historyRec.unit}</strong>
                </div>
              </div>
              <button onClick={() => setHistoryRec(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "var(--ink-4)", lineHeight: 1 }}>×</button>
            </div>
            {/* Modal body */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {historyLoading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--ink-5)" }}>Loading history…</div>
              ) : historyLog.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.82rem" }}>
                  No edits recorded for this record. It has not been modified since it was committed.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "0.6rem 1rem", textAlign: "left", fontWeight: 700, color: "var(--ink-4)", fontSize: "0.65rem", textTransform: "uppercase" }}>When</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, color: "var(--ink-4)", fontSize: "0.65rem", textTransform: "uppercase" }}>By</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 700, color: "var(--ink-4)", fontSize: "0.65rem", textTransform: "uppercase" }}>Action</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 700, color: "var(--ink-4)", fontSize: "0.65rem", textTransform: "uppercase" }}>Old</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 700, color: "var(--ink-4)", fontSize: "0.65rem", textTransform: "uppercase" }}>New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLog.map((e) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.625rem 1rem", color: "var(--ink-5)", whiteSpace: "nowrap" }}>
                          {new Date(e.performed_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--ink)" }}>{e.performed_by}</td>
                        <td style={{ padding: "0.625rem 0.75rem" }}>
                          <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                            background: e.action === "DELETE" ? "var(--red-tint)" : "rgba(230,152,0,0.1)",
                            color: e.action === "DELETE" ? "var(--red)" : "#92400e" }}>
                            {e.action}
                          </span>
                        </td>
                        <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--red)" }}>
                          {e.old_value != null ? Number(e.old_value).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 600, color: "var(--green-deep)" }}>
                          {e.new_value != null ? Number(e.new_value).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

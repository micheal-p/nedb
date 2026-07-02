"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { api, type SeriesType, type ValidateResponse } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";

type UploadState = "idle" | "validating" | "validated" | "committing" | "committed" | "error";

interface ManualRow {
  period: string; period_date: string; region: string;
  value: string; unit: string; source: string; notes: string;
}

const NG_ZONES: Record<string, string[]> = {
  "North West":   ["Jigawa","Kaduna","Kano","Katsina","Kebbi","Sokoto","Zamfara"],
  "North East":   ["Adamawa","Bauchi","Borno","Gombe","Taraba","Yobe"],
  "North Central":["Benue","FCT (Abuja)","Kogi","Kwara","Nasarawa","Niger","Plateau"],
  "South West":   ["Ekiti","Lagos","Ogun","Ondo","Osun","Oyo"],
  "South East":   ["Abia","Anambra","Ebonyi","Enugu","Imo"],
  "South South":  ["Akwa Ibom","Bayelsa","Cross River","Delta","Edo","Rivers"],
};
const STATE_TO_ZONE: Record<string,string> = {};
Object.entries(NG_ZONES).forEach(([z, states]) => states.forEach((s) => { STATE_TO_ZONE[s] = z; }));
const ALL_STATES = Object.values(NG_ZONES).flat().sort();

const EMPTY_ROW: ManualRow = { period: "", period_date: "", region: "NGA", value: "", unit: "", source: "", notes: "" };
const EMPTY_FORM = { ...EMPTY_ROW, state: "NGA", zone: "" };

function buildPeriodOptions(frequency: string): string[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1; // 1-12
  const opts: string[] = [];
  if (frequency === "annual") {
    for (let y = thisYear; y >= 1990; y--) opts.push(String(y));
  } else if (frequency === "quarterly") {
    for (let y = thisYear; y >= 2000; y--) {
      const maxQ = y === thisYear ? Math.ceil(thisMonth / 3) : 4;
      for (let q = maxQ; q >= 1; q--) opts.push(`${y}-Q${q}`);
    }
  } else {
    for (let y = thisYear; y >= 2000; y--) {
      const maxM = y === thisYear ? thisMonth : 12;
      for (let m = maxM; m >= 1; m--) opts.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
}

function periodToDate(period: string): string {
  if (/^\d{4}$/.test(period)) return `${period}-01-01`;
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const q = parseInt(period.slice(-1));
    return `${period.slice(0, 4)}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
  }
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  return period;
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode]       = useState<"file" | "manual">("file");
  const [series, setSeries]   = useState<SeriesType[]>([]);
  const [selectedSeries, setSelectedSeries] = useState("");

  // File upload state
  const [file, setFile]           = useState<File | null>(null);
  const [state, setState]         = useState<UploadState>("idle");
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [committedRows, setCommittedRows] = useState<number | null>(null);
  const [error, setError]         = useState("");
  const [dragging, setDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual entry state
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [rowForm, setRowForm]     = useState(EMPTY_FORM);
  const [manualState, setManualState] = useState<"idle" | "committing" | "committed" | "error">("idle");
  const [manualError, setManualError] = useState("");
  const [manualCommitted, setManualCommitted] = useState<number | null>(null);

  // Committed records (for delete)
  type EnergyRecord = { id: number; series_type_id: string; period: string; value: number; unit: string; region: string; source?: string; created_at: string };
  const [committedRecs, setCommittedRecs] = useState<EnergyRecord[]>([]);
  const [recsLoading, setRecsLoading]     = useState(false);
  const [deletingId, setDeletingId]       = useState<number | null>(null);
  const [deleteMsg, setDeleteMsg]         = useState<string | null>(null);

  const selectedMeta = series.find((s) => s.id === selectedSeries);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/upload"); return; }
    api.listSeries().then(setSeries).catch(() => {});
  }, [router]);

  // Pre-fill unit from series
  useEffect(() => {
    if (selectedMeta) setRowForm((r) => ({ ...r, unit: selectedMeta.unit_default }));
  }, [selectedMeta]);

  // ── File upload handlers ──────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) acceptFile(f);
  }
  function acceptFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx"].includes(ext ?? "")) { setError("Only CSV (.csv) or Excel (.xlsx) files are accepted."); return; }
    setFile(f); setError(""); setValidation(null); setState("idle");
  }
  async function validate() {
    if (!file || !selectedSeries) { setError("Select a data series and attach a file before validating."); return; }
    const token = getToken(); if (!token) { router.replace("/data-point/login?redirect=/upload"); return; }
    setState("validating"); setError("");
    try {
      const fd = new FormData(); fd.append("series_type_id", selectedSeries); fd.append("file", file);
      const result = await api.validateUpload(fd, token);
      setValidation(result); setState("validated");
    } catch (e) { setState("error"); setError(e instanceof Error ? e.message : "Validation failed."); }
  }
  async function commit() {
    if (!validation) return;
    const token = getToken(); if (!token) { router.replace("/data-point/login?redirect=/upload"); return; }
    setState("committing"); setError("");
    try {
      const result = await api.commitUpload(validation.session_id, token);
      setCommittedRows(result.committed_rows); setState("committed"); setValidation(null); setFile(null);
    } catch (e) { setState("error"); setError(e instanceof Error ? e.message : "Commit failed."); }
  }
  function reset() { setState("idle"); setFile(null); setValidation(null); setError(""); setCommittedRows(null); }
  const hasErrors = (validation?.errors ?? []).length > 0;

  // ── Manual entry handlers ────────────────────────────────────
  function addRow(e: React.FormEvent) {
    e.preventDefault();
    if (!rowForm.period || !rowForm.value) { setManualError("Period and Value are required."); return; }
    const date   = rowForm.period_date || periodToDate(rowForm.period);
    const region = rowForm.state !== "NGA" ? rowForm.state : (rowForm.zone || "NGA");
    setManualRows((rows) => [...rows, { period: rowForm.period, period_date: date, region, value: rowForm.value, unit: rowForm.unit || selectedMeta?.unit_default || "", source: rowForm.source, notes: rowForm.notes }]);
    setRowForm((r) => ({ ...EMPTY_FORM, unit: r.unit, state: r.state, zone: r.zone, region: r.region, source: r.source }));
    setManualError("");
  }
  function removeRow(i: number) { setManualRows((rows) => rows.filter((_, idx) => idx !== i)); }
  async function commitManual() {
    if (!manualRows.length || !selectedSeries) { setManualError("Add at least one row and select a series."); return; }
    const token = getToken(); if (!token) { router.replace("/data-point/login?redirect=/upload"); return; }
    setManualState("committing"); setManualError("");
    try {
      const res = await fetch("/api/upload/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ series_type_id: selectedSeries, rows: manualRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Commit failed.");
      setManualCommitted(data.committed_rows); setManualState("committed"); setManualRows([]);
      if (selectedSeries) loadCommittedRecs(selectedSeries);
    } catch (e) { setManualState("error"); setManualError(e instanceof Error ? e.message : "Commit failed."); }
  }
  function resetManual() { setManualState("idle"); setManualRows([]); setManualError(""); setManualCommitted(null); setRowForm(EMPTY_FORM); }

  async function loadCommittedRecs(seriesId: string) {
    if (!seriesId) return;
    setRecsLoading(true); setDeleteMsg(null);
    const r = await fetch(`/api/admin/records?series=${seriesId}&limit=200`);
    setCommittedRecs(r.ok ? (await r.json()).records ?? [] : []);
    setRecsLoading(false);
  }
  async function deleteRecord(id: number) {
    if (!confirm("Delete this record permanently? This cannot be undone.")) return;
    setDeletingId(id);
    const r = await fetch(`/api/admin/records/${id}`, { method: "DELETE" });
    if (r.ok) { setCommittedRecs((prev) => prev.filter((rec) => rec.id !== id)); setDeleteMsg(`Record #${id} deleted.`); }
    else setDeleteMsg("Delete failed — check permissions.");
    setDeletingId(null);
  }

  const TAB = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1.25rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", border: "none",
    background: active ? "var(--surface-white)" : "transparent",
    color: active ? "var(--green)" : "var(--ink-4)",
    borderBottom: active ? "2px solid var(--green)" : "2px solid transparent",
    marginBottom: -1, transition: "color 0.15s",
  });

  return (
    <>
      <Navbar active="upload" />

      {/* Header */}
      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "1.5rem 0" }}>
        <div className="page-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--ink-4)" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span>/</span>
            <span style={{ color: "var(--ink)" }}>Staff Upload Portal</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.2 }}>
                Staff Data Upload Portal
              </h1>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.3rem" }}>
                Authorised ECN / agency personnel. Upload by file or enter data manually.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="tag tag-green"><span className="live-dot" />Authenticated</span>
              <Link href="/admin" className="btn btn-secondary btn-sm">Admin Panel</Link>
            </div>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap">
          <div className="upload-grid">

            {/* LEFT COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Step 1 — Series selection (shared) */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Step 1 — Select Data Series</span>
                </div>
                <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Energy Data Series</label>
                    <select className="form-input form-select" value={selectedSeries}
                      onChange={(e) => { setSelectedSeries(e.target.value); reset(); resetManual(); loadCommittedRecs(e.target.value); }}>
                      <option value="">Select a series…</option>
                      {series.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sector})</option>)}
                    </select>
                  </div>
                  {selectedMeta && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", padding: "0.875rem", background: "var(--surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                      <div><div className="kpi-label">Series ID</div><div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink)", marginTop: 2 }}>{selectedMeta.id}</div></div>
                      <div><div className="kpi-label">Unit</div><div style={{ fontSize: "0.82rem", color: "var(--ink)", marginTop: 2 }}>{selectedMeta.unit_default}</div></div>
                      <div><div className="kpi-label">Frequency</div><div style={{ fontSize: "0.82rem", color: "var(--ink)", marginTop: 2 }}>{selectedMeta.frequency}</div></div>
                      <div style={{ marginLeft: "auto" }}>
                        <a href={api.templateUrl(selectedMeta.id)} className="btn btn-secondary btn-sm" style={{ marginTop: 2 }}>Download Template</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 — Mode tabs */}
              <div className="panel">
                <div style={{ borderBottom: "1px solid var(--border)", display: "flex" }}>
                  <button style={TAB(mode === "file")}   onClick={() => { setMode("file");   resetManual(); }}>File Upload (CSV / XLSX)</button>
                  <button style={TAB(mode === "manual")} onClick={() => { setMode("manual"); reset(); }}>Manual Entry</button>
                </div>

                {/* ── FILE MODE ── */}
                {mode === "file" && (
                  <div className="panel-body">
                    <div className={`dropzone${dragging ? " drag-over" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}>
                      <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />
                      {file ? (
                        <>
                          <div style={{ marginBottom: "0.75rem" }}>
                            <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <h3 style={{ color: "var(--green)" }}>{file.name}</h3>
                          <p>{(file.size / 1024).toFixed(1)} KB &nbsp;·&nbsp; {file.name.endsWith(".xlsx") ? "Excel workbook" : "CSV file"}</p>
                          <button className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }} onClick={(e) => { e.stopPropagation(); reset(); }}>Remove file</button>
                        </>
                      ) : (
                        <>
                          <div style={{ marginBottom: "0.75rem" }}>
                            <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <h3>Drag and drop your dataset here</h3>
                          <p>or click to browse &nbsp;·&nbsp; CSV or XLSX accepted</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── MANUAL MODE ── */}
                {mode === "manual" && (
                  <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                      Fill in data row by row. Each row is added to the queue below, then committed together to the database.
                    </p>

                    {/* Row entry form */}
                    <form onSubmit={addRow}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem 1rem" }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Period *</label>
                          <select className="form-input form-select" value={rowForm.period}
                            onChange={(e) => setRowForm({ ...rowForm, period: e.target.value })}>
                            <option value="">— Select period —</option>
                            {buildPeriodOptions(selectedMeta?.frequency ?? "annual").map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Value *</label>
                          <input className="form-input" type="number" step="any" placeholder="Numeric value"
                            value={rowForm.value} onChange={(e) => setRowForm({ ...rowForm, value: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Unit</label>
                          <input className="form-input" placeholder={selectedMeta?.unit_default ?? "e.g. Barrels"}
                            value={rowForm.unit} onChange={(e) => setRowForm({ ...rowForm, unit: e.target.value })} />
                        </div>

                        {/* State → auto-fills zone */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">State</label>
                          <select className="form-input form-select" value={rowForm.state}
                            onChange={(e) => {
                              const st   = e.target.value;
                              const zone = STATE_TO_ZONE[st] ?? "";
                              setRowForm({ ...rowForm, state: st, zone, region: st !== "NGA" ? st : "NGA" });
                            }}>
                            <option value="NGA">National (NGA)</option>
                            {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>

                        {/* Geopolitical zone — auto-filled or direct select */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Geopolitical Zone</label>
                          <select className="form-input form-select" value={rowForm.zone}
                            onChange={(e) => {
                              const zone = e.target.value;
                              setRowForm({ ...rowForm, zone, state: "NGA", region: zone || "NGA" });
                            }}>
                            <option value="">— Select zone —</option>
                            {Object.keys(NG_ZONES).map((z) => <option key={z} value={z}>{z}</option>)}
                          </select>
                          {rowForm.state !== "NGA" && rowForm.zone && (
                            <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 3 }}>Auto-filled from state</div>
                          )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Source</label>
                          <input className="form-input" placeholder="e.g. NUPRC Q1 2026"
                            value={rowForm.source} onChange={(e) => setRowForm({ ...rowForm, source: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, gridColumn: "2 / -1" }}>
                          <label className="form-label">Notes</label>
                          <input className="form-input" placeholder="Optional — preliminary, revised, etc."
                            value={rowForm.notes} onChange={(e) => setRowForm({ ...rowForm, notes: e.target.value })} />
                        </div>
                      </div>
                      {manualError && (
                        <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.875rem", background: "var(--red-tint)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "var(--r-md)", fontSize: "0.8rem", color: "var(--red)" }}>{manualError}</div>
                      )}
                      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
                        <button type="submit" className="btn btn-secondary" disabled={!selectedSeries}>+ Add Row</button>
                        {manualRows.length > 0 && (
                          <button type="button" className="btn btn-dark" onClick={commitManual} disabled={manualState === "committing"}>
                            {manualState === "committing" ? "Committing…" : `Commit ${manualRows.length} row${manualRows.length > 1 ? "s" : ""} to Database`}
                          </button>
                        )}
                        {(manualState === "committed" || manualState === "error") && (
                          <button type="button" className="btn btn-ghost" style={{ color: "var(--ink-4)", borderColor: "var(--border)" }} onClick={resetManual}>Clear</button>
                        )}
                      </div>
                    </form>

                    {/* Success */}
                    {manualState === "committed" && manualCommitted !== null && (
                      <div style={{ padding: "1rem 1.25rem", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--green-deep)", marginBottom: "0.25rem" }}>Committed successfully</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>
                          {manualCommitted} record{manualCommitted > 1 ? "s" : ""} written to the database.
                          <Link href={`/series/${selectedSeries}`} style={{ color: "var(--green)", fontWeight: 600, marginLeft: 8 }}>View series</Link>
                        </div>
                      </div>
                    )}

                    {/* Queued rows preview */}
                    {manualRows.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                          Queued — {manualRows.length} row{manualRows.length > 1 ? "s" : ""}
                        </div>
                        <div className="data-table-wrap">
                          <table className="data-table" style={{ fontSize: "0.75rem" }}>
                            <thead>
                              <tr><th>Period</th><th>Value</th><th>Unit</th><th>State / Region</th><th>Zone</th><th>Source</th><th></th></tr>
                            </thead>
                            <tbody>
                              {manualRows.map((r, i) => (
                                <tr key={i}>
                                  <td className="td-mono">{r.period}</td>
                                  <td className="td-mono td-num">{Number(r.value).toLocaleString()}</td>
                                  <td>{r.unit}</td>
                                  <td>{r.region}</td>
                                  <td style={{ color: "var(--ink-4)", fontSize: "0.7rem" }}>{STATE_TO_ZONE[r.region] ?? "—"}</td>
                                  <td style={{ color: "var(--ink-4)" }}>{r.source || "—"}</td>
                                  <td>
                                    <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "0.72rem", padding: "2px 6px" }}>✕</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* File upload: actions + validation */}
              {mode === "file" && (
                <>
                  {error && (
                    <div style={{ padding: "0.875rem 1rem", background: "var(--red-tint)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--red)" }}>{error}</div>
                  )}
                  {state === "committed" && committedRows !== null && (
                    <div style={{ padding: "1rem 1.25rem", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--green-deep)", marginBottom: "0.25rem" }}>Dataset committed successfully</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>
                        {committedRows.toLocaleString()} records written to the database.
                        <Link href={`/series/${selectedSeries}`} style={{ color: "var(--green)", fontWeight: 600, marginLeft: 8 }}>View series</Link>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {state !== "committed" && (
                      <button className="btn btn-primary" onClick={validate} disabled={!file || !selectedSeries || state === "validating" || state === "committing"}>
                        {state === "validating" ? "Validating…" : "Validate Dataset"}
                      </button>
                    )}
                    {(state === "validated" || state === "committing") && !hasErrors && (
                      <button className="btn btn-dark" onClick={commit} disabled={state === "committing"}>
                        {state === "committing" ? "Committing…" : "Commit to Database"}
                      </button>
                    )}
                    {(state === "validated" || state === "committed" || state === "error") && (
                      <button className="btn btn-secondary" onClick={reset}>Start Over</button>
                    )}
                  </div>
                  {validation && (
                    <div className="panel">
                      <div className="panel-header">
                        <span className="panel-title">Validation Report</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span className="tag tag-green">{validation.valid_rows} valid</span>
                          {hasErrors && <span className="tag tag-red">{(validation.errors ?? []).length} errors</span>}
                        </div>
                      </div>
                      {hasErrors ? (
                        <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                          <table className="data-table">
                            <thead><tr><th>Row</th><th>Column</th><th>Error Type</th><th>Message</th><th>Raw Value</th></tr></thead>
                            <tbody>
                              {(validation.errors ?? []).slice(0, 50).map((err, i) => (
                                <tr key={i} className="tr-error">
                                  <td className="td-mono">{err.row_number}</td>
                                  <td className="td-primary">{err.column_name}</td>
                                  <td><span className="err-chip">{err.error_type}</span></td>
                                  <td>{err.error_message}</td>
                                  <td className="td-mono">{err.raw_value ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="panel-body" style={{ fontSize: "0.82rem", color: "var(--ink-3)" }}>
                          All {validation.total_rows} rows passed validation. Click <strong>Commit to Database</strong> to write the records.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: SIDEBAR */}
            <div className="upload-sidebar" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">{mode === "manual" ? "Manual Entry Guide" : "Upload Guidelines"}</span></div>
                <div className="panel-body" style={{ fontSize: "0.8rem", color: "var(--ink-3)", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  {mode === "manual" ? (
                    <>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>Period formats</div>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", lineHeight: 1.9 }}>
                          Annual: YYYY<br />Quarterly: YYYY-Q1<br />Monthly: YYYY-MM
                        </p>
                      </div>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>Region codes</div>
                        <p>Use <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>NGA</span> for national total. State codes: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>LAG, ABJ, RIV, KAN</span>…</p>
                      </div>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>Commit in bulk</div>
                        <p>Add all rows first, then commit once. Each commit creates a single audit session attributed to your account.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>1. Download the template</div>
                        <p>Use the series-specific XLSX template to ensure columns are named exactly as expected.</p></div>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>2. Period format</div>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", lineHeight: 1.9 }}>Annual: YYYY<br />Quarterly: YYYY-QN<br />Monthly: YYYY-MM</p></div>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>3. Validate first</div>
                        <p>Errors are listed row-by-row with column references. Fix and re-upload.</p></div>
                      <div><div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>4. Rate limit</div>
                        <p>Maximum 5 validation requests per hour per session.</p></div>
                    </>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><span className="panel-title">Required Columns (File Upload)</span></div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.75rem" }}>
                    <thead><tr><th>Column</th><th>Required</th></tr></thead>
                    <tbody>
                      {[["period",true],["region",true],["fuel_product",true],["value",true],["unit",true],["source",true],["notes",false],["methodology_version",false]].map(([col, req]) => (
                        <tr key={String(col)}>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{col}</td>
                          <td><span className={`tag ${req ? "tag-red" : "tag-muted"}`} style={{ fontSize: "0.6rem" }}>{req ? "Required" : "Optional"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: "1rem", background: "var(--surface-muted)", borderRadius: "var(--r-md)", border: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                Issues? Contact the NEDB system administrator or the ECN Data Management Unit.
              </div>
            </div>

            {/* ── COMMITTED RECORDS (delete) — spans full width below the two columns ── */}
            {selectedSeries && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Committed Records — {series.find((s) => s.id === selectedSeries)?.name ?? selectedSeries}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {deleteMsg && <span style={{ fontSize: "0.72rem", color: deleteMsg.includes("failed") ? "var(--red)" : "var(--green-deep)", fontWeight: 600 }}>{deleteMsg}</span>}
                      <button className="btn btn-secondary" style={{ height: 30, padding: "0 12px", fontSize: "0.72rem" }}
                        onClick={() => loadCommittedRecs(selectedSeries)} disabled={recsLoading}>
                        {recsLoading ? "Loading…" : "Refresh"}
                      </button>
                    </div>
                  </div>
                  <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                    {recsLoading ? (
                      <div style={{ padding: "2rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
                    ) : committedRecs.length === 0 ? (
                      <div style={{ padding: "2rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", color: "var(--ink-5)" }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)" }}>No committed records yet</div>
                        <div style={{ fontSize: "0.72rem" }}>Select a series above — records will load automatically.</div>
                      </div>
                    ) : (
                      <table className="data-table" style={{ fontSize: "0.75rem" }}>
                        <thead>
                          <tr><th>ID</th><th>Period</th><th className="td-num">Value</th><th>Unit</th><th>Region</th><th>Zone</th><th>Source</th><th>Added</th><th></th></tr>
                        </thead>
                        <tbody>
                          {committedRecs.map((rec) => (
                            <tr key={rec.id}>
                              <td style={{ color: "var(--ink-5)", fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>#{rec.id}</td>
                              <td className="td-mono">{rec.period}</td>
                              <td className="td-num td-mono">{Number(rec.value).toLocaleString()}</td>
                              <td>{rec.unit}</td>
                              <td>{rec.region ?? "NGA"}</td>
                              <td style={{ color: "var(--ink-4)", fontSize: "0.7rem" }}>{STATE_TO_ZONE[rec.region] ?? "—"}</td>
                              <td style={{ color: "var(--ink-4)" }}>{rec.source ?? "—"}</td>
                              <td style={{ color: "var(--ink-5)", fontSize: "0.7rem" }}>{new Date(rec.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                              <td>
                                <button onClick={() => deleteRecord(rec.id)} disabled={deletingId === rec.id}
                                  style={{ padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(192,57,43,0.3)", borderRadius: 4, background: "rgba(192,57,43,0.06)", color: "var(--red)", cursor: "pointer", opacity: deletingId === rec.id ? 0.5 : 1 }}>
                                  {deletingId === rec.id ? "…" : "Delete"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {committedRecs.length > 0 && (
                    <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--ink-5)" }}>
                      {committedRecs.length} record{committedRecs.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </>
  );
}

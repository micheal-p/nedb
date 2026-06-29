"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { api, type SeriesType, type ValidateResponse } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";

type UploadState = "idle" | "validating" | "validated" | "committing" | "committed" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [series, setSeries] = useState<SeriesType[]>([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [committedRows, setCommittedRows] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Middleware handles the redirect, but double-check on client in case cookie just expired
    if (!isLoggedIn()) {
      router.replace("/data-point/login?redirect=/upload");
      return;
    }
    api.listSeries().then(setSeries).catch(() => {});
  }, [router]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }

  function acceptFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx"].includes(ext ?? "")) {
      setError("Only CSV (.csv) or Excel (.xlsx) files are accepted.");
      return;
    }
    setFile(f);
    setError("");
    setValidation(null);
    setState("idle");
  }

  async function validate() {
    if (!file || !selectedSeries) {
      setError("Select a data series and attach a file before validating.");
      return;
    }
    const token = getToken();
    if (!token) { router.replace("/data-point/login?redirect=/upload"); return; }
    setState("validating");
    setError("");
    try {
      const fd = new FormData();
      fd.append("series_type_id", selectedSeries);
      fd.append("file", file);
      const result = await api.validateUpload(fd, token);
      setValidation(result);
      setState("validated");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Validation failed. Check your file format.");
    }
  }

  async function commit() {
    if (!validation) return;
    const token = getToken();
    if (!token) { router.replace("/data-point/login?redirect=/upload"); return; }
    setState("committing");
    setError("");
    try {
      const result = await api.commitUpload(validation.session_id, token);
      setCommittedRows(result.committed_rows);
      setState("committed");
      setValidation(null);
      setFile(null);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Commit failed. Contact the system administrator.");
    }
  }

  function reset() {
    setState("idle");
    setFile(null);
    setValidation(null);
    setError("");
    setCommittedRows(null);
  }

  const selectedMeta = series.find((s) => s.id === selectedSeries);
  const hasErrors = (validation?.errors ?? []).length > 0;

  return (
    <>
      <Navbar active="upload" />

      {/* ── HEADER ── */}
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
                Authorised ECN / agency personnel only. Upload energy datasets in CSV or XLSX format.
              </p>
            </div>
            <span className="tag tag-green">
              <span className="live-dot" />
              Authenticated Session
            </span>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap">
          <div className="upload-grid">

            {/* ── LEFT: UPLOAD FORM ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Step 1 — Series selection */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Step 1 — Select Data Series</span>
                </div>
                <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Energy Data Series</label>
                    <select
                      className="form-input form-select"
                      value={selectedSeries}
                      onChange={(e) => { setSelectedSeries(e.target.value); reset(); }}
                    >
                      <option value="">Select a series…</option>
                      {series.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.sector})</option>
                      ))}
                    </select>
                  </div>

                  {selectedMeta && (
                    <div style={{ display: "flex", gap: "1rem", padding: "0.875rem", background: "var(--surface)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                      <div>
                        <div className="kpi-label">Series ID</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink)", marginTop: 2 }}>{selectedMeta.id}</div>
                      </div>
                      <div>
                        <div className="kpi-label">Default Unit</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--ink)", marginTop: 2 }}>{selectedMeta.unit_default}</div>
                      </div>
                      <div>
                        <div className="kpi-label">Frequency</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--ink)", marginTop: 2 }}>{selectedMeta.frequency}</div>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <a
                          href={api.templateUrl(selectedMeta.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: 2 }}
                        >
                          Download Template
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 — File upload */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Step 2 — Attach Dataset File</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>CSV or XLSX</span>
                </div>
                <div className="panel-body">
                  <div
                    className={`dropzone${dragging ? " drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.xlsx"
                      style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
                    />
                    {file ? (
                      <>
                        <div style={{ marginBottom: "0.75rem" }}>
                          <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <h3 style={{ color: "var(--green)" }}>{file.name}</h3>
                        <p>{(file.size / 1024).toFixed(1)} KB &nbsp;·&nbsp; {file.name.endsWith(".xlsx") ? "Excel workbook" : "CSV file"}</p>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: "0.75rem" }}
                          onClick={(e) => { e.stopPropagation(); reset(); }}
                        >
                          Remove file
                        </button>
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
              </div>

              {/* Step 3 — Validate / Commit actions */}
              {error && (
                <div style={{ padding: "0.875rem 1rem", background: "var(--red-tint)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--red)" }}>
                  {error}
                </div>
              )}

              {state === "committed" && committedRows !== null && (
                <div style={{ padding: "1rem 1.25rem", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--green-deep)", marginBottom: "0.25rem" }}>
                    Dataset committed successfully
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>
                    {committedRows.toLocaleString()} records written to the database.
                    <Link href={`/series/${selectedSeries}`} style={{ color: "var(--green)", fontWeight: 600, marginLeft: 8 }}>
                      View series
                    </Link>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem" }}>
                {state !== "committed" && (
                  <button
                    className="btn btn-primary"
                    onClick={validate}
                    disabled={!file || !selectedSeries || state === "validating" || state === "committing"}
                  >
                    {state === "validating" ? "Validating…" : "Validate Dataset"}
                  </button>
                )}
                {(state === "validated" || state === "committing") && !hasErrors && (
                  <button
                    className="btn btn-dark"
                    onClick={commit}
                    disabled={state === "committing"}
                  >
                    {state === "committing" ? "Committing…" : "Commit to Database"}
                  </button>
                )}
                {(state === "validated" || state === "committed" || state === "error") && (
                  <button className="btn btn-secondary" onClick={reset}>
                    Start Over
                  </button>
                )}
              </div>

              {/* Validation results */}
              {validation && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Validation Report</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className="tag tag-green">{validation.valid_rows} valid</span>
                      {hasErrors && (
                        <span className="tag tag-red">{(validation.errors ?? []).length} errors</span>
                      )}
                    </div>
                  </div>
                  {hasErrors ? (
                    <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Column</th>
                            <th>Error Type</th>
                            <th>Message</th>
                            <th>Raw Value</th>
                          </tr>
                        </thead>
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
                      All {validation.total_rows} rows passed validation. Review the summary then
                      click <strong>Commit to Database</strong> to write the records.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT: SIDEBAR GUIDANCE ── */}
            <div className="upload-sidebar" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Upload Guidelines</span>
                </div>
                <div className="panel-body" style={{ fontSize: "0.8rem", color: "var(--ink-3)", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>1. Download the template</div>
                    <p>Use the series-specific XLSX template to ensure columns are in the correct order and named exactly as expected.</p>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>2. Period format</div>
                    <p>
                      Annual: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>YYYY</span><br />
                      Quarterly: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>YYYY-QN</span><br />
                      Monthly: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>YYYY-MM</span>
                    </p>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>3. Required columns</div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", lineHeight: 1.8 }}>
                      period<br />region<br />fuel_product<br />value<br />unit<br />source
                    </p>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>4. Validation first</div>
                    <p>Validate before committing. Rows with errors will be listed with column references. Fix and re-upload.</p>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>5. Rate limit</div>
                    <p>Maximum 5 validation requests per hour per session.</p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Required Columns</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.75rem" }}>
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["period", true],
                        ["region", true],
                        ["fuel_product", true],
                        ["value", true],
                        ["unit", true],
                        ["source", true],
                        ["notes", false],
                        ["methodology_version", false],
                      ].map(([col, req]) => (
                        <tr key={String(col)}>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{col}</td>
                          <td>
                            <span className={`tag ${req ? "tag-red" : "tag-muted"}`} style={{ fontSize: "0.6rem" }}>
                              {req ? "Required" : "Optional"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: "1rem", background: "var(--surface-muted)", borderRadius: "var(--r-md)", border: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                Having trouble? Contact the NEDB system administrator or the ECN Data Management Unit.
              </div>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}

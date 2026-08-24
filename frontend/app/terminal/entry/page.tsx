"use client";

// ── /terminal/entry — Entry grid ────────────────────────────────────────────
// Keying a year of monthly figures through a form is twelve rounds of select,
// type, submit, wait. This is a grid driven from the keyboard the way anyone
// who enters numbers for a living actually works: pick a series and a year
// once, then type down the column. Enter moves down, a column pasted out of a
// spreadsheet fills the grid, what is already on file sits beside each field so
// you can see what you are about to change, and nothing is written until the
// batch is committed.

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getTokenFresh, getRole, isAdminRole } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";

type Series = { id: string; name: string; sector: string; unit_default: string; frequency: string };
type Cell = { period: string; label: string; value: string; note: string; error: string | null };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function authed(url: string, init?: RequestInit) {
  const token = await getTokenFresh();
  return fetch(url, {
    ...init, credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

function buildRows(frequency: string, year: number): { period: string; label: string }[] {
  if (frequency === "monthly")   return MONTHS.map((m, i) => ({ period: `${year}-${String(i + 1).padStart(2, "0")}`, label: m }));
  if (frequency === "quarterly") return [1, 2, 3, 4].map((q) => ({ period: `${year}-Q${q}`, label: `Quarter ${q}` }));
  return [{ period: String(year), label: String(year) }];
}

function periodToDate(p: string): string {
  if (/^\d{4}$/.test(p)) return `${p}-01-01`;
  const q = p.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `${q[1]}-${String((Number(q[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
  return `${p}-01`;
}

function EntryGrid() {
  const params = useSearchParams();
  const [series, setSeries] = useState<Series[]>([]);
  const [seriesId, setSeriesId] = useState(params.get("series") ?? "");
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [region, setRegion] = useState("NGA");
  const [source, setSource] = useState("");
  const [cells, setCells] = useState<Cell[]>([]);
  const [existing, setExisting] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const current = series.find((s) => s.id === seriesId);
  const canCommit = isAdminRole(getRole());

  useEffect(() => {
    authed("/api/terminal/pipeline")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.series?.length) return;
        setSeries(j.series);
        setSeriesId((prev) => prev || j.series[0].id);
      })
      .catch(() => {});
  }, []);

  const loadGrid = useCallback(async () => {
    if (!seriesId || !current) return;
    setLoading(true); setResult(null); setError("");
    const rows = buildRows(current.frequency, year);
    try {
      const r = await authed(`/api/admin/records?series=${seriesId}&year=${year}&limit=500`);
      const j = await r.json();
      const map: Record<string, number> = {};
      for (const rec of j.records ?? []) {
        if ((rec.region ?? "NGA") === region) map[rec.period] = Number(rec.value);
      }
      setExisting(map);
    } catch {
      setExisting({});
    } finally {
      setCells(rows.map((r) => ({ ...r, value: "", note: "", error: null })));
      setLoading(false);
    }
  }, [seriesId, year, region, current]);
  useEffect(() => { loadGrid(); }, [loadGrid]);

  const validate = (raw: string): string | null => {
    if (!raw.trim()) return null;                  // blank means skip
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n)) return "Not a number";
    if (n < 0) return "Negative";
    return null;
  };

  const setCell = (i: number, patch: Partial<Cell>) =>
    setCells((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch, error: patch.value !== undefined ? validate(patch.value) : c.error } : c)));

  /** A column pasted from a spreadsheet fills down from the row it lands on. */
  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes("\t")) return;
    e.preventDefault();
    const values = text.split(/[\r\n]+/).map((s) => s.split("\t")[0].trim()).filter((s) => s !== "");
    setCells((prev) => prev.map((c, j) => {
      if (j < i || j - i >= values.length) return c;
      const v = values[j - i];
      return { ...c, value: v, error: validate(v) };
    }));
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); inputs.current[i + 1]?.focus(); inputs.current[i + 1]?.select(); }
    else if (e.key === "ArrowUp")                   { e.preventDefault(); inputs.current[i - 1]?.focus(); inputs.current[i - 1]?.select(); }
  }

  const filled   = cells.filter((c) => c.value.trim() !== "");
  const invalid  = filled.filter((c) => c.error);
  const changing = filled.filter((c) => existing[c.period] !== undefined && Number(c.value.replace(/,/g, "")) !== existing[c.period]);

  async function commit() {
    if (!current) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const rows = filled.map((c) => ({
        period: c.period,
        period_date: periodToDate(c.period),
        value: Number(c.value.replace(/,/g, "")),
        unit: current.unit_default,
        region,
        source: source.trim() || null,
        notes: c.note.trim() || null,
      }));
      const r = await authed("/api/upload/manual", { method: "POST", body: JSON.stringify({ series_type_id: seriesId, rows }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Commit failed. Nothing was written."); return; }
      setResult(j.message ?? (j.pending_review ? "Submitted for approval." : "Committed."));
      loadGrid();
    } catch {
      setError("Network error. Nothing was written.");
    } finally {
      setBusy(false); setConfirm(false);
    }
  }

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => now - i);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

      {/* Batch header */}
      <div className="term-card" style={{ padding: "0.9rem 1rem" }}>
        <div className="grid-4" style={{ gap: "0.7rem" }}>
          <label style={{ gridColumn: "span 2" }}>
            <span className="form-label">Series</span>
            <select className="form-input form-select" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
              {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">Year</span>
            <select className="form-input form-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">Region</span>
            <input className="form-input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="NGA" />
          </label>
        </div>
        <label style={{ display: "block", marginTop: "0.7rem" }}>
          <span className="form-label">Source — applied to every figure in this batch</span>
          <input className="form-input" value={source} onChange={(e) => setSource(e.target.value)}
            placeholder="NUPRC Monthly Production Report, August 2026" />
        </label>
        {current && (
          <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: "0.55rem" }}>
            Entering <strong style={{ color: "var(--ink)" }}>{current.frequency}</strong> figures in{" "}
            <strong style={{ color: "var(--ink)" }}>{current.unit_default}</strong>. Leave a row blank to skip it.
          </div>
        )}
      </div>

      {result && <div style={{ fontSize: "var(--t-base)", color: "var(--green-deep)", background: "var(--green-tint)", border: "1px solid var(--green)", padding: "0.65rem 0.9rem" }}>{result}</div>}
      {error  && <div style={{ fontSize: "var(--t-base)", color: "var(--red)", background: "var(--red-tint)", border: "1px solid var(--red)", padding: "0.65rem 0.9rem" }}>{error}</div>}

      {/* Grid */}
      <div className="term-card">
        <div className="term-card-head">
          <span className="term-card-title">{current?.name ?? "Select a series"} · {year}</span>
          <span className="term-card-meta">
            {loading ? "Loading…" : `${filled.length} entered${invalid.length ? ` · ${invalid.length} invalid` : ""}${changing.length ? ` · ${changing.length} replacing` : ""}`}
          </span>
        </div>
        <div className="scroll-x">
          <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
            <thead>
              <tr>
                <th style={{ width: 128 }}>Period</th>
                <th style={{ width: 140, textAlign: "right" }}>On file</th>
                <th style={{ width: 180 }}>New value</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((c, i) => {
                const prior = existing[c.period];
                const entered = c.value.trim() !== "";
                const newVal = entered ? Number(c.value.replace(/,/g, "")) : null;
                const isChange = prior !== undefined && newVal != null && newVal !== prior;
                return (
                  <tr key={c.period} style={{ background: c.error ? "var(--red-tint)" : isChange ? "var(--amber-tint)" : undefined }}>
                    <td className="td-primary">
                      {c.label}
                      <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{c.period}</div>
                    </td>
                    <td style={{ textAlign: "right", color: prior !== undefined ? "var(--ink-3)" : "var(--ink-5)", fontVariantNumeric: "tabular-nums" }}>
                      {prior !== undefined ? prior.toLocaleString() : "—"}
                    </td>
                    <td>
                      <input
                        ref={(el) => { inputs.current[i] = el; }}
                        className="form-input"
                        value={c.value}
                        inputMode="decimal"
                        onChange={(e) => setCell(i, { value: e.target.value })}
                        onKeyDown={(e) => onKey(i, e)}
                        onPaste={(e) => onPaste(i, e)}
                        aria-invalid={!!c.error}
                        placeholder={prior !== undefined ? "unchanged" : "—"}
                        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", minHeight: 34 }}
                      />
                      {c.error && <div style={{ fontSize: "var(--t-2xs)", color: "var(--red)", marginTop: 2 }}>{c.error}</div>}
                      {isChange && !c.error && (
                        <div style={{ fontSize: "var(--t-2xs)", color: "var(--amber)", marginTop: 2 }}>Replaces {prior.toLocaleString()}</div>
                      )}
                    </td>
                    <td>
                      <input className="form-input" value={c.note} onChange={(e) => setCell(i, { note: e.target.value })}
                        placeholder="Revised, provisional…" style={{ minHeight: 34 }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="chart-source">
          Enter or ↓ moves down · ↑ moves up · paste a column from a spreadsheet to fill from that row.
        </div>
      </div>

      {/* Commit */}
      {confirm ? (
        <ConfirmPanel
          title={canCommit ? `Commit ${filled.length} figure${filled.length === 1 ? "" : "s"}?` : `Submit ${filled.length} figure${filled.length === 1 ? "" : "s"} for approval?`}
          body={canCommit
            ? `${filled.length - changing.length} new and ${changing.length} replacing an existing value for ${current?.name}, ${year}. Replacements are written to the public revision log with their old and new values.`
            : "The batch is staged for an administrator to review. Nothing reaches the published data until it is approved."}
          confirmLabel={canCommit ? "Commit batch" : "Submit for approval"}
          busy={busy}
          onConfirm={commit}
          onCancel={() => setConfirm(false)}
        />
      ) : (
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={!filled.length || invalid.length > 0 || busy} onClick={() => setConfirm(true)}>
            {canCommit ? "Commit batch" : "Submit for approval"}
          </button>
          <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>
            {invalid.length > 0 ? `${invalid.length} value${invalid.length === 1 ? "" : "s"} need fixing first.`
              : filled.length === 0 ? "Nothing entered yet."
              : `${filled.length} ready${changing.length ? `, ${changing.length} replacing an existing value` : ""}.`}
          </span>
          <Link href="/terminal" style={{ marginLeft: "auto", fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>← Pipeline</Link>
        </div>
      )}
    </div>
  );
}

export default function EntryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "1rem", color: "var(--ink-5)" }}>Loading…</div>}>
      <EntryGrid />
    </Suspense>
  );
}

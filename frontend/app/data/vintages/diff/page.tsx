"use client";

// ── /data/vintages/diff — what changed between editions ─────────────────────
// Pick two editions and see exactly what moved: records added, removed, and
// revised per series, by comparing the two frozen downloads in the browser.
// This turns the revision culture into a visible product — anyone can hold
// two editions of the record side by side.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type VRow = { label: string; title: string; checksum: string };
type Snapshot = { series: { id: string; name: string }[]; records: Record<string, { id: number; period?: string; value?: number }[]> };
type SeriesDiff = { id: string; name: string; added: number; removed: number; changed: number; before: number; after: number };

export default function VintageDiffPage() {
  const [vintages, setVintages] = useState<VRow[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<SeriesDiff[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/vintages").then((r) => (r.ok ? r.json() : [])).then((rows: VRow[]) => {
      setVintages(rows);
      if (rows.length >= 2) { setA(rows[1].label); setB(rows[0].label); }
    }).catch(() => {});
  }, []);

  const run = useCallback(async () => {
    if (!a || !b || a === b) { setMsg("Pick two different editions."); return; }
    setBusy(true); setMsg(""); setDiff(null);
    try {
      const [sa, sb] = await Promise.all([
        fetch(`/api/vintages/${encodeURIComponent(a)}/download`).then((r) => r.json() as Promise<Snapshot>),
        fetch(`/api/vintages/${encodeURIComponent(b)}/download`).then((r) => r.json() as Promise<Snapshot>),
      ]);
      const names = new Map<string, string>();
      for (const s of [...(sa.series ?? []), ...(sb.series ?? [])]) names.set(s.id, s.name);
      const ids = new Set([...Object.keys(sa.records ?? {}), ...Object.keys(sb.records ?? {})]);
      const out: SeriesDiff[] = [];
      for (const id of ids) {
        const ra = new Map(((sa.records?.[id]) ?? []).map((r) => [r.id, r]));
        const rb = new Map(((sb.records?.[id]) ?? []).map((r) => [r.id, r]));
        let added = 0, removed = 0, changed = 0;
        for (const [rid, rec] of rb) {
          if (!ra.has(rid)) added++;
          else if (ra.get(rid)!.value !== rec.value) changed++;
        }
        for (const rid of ra.keys()) if (!rb.has(rid)) removed++;
        if (added || removed || changed || ra.size !== rb.size) {
          out.push({ id, name: names.get(id) ?? id, added, removed, changed, before: ra.size, after: rb.size });
        }
      }
      setDiff(out.sort((x, y) => (y.added + y.removed + y.changed) - (x.added + x.removed + x.changed)));
      if (!out.length) setMsg("No series-level differences between these editions.");
    } catch {
      setMsg("Could not load one of the editions — a priced edition needs its download token.");
    } finally {
      setBusy(false);
    }
  }, [a, b]);

  return (
    <>
    <Navbar active="vintages" />
    <main style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>Editions of Record</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Between editions</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 620, lineHeight: 1.6 }}>
            Two frozen editions, compared record by record in your browser: what was added, what was removed, and
            which figures were revised. <Link href="/data/vintages" style={{ color: "var(--green)" }}>Back to the catalogue</Link>.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end", background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <label style={{ flex: "1 1 180px" }}>
            <span className="form-label">From edition</span>
            <select className="form-input form-select" value={a} onChange={(e) => setA(e.target.value)}>
              <option value="">Choose…</option>
              {vintages.map((v) => <option key={v.label} value={v.label}>{v.label} — {v.title}</option>)}
            </select>
          </label>
          <label style={{ flex: "1 1 180px" }}>
            <span className="form-label">To edition</span>
            <select className="form-input form-select" value={b} onChange={(e) => setB(e.target.value)}>
              <option value="">Choose…</option>
              {vintages.map((v) => <option key={v.label} value={v.label}>{v.label} — {v.title}</option>)}
            </select>
          </label>
          <button className="btn btn-primary btn-sm" disabled={busy || !a || !b} onClick={run}>{busy ? "Comparing…" : "Compare"}</button>
        </div>

        {msg && <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", marginBottom: "1rem" }}>{msg}</div>}

        {diff && diff.length > 0 && (
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
              <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Series</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Records {a} → {b}</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Added</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Removed</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Revised</th>
              </tr></thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{d.name}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{d.before} → {d.after}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: d.added ? "var(--green)" : "var(--ink-5)" }}>{d.added || "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: d.removed ? "var(--red)" : "var(--ink-5)" }}>{d.removed || "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: d.changed ? "var(--amber)" : "var(--ink-5)" }}>{d.changed || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
    <Footer />
    </>
  );
}

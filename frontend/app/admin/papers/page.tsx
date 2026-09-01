"use client";

// Admin console for the working paper series: generate a paper from a
// published assessment against a frozen vintage, read the draft, publish it.
// Nothing in a paper is typed by hand — that is the reproducibility claim.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRole, isAdminRole, isLoggedIn, getTokenFresh } from "@/lib/auth";

type Paper = {
  paper_no: string; title: string; authors: string | null; status: string;
  published_at: string | null; created_at: string;
  vintage: { label: string } | null;
};
type FormRow = { id: number; title: string; is_public_stats: boolean; status: string; response_count: number };
type Vintage = { id: number; label: string; title: string; is_published: boolean };
type SeriesOpt = { id: string; name: string };

const slugOf = (paperNo: string) => {
  const m = paperNo.match(/NEDB\/WP\/(\d{4})\/(\d+)/);
  return m ? `${m[1]}-${m[2]}` : "";
};

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

export default function AdminPapersPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [vintages, setVintages] = useState<Vintage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<"assessment" | "series">("assessment");
  const [seriesList, setSeriesList] = useState<SeriesOpt[]>([]);
  const [pickedSeries, setPickedSeries] = useState<string[]>([]);
  const [formId, setFormId] = useState("");
  const [vintageId, setVintageId] = useState("");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");

  const load = useCallback(async () => {
    const [p, f, v] = await Promise.all([
      authed("/api/papers").then((r) => (r.ok ? r.json() : [])),
      authed("/api/pena/forms").then((r) => (r.ok ? r.json() : [])),
      authed("/api/vintages").then((r) => (r.ok ? r.json() : [])),
    ]);
    setPapers(p); setForms((f as FormRow[]).filter((x) => x.is_public_stats && x.status !== "draft")); setVintages(v);
    fetch("/api/series").then((r) => (r.ok ? r.json() : [])).then((j) => setSeriesList((j as SeriesOpt[]) ?? [])).catch(() => {});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/papers"); return; }
    if (!isAdminRole(getRole())) { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  async function generate() {
    setBusy(true); setMsg("");
    const payload = kind === "series"
      ? { kind: "series", series_ids: pickedSeries, vintage_id: vintageId ? Number(vintageId) : undefined, title: title || undefined, authors: authors || undefined }
      : { pena_form_id: Number(formId), vintage_id: vintageId ? Number(vintageId) : undefined, title: title || undefined, authors: authors || undefined };
    const r = await authed("/api/papers", { method: "POST", body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Generation failed."); return; }
    setMsg(`Generated ${j.paper_no} as a draft — open it, read it in full, then publish.${j.unverified_markers?.length ? ` ⚠ ${j.unverified_markers.length} citation(s) could not be verified; they are struck through in the draft.` : ""}`);
    setTitle(""); setAuthors(""); setPickedSeries([]); load();
  }

  async function setStatus(p: Paper, status: "published" | "draft") {
    setBusy(true); setMsg("");
    const r = await authed(`/api/papers/${slugOf(p.paper_no)}`, { method: "PATCH", body: JSON.stringify({ status }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Update failed."); return; }
    setMsg(status === "published" ? `${p.paper_no} published.` : `${p.paper_no} withdrawn to draft.`);
    load();
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin · Research</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Working Papers</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem", maxWidth: 640 }}>
              A paper is generated, never written: the analysis engine turns a published assessment&apos;s aggregates into
              findings, against a named vintage. Publish only after reading the draft in full.
            </p>
          </div>
          <Link href="/admin" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Admin</Link>
        </div>

        {msg && <div style={{ fontSize: "0.8rem", color: "var(--ink-2)", background: "var(--surface-white)", border: "1px solid var(--border)", padding: "0.6rem 1rem", marginBottom: "1rem" }}>{msg}</div>}

        {/* Generate */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.75rem" }}>Generate a paper</div>
          <div style={{ display: "flex", gap: "0.9rem", marginBottom: "0.75rem" }}>
            {(["assessment", "series"] as const).map((k) => (
              <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 600, color: kind === k ? "var(--ink)" : "var(--ink-4)", cursor: "pointer" }}>
                <input type="radio" name="paper-kind" checked={kind === k} onChange={() => setKind(k)} />
                {k === "assessment" ? "From an assessment (deterministic)" : "From data series (AI-written, record-cited)"}
              </label>
            ))}
          </div>
          {kind === "series" && (
            <div style={{ marginBottom: "0.75rem" }}>
              <span className="form-label">Series (up to 8) — the model narrates only what these records show</span>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: 4 }}>
                {seriesList.map((sr) => {
                  const on = pickedSeries.includes(sr.id);
                  return (
                    <button key={sr.id} type="button"
                      onClick={() => setPickedSeries(on ? pickedSeries.filter((x) => x !== sr.id) : pickedSeries.length < 8 ? [...pickedSeries, sr.id] : pickedSeries)}
                      style={{ padding: "4px 10px", fontSize: "0.72rem", fontWeight: 600, borderRadius: 4, cursor: "pointer", border: `1px solid ${on ? "var(--green)" : "var(--border)"}`, background: on ? "var(--green-tint)" : "var(--surface-white)", color: on ? "var(--green)" : "var(--ink-3)" }}>
                      {sr.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            {kind === "assessment" && <label style={{ flex: "2 1 240px" }}>
              <span className="form-label">Assessment (published open data only)</span>
              <select className="form-input" value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">Choose…</option>
                {forms.map((f) => <option key={f.id} value={f.id}>{f.title} ({f.response_count} verified)</option>)}
              </select>
            </label>}
            <label style={{ flex: "1 1 200px" }}>
              <span className="form-label">Against vintage (optional)</span>
              <select className="form-input" value={vintageId} onChange={(e) => setVintageId(e.target.value)}>
                <option value="">Live aggregates</option>
                {vintages.map((v) => <option key={v.id} value={v.id}>{v.label} — {v.title}</option>)}
              </select>
            </label>
            <button className="btn btn-primary btn-sm" disabled={busy || (kind === "assessment" ? !formId : pickedSeries.length === 0)} onClick={generate}>{busy ? "Generating…" : "Generate draft"}</button>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label style={{ flex: "2 1 260px" }}>
              <span className="form-label">Title (optional — defaults to the assessment&apos;s)</span>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label style={{ flex: "1 1 220px" }}>
              <span className="form-label">Authors (optional)</span>
              <input className="form-input" value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Nigeria Energy Data Bank" />
            </label>
          </div>
        </div>

        {/* Papers */}
        {loading ? <div style={{ textAlign: "center", padding: "2rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div> : (
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Paper</th><th style={{ padding: "8px 12px" }}>Title</th>
                <th style={{ padding: "8px 12px" }}>Vintage</th><th style={{ padding: "8px 12px" }}>State</th><th style={{ padding: "8px 12px" }} />
              </tr></thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.paper_no} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--green)", whiteSpace: "nowrap" }}>{p.paper_no}</td>
                    <td style={{ padding: "8px 12px" }}>{p.title}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)" }}>{p.vintage?.label ?? "live"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: p.status === "published" ? "var(--green-tint)" : "var(--surface)", color: p.status === "published" ? "var(--green)" : "var(--ink-4)", border: "1px solid var(--border)" }}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <Link href={`/papers/${slugOf(p.paper_no)}`} style={{ fontSize: "0.72rem", color: "var(--ink-3)", marginRight: 12 }}>Read</Link>
                      <button className="btn btn-secondary btn-sm" disabled={busy}
                        onClick={() => setStatus(p, p.status === "published" ? "draft" : "published")}>
                        {p.status === "published" ? "Withdraw" : "Publish"}
                      </button>
                    </td>
                  </tr>
                ))}
                {papers.length === 0 && <tr><td colSpan={5} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-5)" }}>No papers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

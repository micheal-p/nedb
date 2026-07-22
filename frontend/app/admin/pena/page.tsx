"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getRole } from "@/lib/auth";
import { penaSlugify } from "@/lib/pena";

type PenaForm = {
  id: number; slug: string; share_token: string; title: string; description: string | null;
  status: "draft" | "open" | "closed"; is_public_stats: boolean; created_by: string;
  created_at: string; question_count: number; response_count: number;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft:  { bg: "var(--surface)",    fg: "var(--ink-4)",     label: "DRAFT" },
  open:   { bg: "var(--green-tint)", fg: "var(--green)",     label: "OPEN" },
  closed: { bg: "var(--red-tint)",   fg: "var(--red)",       label: "CLOSED" },
};

function NewAssessmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (form: PenaForm) => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [pubStats, setPubStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/pena/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), slug: slug.trim(), description: desc, is_public_stats: pubStats }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Failed to create assessment");
        return;
      }
      onCreated(j);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)" }}>PENA</div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>New Energy Assessment</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: "1.2rem" }}>×</button>
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Assessment Title *</label>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setSlug(penaSlugify(e.target.value)); }} placeholder="e.g. Lagos Off-Grid Communities Assessment 2026" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.85rem", fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Public Slug (open-data identifier) *</label>
            <input value={slug} onChange={(e) => setSlug(penaSlugify(e.target.value))} placeholder="lagos_offgrid_2026" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Who is being assessed, and where?" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", resize: "vertical", fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Open Data</label>
            <select value={pubStats ? "yes" : "no"} onChange={(e) => setPubStats(e.target.value === "yes")} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem" }}>
              <option value="yes">Publish anonymised aggregates to the public data bank</option>
              <option value="no">Keep all statistics internal</option>
            </select>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", background: "var(--surface)", padding: "0.75rem 1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", lineHeight: 1.5 }}>
            The form starts with the standard PENA question set — name, email (one response each), phone, state, LGA, address/landmark, income, light hours, energy expense, energy source, household size. You can edit questions before opening it. Personal details never appear in public data — only k-anonymised aggregates.
          </div>

          {error && <div style={{ fontSize: "0.78rem", color: "var(--red)", background: "#FEE2E2", padding: "0.5rem 0.75rem", borderRadius: 4 }}>{error}</div>}

          <button onClick={save} disabled={saving} style={{ padding: "0.65rem 1.5rem", background: saving ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", alignSelf: "flex-end" }}>
            {saving ? "Creating…" : "Create Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PenaAdminPage() {
  const router = useRouter();
  const [forms, setForms] = useState<PenaForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/pena/forms", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setForms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/pena"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  function copyLink(f: PenaForm, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Title + link so a paste reads as an invitation, not a bare URL
    const text = `${f.title} — Nigeria Energy Data Bank assessment\n${window.location.origin}/f/${f.share_token}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(f.id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  // Native share sheet (WhatsApp, SMS, mail…) where available; copy elsewhere
  function shareLink(f: PenaForm, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/f/${f.share_token}`;
    if (navigator.share) {
      navigator.share({ title: f.title, text: `${f.title} — Nigeria Energy Data Bank assessment`, url }).catch(() => {});
    } else {
      copyLink(f, e);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin · PENA</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Profiling &amp; Energy Needs Assessments</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>Create an assessment, share the link, and analyse responses on the Data Point side. One response per email address.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/admin" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Admin</Link>
            <Link href="/admin/pena/benchmarks" style={{ padding: "0.6rem 1.1rem", background: "#fff", border: "1px solid var(--green-line)", color: "var(--green)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
              NBS Benchmarks
            </Link>
            <button onClick={() => setShowNew(true)} style={{ padding: "0.6rem 1.25rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              + New Assessment
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.375rem" }}>No assessments yet</div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginBottom: "1.5rem" }}>Create your first energy assessment — a shareable form that geocodes respondents, classifies them into economic tiers, and feeds the open data bank.</div>
            <button onClick={() => setShowNew(true)} style={{ padding: "0.65rem 1.5rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              Create First Assessment
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {forms.map((f) => {
              const st = STATUS_STYLE[f.status];
              return (
                <Link key={f.id} href={`/admin/pena/${f.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "border-color 0.15s", flexWrap: "wrap" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.2rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>{f.title}</span>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, background: st.bg, color: st.fg, border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 3 }}>{st.label}</span>
                        {!f.is_public_stats && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-4)", padding: "1px 6px", borderRadius: 3 }}>INTERNAL</span>}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{f.slug}</div>
                      {f.description && <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "1.25rem", flexShrink: 0, alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{f.question_count}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase" }}>Questions</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{f.response_count.toLocaleString()}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase" }}>Responses</div>
                      </div>
                      <button onClick={(e) => copyLink(f, e)} style={{ padding: "6px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-tint)", color: "var(--green)", cursor: "pointer" }}>
                        {copied === f.id ? "Copied ✓" : "Copy Link"}
                      </button>
                      <button onClick={(e) => shareLink(f, e)} style={{ padding: "6px 12px", fontSize: "0.72rem", fontWeight: 700, border: "none", borderRadius: 4, background: "var(--green)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>
                        Share
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {showNew && <NewAssessmentModal onClose={() => setShowNew(false)} onCreated={(f) => router.push(`/admin/pena/${f.id}`)} />}
      </div>
    </div>
  );
}

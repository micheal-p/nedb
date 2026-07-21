"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getRole } from "@/lib/auth";
import { QTYPES, ANALYTICS_KEYS, penaSlugify, DEFAULT_TIER_CONFIG, TIERS, type TierConfig } from "@/lib/pena";

type Question = {
  label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; is_pii: boolean; analytics_key: string | null;
  config: { options?: string[]; min?: number; max?: number } | null;
};

type FormDetail = {
  id: number; slug: string; share_token: string; title: string; description: string | null;
  consent_text: string; status: "draft" | "open" | "closed"; is_public_stats: boolean;
  require_verification: boolean;
  tier_config: TierConfig | null;
  questions: Question[]; response_count: number;
};

const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem", boxSizing: "border-box", fontFamily: "var(--font-sans)" };
const labelStyle: React.CSSProperties = { fontSize: "0.65rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 2 };

export default function PenaBuilderPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [consent, setConsent] = useState("");
  const [tiers, setTiers] = useState<TierConfig>(DEFAULT_TIER_CONFIG);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/pena/forms/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((f: FormDetail | null) => {
        if (!f) { setError("Assessment not found"); return; }
        setForm(f);
        setQuestions(f.questions);
        setConsent(f.consent_text);
        setTiers({ ...DEFAULT_TIER_CONFIG, ...(f.tier_config ?? {}) });
      })
      .catch(() => setError("Failed to load"));
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace(`/data-point/login?redirect=/admin/pena/${id}`); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load, id]);

  async function patch(body: Record<string, unknown>, note: string) {
    setSaving(true); setError(""); setMsg("");
    try {
      const res = await fetch(`/api/pena/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Save failed"); return; }
      setMsg(note);
      setTimeout(() => setMsg(""), 2500);
      load();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function updateQ(i: number, field: keyof Question, val: unknown) {
    setQuestions((qs) => qs.map((q, j) => {
      if (j !== i) return q;
      const u = { ...q, [field]: val };
      if (field === "label" && typeof val === "string") u.slug = penaSlugify(val);
      return u;
    }));
  }

  function move(i: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function deleteForm() {
    if (!confirm(`Delete "${form?.title}" and all ${form?.response_count ?? 0} responses? This cannot be undone.`)) return;
    const res = await fetch(`/api/pena/forms/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) router.replace("/admin/pena");
    else setError("Delete failed");
  }

  if (error && !form) return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: "0.85rem" }}>{error}</div>;
  if (!form) return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading…</div>;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/f/${form.share_token}` : `/f/${form.share_token}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>PENA · {form.slug}</div>
            <h1 style={{ fontSize: "1.4rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>{form.title}</h1>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>{form.response_count.toLocaleString()} responses</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/admin/pena" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Assessments</Link>
            <a href={`/f/${form.share_token}?preview=1`} target="_blank" rel="noopener noreferrer"
              style={{ padding: "0.5rem 1rem", background: "#fff", border: "1px solid var(--border)", color: "var(--ink-3)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
              Preview Form
            </a>
            <Link href={`/data-point/pena/${form.id}`} style={{ padding: "0.5rem 1rem", background: "#fff", border: "1px solid var(--green-line)", color: "var(--green)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
              View Insights →
            </Link>
          </div>
        </div>

        {/* Status + share */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
            {(["draft", "open", "closed"] as const).map((s) => (
              <button key={s} onClick={() => patch({ status: s }, `Status set to ${s}`)} disabled={saving || form.status === s}
                style={{ padding: "5px 14px", fontSize: "0.75rem", fontWeight: 700, borderRadius: 4, cursor: form.status === s ? "default" : "pointer", border: `1px solid ${form.status === s ? "var(--green)" : "var(--border)"}`, background: form.status === s ? "var(--green)" : "#fff", color: form.status === s ? "#fff" : "var(--ink-4)", textTransform: "capitalize" }}>
                {s}
              </button>
            ))}
            <span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>
              {form.status === "draft" ? "Not yet accepting responses." : form.status === "open" ? "Accepting responses at the link below." : "Link is closed to new responses."}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Share Link</span>
            <code style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 4, color: "var(--ink-2)", wordBreak: "break-all" }}>{shareUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              style={{ padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-tint)", color: "var(--green)", cursor: "pointer" }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Open Data</span>
            <button onClick={() => patch({ is_public_stats: !form.is_public_stats }, form.is_public_stats ? "Public stats disabled" : "Public stats enabled")}
              style={{ padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--border)", borderRadius: 4, background: form.is_public_stats ? "var(--green-tint)" : "#fff", color: form.is_public_stats ? "var(--green)" : "var(--ink-4)", cursor: "pointer" }}>
              {form.is_public_stats ? "Publishing anonymised aggregates" : "Internal only"}
            </button>
            {form.is_public_stats && form.status !== "draft" && (
              <Link href={`/assessments/${form.slug}`} style={{ fontSize: "0.72rem", color: "var(--green)", textDecoration: "none", fontWeight: 600 }}>View public page →</Link>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email Verify</span>
            <button onClick={() => patch({ require_verification: !form.require_verification }, form.require_verification ? "Magic-link verification off" : "Magic-link verification on")}
              style={{ padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--border)", borderRadius: 4, background: form.require_verification ? "var(--green-tint)" : "#fff", color: form.require_verification ? "var(--green)" : "var(--ink-4)", cursor: "pointer" }}>
              {form.require_verification ? "Magic link required" : "Off — responses count immediately"}
            </button>
            <span style={{ fontSize: "0.68rem", color: "var(--ink-5)", maxWidth: 420, lineHeight: 1.4 }}>
              When on, respondents confirm by tapping a link emailed to them; only confirmed responses count.
              Needs the Resend domain verified to deliver to the public. Google-signed responses skip the link.
            </span>
          </div>
        </div>

        {/* Questions */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Questions</h2>
            <span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>Respondents answer in this order</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {questions.map((q, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "0.875rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Q{i + 1}</span>
                    {q.is_pii && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--red-tint)", color: "var(--red)", padding: "1px 6px", borderRadius: 3 }}>PII — never public</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: i === 0 ? "default" : "pointer", color: "var(--ink-4)", fontSize: "0.7rem", padding: "2px 8px", opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === questions.length - 1} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: i === questions.length - 1 ? "default" : "pointer", color: "var(--ink-4)", fontSize: "0.7rem", padding: "2px 8px", opacity: i === questions.length - 1 ? 0.4 : 1 }}>↓</button>
                    <button onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "0.72rem" }}>Remove</button>
                  </div>
                </div>
                <div className="penagrid" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1.4fr 80px 70px", gap: "0.5rem", alignItems: "end" }}>
                  <div>
                    <label style={labelStyle}>Label</label>
                    <input value={q.label} onChange={(e) => updateQ(i, "label", e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={q.qtype} onChange={(e) => updateQ(i, "qtype", e.target.value)} style={inputStyle}>
                      {QTYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Unit</label>
                    <input value={q.unit ?? ""} onChange={(e) => updateQ(i, "unit", e.target.value || null)} placeholder="₦/month" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Analytics Key</label>
                    <select value={q.analytics_key ?? ""} onChange={(e) => updateQ(i, "analytics_key", e.target.value || null)} style={inputStyle}>
                      {ANALYTICS_KEYS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Required</label>
                    <select value={q.is_required ? "yes" : "no"} onChange={(e) => updateQ(i, "is_required", e.target.value === "yes")} style={inputStyle}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>PII</label>
                    <select value={q.is_pii ? "yes" : "no"} onChange={(e) => updateQ(i, "is_pii", e.target.value === "yes")} style={inputStyle}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
                {q.qtype === "select" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <label style={labelStyle}>Options (comma-separated)</label>
                    <input
                      value={(q.config?.options ?? []).join(", ")}
                      onChange={(e) => updateQ(i, "config", { ...(q.config ?? {}), options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Option A, Option B, Option C"
                      style={inputStyle}
                    />
                  </div>
                )}
                {q.qtype === "address" && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "var(--green)", background: "var(--green-tint)", padding: "4px 8px", borderRadius: 4 }}>
                    Respondents get live place suggestions as they type; the picked place pins their response on the assessment map.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <button onClick={() => setQuestions((qs) => [...qs, { label: "", slug: "", qtype: "text", unit: null, is_required: true, is_pii: false, analytics_key: null, config: null }])}
              style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)", cursor: "pointer" }}>
              + Add Question
            </button>
            <button onClick={() => patch({ questions }, "Questions saved")} disabled={saving}
              style={{ padding: "0.6rem 1.5rem", background: saving ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Questions"}
            </button>
          </div>
        </div>

        {/* Tier thresholds */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 0.375rem" }}>Tier Thresholds</h2>
          <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", margin: "0 0 1rem", lineHeight: 1.5 }}>
            A response earns a tier when it has at least the light hours AND at most the energy burden
            (energy spend ÷ income). Tier D needs either; anything below is Tier E. Saving recomputes every
            existing response with the new thresholds.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {(["A", "B", "C", "D"] as const).map((k) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "170px 1fr 1fr", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: TIERS[k].color, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-2)" }}><strong>{k}</strong> · {TIERS[k].label}</span>
                </div>
                <div>
                  <label style={labelStyle}>Min light hours/day</label>
                  <input type="number" min={0} max={24} step={0.5} value={tiers[k].light}
                    onChange={(e) => setTiers((tc) => ({ ...tc, [k]: { ...tc[k], light: Number(e.target.value) } }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Max energy burden (% of income)</label>
                  <input type="number" min={0} max={100} step={1} value={Math.round(tiers[k].burden * 100)}
                    onChange={(e) => setTiers((tc) => ({ ...tc, [k]: { ...tc[k], burden: Number(e.target.value) / 100 } }))}
                    style={inputStyle} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.875rem" }}>
            <button onClick={() => patch({ tier_config: tiers }, "Thresholds saved — tiers recomputed")} disabled={saving}
              style={{ padding: "0.5rem 1.25rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
              Save &amp; Recompute Tiers
            </button>
            <button onClick={() => { setTiers(DEFAULT_TIER_CONFIG); patch({ tier_config: null }, "Reset to default thresholds"); }} disabled={saving}
              style={{ padding: "0.5rem 1rem", background: "none", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.78rem", color: "var(--ink-4)", cursor: "pointer" }}>
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* Consent */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 0.5rem" }}>Consent Statement</h2>
          <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", margin: "0 0 0.75rem" }}>Respondents must tick this before submitting (NDPA 2023 lawful basis: consent).</p>
          <textarea value={consent} onChange={(e) => setConsent(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", fontSize: "0.8rem", lineHeight: 1.5 }} />
          <button onClick={() => patch({ consent_text: consent }, "Consent text saved")} disabled={saving}
            style={{ marginTop: "0.625rem", padding: "0.5rem 1.25rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
            Save Consent Text
          </button>
        </div>

        {(msg || error) && (
          <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", padding: "0.75rem 1.25rem", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, background: error ? "#FEE2E2" : "var(--green)", color: error ? "var(--red)" : "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 50 }}>
            {error || msg}
          </div>
        )}

        {/* Danger zone */}
        <div style={{ border: "1px solid rgba(192,57,43,0.3)", borderRadius: "var(--r-md)", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--red)" }}>Delete this assessment</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>Removes the form, its questions and all responses permanently.</div>
          </div>
          <button onClick={deleteForm} style={{ padding: "0.5rem 1.25rem", background: "#fff", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
      <style>{`
        @media (max-width: 760px) {
          .penagrid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

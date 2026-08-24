"use client";

// ── /portal — Request dashboard access ──────────────────────────────────────
// This page used to present itself as an "Intelligence Portal", a product you
// could visit, when all it does is take an access request. Worse, each profile
// card advertised data the platform does not hold (DisCo ATC&C tables,
// refinery throughput, flare volumes), so the first thing a new user did after
// being granted access was discover the promise was empty.
//
// It is now a government service page: what the service is, who may apply,
// what happens next, and — driven by the real mandate model — exactly which
// sectors and indicators each dashboard actually carries.

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Breadcrumbs, ErrorSummary } from "@/components/ui/gov";
import { PROFILE_MAP, mandateLabel } from "@/lib/dashboard-profiles";

const GROUPS: { id: string; label: string; blurb: string; keys: string[] }[] = [
  {
    id: "agencies",
    label: "Government agencies and parastatals",
    blurb: "For named officials at a federal energy agency, regulator or operator. Each dashboard is scoped to that body's statutory remit.",
    keys: ["presidency", "ecn", "nerc", "nuprc", "nmdpra", "nnpcl", "nemic", "nrs", "rea", "tcn", "firs", "nbs"],
  },
  {
    id: "analysts",
    label: "Analyst views",
    blurb: "Cross-sector views for research institutions, policy analysts and ECN staff working across more than one carrier.",
    keys: ["executive", "petroleum", "electricity", "renewables", "fiscal"],
  },
  {
    id: "investors",
    label: "Investor views",
    blurb: "For institutional investors, developers and financiers appraising Nigerian energy assets.",
    keys: ["investor_fdi", "investor_capital", "investor_infra", "investor_renewable"],
  },
];

const EMPTY = { full_name: "", email: "", organisation: "", position: "", profile_key: "", justification: "" };

export default function RequestAccessPage() {
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ anchor?: string; message: string }[]>([]);

  function choose(key: string) {
    setForm((f) => ({ ...f, profile_key: key }));
    document.getElementById("apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: { anchor?: string; message: string }[] = [];
    if (!form.full_name.trim())    found.push({ anchor: "full_name", message: "Enter your full name" });
    if (!form.email.trim())        found.push({ anchor: "email", message: "Enter your official email address" });
    if (!form.organisation.trim()) found.push({ anchor: "organisation", message: "Enter your organisation" });
    if (!form.profile_key)         found.push({ anchor: "profile_key", message: "Choose the dashboard you need" });
    if (!form.justification.trim())found.push({ anchor: "justification", message: "Describe what you will use the dashboard for" });
    if (found.length) {
      setErrors(found);
      document.getElementById("error-summary-anchor")?.scrollIntoView({ block: "center" });
      return;
    }

    setSubmitting(true); setErrors([]);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErrors([{ message: data.error ?? "Submission failed. Please try again." }]); return; }
      setReference(data.reference ?? "submitted");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors([{ message: "Network error. Please try again." }]);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation ─────────────────────────────────────────────────────────
  if (reference) {
    return (
      <>
        <Navbar />
        <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem", minHeight: "60vh" }}>
          <div className="page-wrap" style={{ maxWidth: 680 }}>
            <div style={{ background: "var(--green)", color: "#fff", padding: "1.75rem 2rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85, marginBottom: "0.4rem" }}>Request received</div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Your reference is</h1>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, marginTop: "0.5rem", letterSpacing: "0.02em" }}>{reference}</div>
            </div>
            <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "none", padding: "1.75rem 2rem", fontSize: "0.86rem", color: "var(--ink-3)", lineHeight: 1.75 }}>
              <p style={{ margin: "0 0 1rem" }}>
                Write this reference down. The NEDB administrator will review your request and contact you at{" "}
                <strong style={{ color: "var(--ink)" }}>{form.email}</strong>.
              </p>
              <p style={{ margin: "0 0 1.25rem" }}>
                <strong style={{ color: "var(--ink)" }}>Service standard:</strong> requests are reviewed within 5 working days.
                Credentials are sent by email once approved; they are never issued over the phone.
              </p>
              <Link href="/portal/status" className="btn btn-secondary">Check the status of this request</Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const chosen = form.profile_key ? PROFILE_MAP[form.profile_key] : null;

  return (
    <>
      <Navbar />

      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="page-wrap">
          <Breadcrumbs items={[{ label: "Data Bank", href: "/" }, { label: "Request dashboard access" }]} />
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
            Request dashboard access
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-3)", maxWidth: 640, lineHeight: 1.7 }}>
            NEDB dashboards give named officials a live view of the energy statistics that fall within their
            organisation&apos;s remit. Published statistics are free to browse without an account — you only need
            access for a role-scoped dashboard.
          </p>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "1.25rem", fontSize: "0.8rem" }}>
            <a href="#apply" className="btn btn-primary">Apply now</a>
            <Link href="/portal/status" className="btn btn-secondary">Check an existing request</Link>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap">

          {/* How it works */}
          <div className="sec-hd"><h2>How it works</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", marginBottom: "2.5rem" }}>
            {[
              { n: "1", t: "Apply", d: "Tell us who you are, which organisation you represent, and which dashboard you need." },
              { n: "2", t: "Review", d: "The NEDB administrator checks eligibility against your organisation's remit. Reviewed within 5 working days." },
              { n: "3", t: "Access", d: "If approved, credentials are emailed to the address you applied with, scoped to the dashboard you were granted." },
            ].map((s) => (
              <div key={s.n} style={{ background: "var(--surface-white)", padding: "1.25rem 1.35rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--green)", letterSpacing: "0.08em", marginBottom: 6 }}>STEP {s.n}</div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{s.t}</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>

          {/* Eligibility */}
          <div className="sec-hd"><h2>Who can apply</h2></div>
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.5rem 1.75rem", marginBottom: "2.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", fontSize: "0.84rem", color: "var(--ink-3)", lineHeight: 1.7 }}>
              <div>
                <strong style={{ color: "var(--ink)", display: "block", marginBottom: 4 }}>Government bodies</strong>
                Officials at federal energy agencies, regulators, operators and statistical bodies. Apply from your
                official address — a <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>.gov.ng</code> address is fast-tracked.
              </div>
              <div>
                <strong style={{ color: "var(--ink)", display: "block", marginBottom: 4 }}>Research institutions</strong>
                Universities, policy institutes and research programmes working on Nigerian energy.
              </div>
              <div>
                <strong style={{ color: "var(--ink)", display: "block", marginBottom: 4 }}>Investors and developers</strong>
                Institutional investors, project developers and financiers appraising Nigerian energy assets.
              </div>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "1.25rem", marginBottom: 0, lineHeight: 1.7, borderTop: "1px solid var(--border-soft)", paddingTop: "0.9rem" }}>
              Accounts are issued to a named individual and must not be shared. Access can be withdrawn at any time.
              Your use of the data is subject to the <Link href="/terms-of-data-use" style={{ color: "var(--green)", fontWeight: 600 }}>Terms of Data Use</Link>.
            </p>
          </div>

          {/* Choose a dashboard — driven by the real mandate model */}
          <div className="sec-hd">
            <h2>Choose the dashboard you need</h2>
            <span className="sec-hd-meta">Each dashboard shows only the sectors listed</span>
          </div>
          {GROUPS.map((g) => (
            <div key={g.id} style={{ marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.2rem" }}>{g.label}</div>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginBottom: "0.9rem", maxWidth: 640, lineHeight: 1.6 }}>{g.blurb}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "0.75rem" }}>
                {g.keys.map((k) => {
                  const p = PROFILE_MAP[k];
                  if (!p) return null;
                  const selected = form.profile_key === k;
                  return (
                    <button key={k} type="button" onClick={() => choose(k)}
                      style={{
                        textAlign: "left", background: "var(--surface-white)", cursor: "pointer",
                        border: `1px solid ${selected ? "var(--green)" : "var(--border)"}`,
                        borderLeft: `3px solid ${selected ? "var(--green)" : p.color}`,
                        padding: "1rem 1.15rem", display: "flex", flexDirection: "column", gap: "0.4rem",
                        outline: selected ? "2px solid var(--green-line)" : "none",
                      }}>
                      <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--ink)" }}>{p.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.55 }}>{p.persona}</div>
                      <div style={{ marginTop: "auto", paddingTop: "0.45rem", borderTop: "1px solid var(--border-soft)" }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)" }}>Data scope</div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--green-deep)" }}>{mandateLabel(p)}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 3 }}>
                          Headline indicators: {p.kpis.map((x) => x.label).join(", ")}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: selected ? "var(--green)" : "var(--ink-4)" }}>
                        {selected ? "✓ Selected" : "Select this dashboard"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Application form */}
          <div id="apply" style={{ scrollMarginTop: "1.5rem" }}>
            <div className="sec-hd"><h2>Apply</h2></div>
            <div id="error-summary-anchor"><ErrorSummary errors={errors} /></div>
            <form onSubmit={submit} noValidate style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.75rem", maxWidth: 720 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                <label>
                  <span className="form-label">Full name *</span>
                  <input id="full_name" className="form-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Amina Bello" />
                </label>
                <label>
                  <span className="form-label">Official email *</span>
                  <input id="email" className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="a.bello@ecn.gov.ng" />
                </label>
                <label>
                  <span className="form-label">Organisation *</span>
                  <input id="organisation" className="form-input" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} placeholder="Energy Commission of Nigeria" />
                </label>
                <label>
                  <span className="form-label">Position or title</span>
                  <input className="form-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Director, Policy Research" />
                </label>
              </div>

              <label style={{ display: "block", marginTop: "1rem" }}>
                <span className="form-label">Dashboard requested *</span>
                <select id="profile_key" className="form-input form-select" value={form.profile_key} onChange={(e) => setForm({ ...form, profile_key: e.target.value })}>
                  <option value="">Select a dashboard…</option>
                  {GROUPS.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {g.keys.filter((k) => PROFILE_MAP[k]).map((k) => (
                        <option key={k} value={k}>{PROFILE_MAP[k].label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {chosen && (
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-4)", marginTop: 5 }}>
                    Scope: <strong style={{ color: "var(--green-deep)" }}>{mandateLabel(chosen)}</strong>. You will not see sectors outside this scope.
                  </span>
                )}
              </label>

              <label style={{ display: "block", marginTop: "1rem" }}>
                <span className="form-label">What will you use it for? *</span>
                <textarea id="justification" className="form-input" rows={3} value={form.justification}
                  onChange={(e) => setForm({ ...form, justification: e.target.value })}
                  placeholder="Briefly describe the work this dashboard supports in your official capacity."
                  style={{ resize: "vertical" }} />
              </label>

              <p style={{ fontSize: "0.75rem", color: "var(--ink-4)", lineHeight: 1.65, margin: "1rem 0" }}>
                The details you submit are used to process this request and are handled under the{" "}
                <Link href="/privacy" style={{ color: "var(--green)", fontWeight: 600 }}>Privacy Notice</Link> (NDPA 2023).
              </p>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 200, justifyContent: "center" }}>
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </form>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}

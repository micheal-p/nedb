"use client";

import { useState } from "react";
import Link from "next/link";
import CoatOfArms from "@/components/layout/CoatOfArms";

// ── Profile catalogue ──────────────────────────────────────────
const GROUPS = [
  {
    id: "agencies",
    label: "Federal Agencies & Parastatals",
    description: "Dedicated intelligence dashboards for Nigerian energy regulators, operators and statistics agencies.",
    color: "#1B2A4A",
    profiles: [
      { key: "presidency",  name: "Presidency / State House",           icon: "🏛️", tagline: "National energy security brief", access: ["Cross-sector national intelligence", "All 12 series + fiscal panels", "Energy Brief PDF reports", "Priority anomaly feed"] },
      { key: "ecn",         name: "Energy Commission of Nigeria",        icon: "⚡", tagline: "Policy & all-sector intelligence", access: ["Full sector coverage", "Clean energy transition metrics", "Policy monitoring dashboard", "Energy mix analytics"] },
      { key: "nerc",        name: "NERC",                               icon: "🔌", tagline: "Electricity market regulation", access: ["DisCo ATC&C & collection data", "Market shortfall tracking", "Tariff performance", "ATC&C state heatmap"] },
      { key: "nuprc",       name: "NUPRC",                              icon: "🛢️", tagline: "Upstream petroleum regulation", access: ["OML block performance", "Royalty compliance tracking", "Gas flaring data", "Production heatmap by state"] },
      { key: "nmdpra",      name: "NMDPRA",                             icon: "⛽", tagline: "Midstream & downstream regulation", access: ["PMS / AGO / LPG volumes", "Refinery throughput", "Depot compliance", "Price differential alerts"] },
      { key: "nnpcl",       name: "NNPC Limited",                       icon: "🏭", tagline: "Operational & commercial intelligence", access: ["Equity crude lifted", "Gas monetisation", "Downstream revenue", "Refinery capacity data"] },
      { key: "nemic",       name: "NEMIC",                              icon: "🏗️", tagline: "Energy management & infrastructure", access: ["Grid capacity monitoring", "Critical infrastructure flags", "Transmission utilisation", "Investment tracking"] },
      { key: "nrs",         name: "NRS",                                icon: "📊", tagline: "Natural resources statistics", access: ["Data completeness dashboard", "Agency submission tracking", "Cross-series reconciliation", "All 12 energy series"] },
      { key: "rea",         name: "REA",                                icon: "☀️", tagline: "Rural electrification & off-grid", access: ["Off-grid connection data", "Mini-grid deployment tracking", "State off-grid heatmap", "LPG penetration metrics"] },
      { key: "tcn",         name: "TCN",                                icon: "🔋", tagline: "Grid transmission intelligence", access: ["Generation vs. sent-out", "Wheeling capacity data", "Frequency excursion tracking", "State ATC&C heatmap"] },
      { key: "firs",        name: "FIRS",                               icon: "💰", tagline: "Energy tax & revenue", access: ["PPT collections", "Upstream royalties", "CITA from energy companies", "FAAC oil contribution"] },
      { key: "nbs",         name: "NBS",                                icon: "📈", tagline: "National energy statistics", access: ["GDP energy weight", "Energy sector CPI", "Cross-sector validation", "National accounts reconciliation"] },
    ],
  },
  {
    id: "investors",
    label: "Investment Intelligence",
    description: "Premium intelligence dashboards for investors, funds and financial institutions evaluating Nigerian energy assets.",
    color: "#0C4A6E",
    profiles: [
      { key: "investor_fdi",       name: "Foreign Direct Investment",     icon: "🌍", tagline: "IOCs & sovereign wealth funds", access: ["Production & reserves data", "Regulatory risk index", "OML licensing pipeline", "5-year CAGR trends"] },
      { key: "investor_capital",   name: "Capital Markets",               icon: "📉", tagline: "Equity & fixed income analysts", access: ["FAAC oil revenue flows", "Energy GDP contribution", "Revenue bond intelligence", "Producer financial proxies"] },
      { key: "investor_infra",     name: "Infrastructure / Power",        icon: "⚡", tagline: "IPPs, GenCo & DisCo investors", access: ["DisCo ATC&C trajectory", "Tariff progression data", "Market shortfall trend", "Capacity & wheeling data"] },
      { key: "investor_renewable", name: "Renewable Energy",              icon: "🌿", tagline: "Solar, wind & mini-grid developers", access: ["Off-grid market gap (65M people)", "FiT tariff & obligation data", "REA pipeline intelligence", "Solar IRR benchmarks"] },
    ],
  },
  {
    id: "analysts",
    label: "Analytics & Research",
    description: "Specialist dashboards for policy analysts, sector researchers and cross-sector intelligence officers.",
    color: "#0E7A3C",
    profiles: [
      { key: "executive",   name: "Executive Overview",      icon: "🔭", tagline: "Cross-sector national intelligence", access: ["All 12 data series", "National energy mix", "Multi-sector anomaly feed", "Period comparison (2020–2024)"] },
      { key: "petroleum",   name: "Petroleum & Gas Analyst", icon: "🛢️", tagline: "Crude, PMS/AGO/LPG analytics", access: ["Upstream production trends", "Product distribution volumes", "Multi-series comparison charts", "OML performance table"] },
      { key: "electricity", name: "Power & Grid Analyst",    icon: "⚡", tagline: "Generation & DisCo performance", access: ["Generation vs. sent-out", "DisCo comparison table", "ATC&C state heatmap", "Market shortfall trends"] },
      { key: "renewables",  name: "Clean Energy Analyst",    icon: "☀️", tagline: "Renewables, gas & biomass", access: ["Renewable capacity growth", "Fuelwood displacement data", "Off-grid penetration map", "Gas production trends"] },
      { key: "fiscal",      name: "Fiscal & Revenue Analyst",icon: "💹", tagline: "FAAC, royalties & upstream revenue", access: ["FAAC oil contribution", "Royalty collection trends", "PPT analytics", "Producing company registry"] },
    ],
  },
];

// ── What you get section ───────────────────────────────────────
const FEATURES = [
  { icon: "📊", title: "9 Chart Types", desc: "Line, Area, Bar, Column, Pie, Donut, Radar, Scatter and Histogram on every panel — switch instantly." },
  { icon: "🗺️", title: "Nigeria State Map", desc: "Choropleth heatmap of all 36 states + FCT. Metric changes based on your dashboard profile." },
  { icon: "⬇️", title: "CSV Download", desc: "Every chart and table exports directly to CSV for offline analysis and reporting." },
  { icon: "📄", title: "PDF Energy Brief", desc: "Presidency and reporting profiles generate formal print-ready government briefs." },
  { icon: "🤖", title: "Apex AI (Coming Soon)", desc: "AI intelligence assistant trained on NEDB data to explain trends and answer energy sector questions." },
  { icon: "⏱️", title: "Period Navigation", desc: "Navigate 2020–2024 data series with year selectors; real data populates as uploads are committed." },
];

// ── How it works ───────────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Request Access", desc: "Select your organisation type below and submit your access request with your work email and justification." },
  { n: "02", title: "Verification", desc: "The NEDB Administrator at ECN reviews your request and verifies your organisational affiliation." },
  { n: "03", title: "Dashboard Access", desc: "Receive your login credentials and access your profile-specific intelligence dashboard immediately." },
];

const PROFILE_LABELS: Record<string, string> = {};
GROUPS.forEach((g) => g.profiles.forEach((p) => { PROFILE_LABELS[p.key] = p.name; }));

interface RequestForm {
  full_name: string; email: string; organisation: string;
  position: string; profile_key: string; justification: string;
}
const EMPTY_FORM: RequestForm = { full_name: "", email: "", organisation: "", position: "", profile_key: "", justification: "" };

export default function PortalPage() {
  const [form, setForm]           = useState<RequestForm>(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState("");

  function openRequest(profileKey: string) {
    setForm({ ...EMPTY_FORM, profile_key: profileKey });
    setSubmitted(false); setError("");
    setModalOpen(true);
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const res  = await fetch("/api/access-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Submission failed"); setSubmitting(false); return; }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: "var(--surface)", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(160deg, #0A1628 0%, #0F2A18 60%, #0A3D22 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
        {/* Subtle grid overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

        {/* Nav */}
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CoatOfArms size={28} />
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>NEDB</div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>ENERGY COMMISSION OF NIGERIA</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/" style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Public Data Bank</Link>
            <Link href="/data-point/login" style={{ padding: "6px 16px", background: "#0E7A3C", color: "#fff", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>Sign In</Link>
          </div>
        </div>

        {/* Hero content */}
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "5rem 2rem 6rem", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 2rem", opacity: 0.9 }}>
            <CoatOfArms size={72} />
          </div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "1rem" }}>
            Federal Republic of Nigeria &nbsp;·&nbsp; Energy Commission of Nigeria
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400, lineHeight: 1.1, color: "#fff", marginBottom: "1.25rem" }}>
            National Energy<br />Data Bank
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.55)", maxWidth: 560, margin: "0 auto 2.5rem", lineHeight: 1.7 }}>
            The authoritative intelligence platform for Nigeria&apos;s energy sector. Profile-specific dashboards for government agencies, regulators, investors and researchers.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#access" style={{ padding: "12px 28px", background: "#0E7A3C", color: "#fff", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
              Request Dashboard Access
            </a>
            <Link href="/data-point/login" style={{ padding: "12px 28px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 8, fontSize: "0.9rem", fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
              Sign In
            </Link>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", marginTop: "4rem", flexWrap: "wrap" }}>
            {[["12", "Energy Series"], ["21", "Dashboard Profiles"], ["36 + FCT", "States Mapped"], ["5", "Years of Data"]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#fff", lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "4rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.5rem" }}>Access Management</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--ink)" }}>How Account Access Works</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2rem" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ textAlign: "center", position: "relative" }}>
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute", top: 20, left: "60%", right: "-40%", height: 1, background: "var(--border)", zIndex: 0 }} />
                )}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--green)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", position: "relative", zIndex: 1 }}>{s.n}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>{s.title}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHAT YOU GET ── */}
      <div style={{ background: "var(--surface)", padding: "4rem 2rem" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.5rem" }}>Platform Features</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--ink)" }}>Every dashboard includes</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.25rem" }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>{f.icon}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>{f.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROFILE GROUPS ── */}
      <div id="access" style={{ padding: "5rem 2rem" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.5rem" }}>21 Dashboard Profiles</div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "2.2rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.75rem" }}>Select your profile to request access</h2>
            <p style={{ fontSize: "0.9rem", color: "var(--ink-4)", maxWidth: 540, margin: "0 auto" }}>Each profile is a curated intelligence dashboard — the data, charts and views you see are tailored to your role. You only access what you need.</p>
          </div>

          {GROUPS.map((group) => (
            <div key={group.id} style={{ marginTop: "4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1.5rem", paddingBottom: "0.75rem", borderBottom: `2px solid ${group.color}` }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: group.color }}>{group.label}</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>{group.description}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {group.profiles.map((p) => (
                  <div key={p.key} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem", borderTop: `3px solid ${group.color}`, transition: "box-shadow 0.15s", cursor: "default" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <div style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>{p.icon}</div>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{p.name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: 2 }}>{p.tagline}</div>
                      </div>
                    </div>
                    <ul style={{ margin: 0, padding: "0 0 0 1rem", listStyle: "none" }}>
                      {p.access.map((a) => (
                        <li key={a} style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: 4, display: "flex", gap: 6, alignItems: "baseline" }}>
                          <span style={{ color: group.color, fontWeight: 700, flexShrink: 0 }}>✓</span>{a}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => openRequest(p.key)} style={{ marginTop: "auto", padding: "8px 0", background: group.color, color: "#fff", border: "none", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                      Request Access →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ background: "#0A1628", color: "rgba(255,255,255,0.4)", padding: "2.5rem", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: "1rem" }}>
          <CoatOfArms size={24} />
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff" }}>NEDB &nbsp;·&nbsp; Energy Commission of Nigeria</span>
        </div>
        <p style={{ fontSize: "0.72rem", lineHeight: 1.6, maxWidth: 480, margin: "0 auto 1rem" }}>
          The National Energy Data Bank is an official initiative of the Energy Commission of Nigeria. All data is sourced from verified government agencies and published under the NEDB data governance framework.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", fontSize: "0.72rem" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Public Data Bank</Link>
          <Link href="/data-point/login" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Staff Login</Link>
        </div>
      </div>

      {/* ── REQUEST MODAL ── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,22,40,0.75)", backdropFilter: "blur(4px)" }} onClick={() => !submitting && setModalOpen(false)} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            {/* Modal header */}
            <div style={{ background: "linear-gradient(135deg, #0A1628, #0F2A18)", padding: "1.5rem", borderRadius: "16px 16px 0 0" }}>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.4rem" }}>NEDB — Access Request</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                {PROFILE_LABELS[form.profile_key] ?? "Dashboard Access"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Complete this form to request access to your profile-specific intelligence dashboard.</div>
            </div>

            {submitted ? (
              <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green-strong)", border: "2px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>Request Submitted</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-4)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                  Your access request has been received. The NEDB Administrator will review your request and contact you at <strong>{form.email}</strong> with your login credentials.
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--ink-5)", marginBottom: "2rem" }}>Typical review time: 1–2 business days.</p>
                <button onClick={() => setModalOpen(false)} style={{ padding: "10px 24px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Close</button>
              </div>
            ) : (
              <form onSubmit={submitRequest} style={{ padding: "1.5rem 2rem 2rem" }}>
                {error && (
                  <div style={{ marginBottom: "1rem", padding: "10px 14px", background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: 6, fontSize: "0.8rem", color: "var(--red)" }}>{error}</div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <Field label="Full Name *" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} placeholder="Dr. Amina Bello" required />
                  <Field label="Work Email *" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="a.bello@ecn.gov.ng" required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <Field label="Organisation *" value={form.organisation} onChange={(v) => setForm((f) => ({ ...f, organisation: v }))} placeholder="Energy Commission of Nigeria" required />
                  <Field label="Position / Title" value={form.position} onChange={(v) => setForm((f) => ({ ...f, position: v }))} placeholder="Director, Policy Research" />
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 4 }}>Dashboard Profile *</label>
                  <select
                    value={form.profile_key}
                    onChange={(e) => setForm((f) => ({ ...f, profile_key: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
                    <option value="">Select your profile…</option>
                    {GROUPS.map((g) => (
                      <optgroup key={g.id} label={g.label}>
                        {g.profiles.map((p) => (
                          <option key={p.key} value={p.key}>{p.name} — {p.tagline}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 4 }}>Justification / Purpose *</label>
                  <textarea
                    value={form.justification}
                    onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                    required
                    rows={3}
                    placeholder="Briefly describe how you will use the NEDB dashboard in your official capacity…"
                    style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} style={{ padding: "9px 18px", background: "transparent", color: "var(--ink-4)", border: "1px solid var(--border)", borderRadius: 7, fontSize: "0.82rem", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ padding: "9px 22px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 7, fontSize: "0.82rem", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                    {submitting ? "Submitting…" : "Submit Access Request"}
                    {!submitting && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

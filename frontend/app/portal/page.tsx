"use client";

import { useState } from "react";
import Link from "next/link";
import CoatOfArms from "@/components/layout/CoatOfArms";

// ── Inline SVG icon map ────────────────────────────────────────
function Ico({ n, color = "currentColor", size = 18 }: { n: string; color?: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: 1.75,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (n) {
    case "landmark":    return <svg {...p}><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polyline points="2 11 12 2 22 11"/></svg>;
    case "zap":         return <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "activity":    return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case "droplet":     return <svg {...p}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>;
    case "layers":      return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case "factory":     return <svg {...p}><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="7" y1="22" x2="7" y2="13"/><line x1="11" y1="22" x2="11" y2="13"/></svg>;
    case "cpu":         return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>;
    case "database":    return <svg {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
    case "sun":         return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
    case "radio-tower": return <svg {...p}><line x1="12" y1="22" x2="12" y2="11"/><path d="M5 19a7 7 0 0 1 0-14"/><path d="M19 19a7 7 0 0 0 0-14"/><path d="M8 15a4 4 0 0 1 0-6"/><path d="M16 15a4 4 0 0 0 0-6"/><circle cx="12" cy="9" r="1" fill={color}/></svg>;
    case "file-text":   return <svg {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
    case "bar-chart":   return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
    case "globe":       return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    case "trending-up": return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case "building":    return <svg {...p}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>;
    case "leaf":        return <svg {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>;
    case "grid":        return <svg {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case "flame":       return <svg {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
    case "wind":        return <svg {...p}><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>;
    case "dollar-sign": return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>;
    case "map":         return <svg {...p}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
    case "download":    return <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
    case "calendar":    return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    default:            return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
}

// ── Data ───────────────────────────────────────────────────────
const GROUPS = [
  {
    id: "agencies",
    label: "Federal Agencies & Parastatals",
    description: "Dedicated intelligence dashboards for Nigerian energy regulators, operators and statistics agencies.",
    color: "#1B2A4A",
    profiles: [
      { key: "presidency",  icon: "landmark",    name: "Presidency / State House",           tagline: "National energy security brief",          access: ["Cross-sector national intelligence", "All 13 series + fiscal panels", "Energy Brief PDF reports", "Priority anomaly feed"] },
      { key: "ecn",         icon: "zap",         name: "Energy Commission of Nigeria",        tagline: "Policy & all-sector intelligence",         access: ["Full sector coverage", "Clean energy transition metrics", "Policy monitoring dashboard", "Energy mix analytics"] },
      { key: "nerc",        icon: "activity",    name: "NERC",                               tagline: "Electricity market regulation",            access: ["DisCo ATC&C & collection data", "Market shortfall tracking", "Tariff performance", "ATC&C state heatmap"] },
      { key: "nuprc",       icon: "droplet",     name: "NUPRC",                              tagline: "Upstream petroleum regulation",            access: ["OML block performance", "Royalty compliance tracking", "Gas flaring data", "Production heatmap by state"] },
      { key: "nmdpra",      icon: "layers",      name: "NMDPRA",                             tagline: "Midstream & downstream regulation",        access: ["PMS / AGO / LPG volumes", "Refinery throughput", "Depot compliance", "Price differential alerts"] },
      { key: "nnpcl",       icon: "factory",     name: "NNPC Limited",                       tagline: "Operational & commercial intelligence",    access: ["Equity crude lifted", "Gas monetisation", "Downstream revenue", "Refinery capacity data"] },
      { key: "nemic",       icon: "cpu",         name: "NEMIC",                              tagline: "Energy management & infrastructure",       access: ["Grid capacity monitoring", "Critical infrastructure flags", "Transmission utilisation", "Investment tracking"] },
      { key: "nrs",         icon: "database",    name: "NRS",                                tagline: "Natural resources statistics",             access: ["Data completeness dashboard", "Agency submission tracking", "Cross-series reconciliation", "All 13 energy series"] },
      { key: "rea",         icon: "sun",         name: "REA",                                tagline: "Rural electrification & off-grid",         access: ["Off-grid connection data", "Mini-grid deployment tracking", "State off-grid heatmap", "LPG penetration metrics"] },
      { key: "tcn",         icon: "radio-tower", name: "TCN",                                tagline: "Grid transmission intelligence",           access: ["Generation vs. sent-out", "Wheeling capacity data", "Frequency excursion tracking", "State ATC&C heatmap"] },
      { key: "firs",        icon: "file-text",   name: "FIRS",                               tagline: "Energy tax & revenue",                    access: ["PPT collections", "Upstream royalties", "CITA from energy companies", "FAAC oil contribution"] },
      { key: "nbs",         icon: "bar-chart",   name: "NBS",                                tagline: "National energy statistics",               access: ["GDP energy weight", "Energy sector CPI", "Cross-sector validation", "National accounts reconciliation"] },
    ],
  },
  {
    id: "investors",
    label: "Investment Intelligence",
    description: "Premium intelligence dashboards for investors, funds and financial institutions evaluating Nigerian energy assets.",
    color: "#0C4A6E",
    profiles: [
      { key: "investor_fdi",       icon: "globe",        name: "Foreign Direct Investment",     tagline: "IOCs & sovereign wealth funds",          access: ["Production & reserves data", "Regulatory risk index", "OML licensing pipeline", "5-year CAGR trends"] },
      { key: "investor_capital",   icon: "trending-up",  name: "Capital Markets",               tagline: "Equity & fixed income analysts",         access: ["FAAC oil revenue flows", "Energy GDP contribution", "Revenue bond intelligence", "Producer financial proxies"] },
      { key: "investor_infra",     icon: "building",     name: "Infrastructure / Power",        tagline: "IPPs, GenCo & DisCo investors",          access: ["DisCo ATC&C trajectory", "Tariff progression data", "Market shortfall trend", "Capacity & wheeling data"] },
      { key: "investor_renewable", icon: "leaf",         name: "Renewable Energy",              tagline: "Solar, wind & mini-grid developers",     access: ["Off-grid market gap (65M people)", "FiT tariff & obligation data", "REA pipeline intelligence", "Solar IRR benchmarks"] },
    ],
  },
  {
    id: "analysts",
    label: "Analytics & Research",
    description: "Specialist dashboards for policy analysts, sector researchers and cross-sector intelligence officers.",
    color: "#0E7A3C",
    profiles: [
      { key: "executive",   icon: "grid",         name: "Executive Overview",       tagline: "Cross-sector national intelligence",    access: ["All 13 data series", "National energy mix", "Multi-sector anomaly feed", "Period comparison (2020–2024)"] },
      { key: "petroleum",   icon: "flame",        name: "Petroleum & Gas Analyst",  tagline: "Crude, PMS/AGO/LPG analytics",          access: ["Upstream production trends", "Product distribution volumes", "Multi-series comparison charts", "OML performance table"] },
      { key: "electricity", icon: "zap",          name: "Power & Grid Analyst",     tagline: "Generation & DisCo performance",        access: ["Generation vs. sent-out", "DisCo comparison table", "ATC&C state heatmap", "Market shortfall trends"] },
      { key: "renewables",  icon: "wind",         name: "Clean Energy Analyst",     tagline: "Renewables, gas & biomass",             access: ["Renewable capacity growth", "Fuelwood displacement data", "Off-grid penetration map", "Gas production trends"] },
      { key: "fiscal",      icon: "dollar-sign",  name: "Fiscal & Revenue Analyst", tagline: "FAAC, royalties & upstream revenue",   access: ["FAAC oil contribution", "Royalty collection trends", "PPT analytics", "Producing company registry"] },
    ],
  },
];

const FEATURES = [
  { icon: "grid",      title: "9 Chart Types",        desc: "Line, Area, Bar, Column, Pie, Donut, Radar, Scatter and Histogram on every panel — switch instantly." },
  { icon: "map",       title: "Nigeria State Map",     desc: "Choropleth heatmap of all 36 states + FCT. Metric changes based on your dashboard profile." },
  { icon: "download",  title: "CSV Download",          desc: "Every chart and table exports directly to CSV for offline analysis and reporting." },
  { icon: "file-text", title: "PDF Energy Brief",      desc: "Presidency and reporting profiles generate formal print-ready government briefs." },
  { icon: "cpu",       title: "Apex AI (Coming Soon)", desc: "AI intelligence assistant trained on NEDB data to explain trends and answer energy sector questions." },
  { icon: "calendar",  title: "Period Navigation",     desc: "Navigate 2020–2024 data series with year selectors; real data populates as uploads are committed." },
];

const STEPS = [
  { n: "01", title: "Request Access",   desc: "Select your organisation type below and submit your access request with your work email and justification." },
  { n: "02", title: "Verification",     desc: "The NEDB Administrator at ECN reviews your request and verifies your organisational affiliation." },
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
  const [form, setForm]             = useState<RequestForm>(EMPTY_FORM);
  const [modalOpen, setModalOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState("");

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
          <Link href="/" style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Public Data Bank</Link>
        </div>

        {/* Hero content */}
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "5rem 2rem 6rem", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 2rem", opacity: 0.9 }}><CoatOfArms size={72} /></div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "1rem" }}>
            Federal Republic of Nigeria &nbsp;·&nbsp; Energy Commission of Nigeria
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400, lineHeight: 1.1, color: "#fff", marginBottom: "1.25rem" }}>
            National Energy<br />Data Bank
          </h1>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.55)", maxWidth: 560, margin: "0 auto 2.5rem", lineHeight: 1.7 }}>
            The authoritative intelligence platform for Nigeria&apos;s energy sector. Profile-specific dashboards for government agencies, regulators, investors and researchers.
          </p>
          <a href="#access" style={{ padding: "12px 32px", background: "#0E7A3C", color: "#fff", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
            Request Dashboard Access
          </a>

          {/* Stats strip */}
          <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", marginTop: "4rem", flexWrap: "wrap" }}>
            {[["13", "Energy Series"], ["21", "Dashboard Profiles"], ["36 + FCT", "States Mapped"], ["5", "Years of Data"]].map(([v, l]) => (
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
                <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(14,122,60,0.07)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.875rem" }}>
                  <Ico n={f.icon} color="#0E7A3C" size={18} />
                </div>
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
                  <div key={p.key}
                    style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem", borderTop: `3px solid ${group.color}`, transition: "box-shadow 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: group.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Ico n={p.icon} color="#fff" size={17} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{p.name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: 2 }}>{p.tagline}</div>
                      </div>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {p.access.map((a) => (
                        <li key={a} style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: 4, display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={group.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                          {a}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => openRequest(p.key)} style={{ marginTop: "auto", padding: "8px 0", background: group.color, color: "#fff", border: "none", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                      Request Access
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
        <Link href="/" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: "0.72rem" }}>Public Data Bank</Link>
      </div>

      {/* ── REQUEST MODAL ── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,22,40,0.75)", backdropFilter: "blur(4px)" }} onClick={() => !submitting && setModalOpen(false)} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "linear-gradient(135deg, #0A1628, #0F2A18)", padding: "1.5rem", borderRadius: "16px 16px 0 0" }}>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.4rem" }}>NEDB — Access Request</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{PROFILE_LABELS[form.profile_key] ?? "Dashboard Access"}</div>
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
                  <Field label="Full Name *"     value={form.full_name}    onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}    placeholder="Dr. Amina Bello"               required />
                  <Field label="Work Email *"    type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="a.bello@ecn.gov.ng"             required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <Field label="Organisation *"  value={form.organisation} onChange={(v) => setForm((f) => ({ ...f, organisation: v }))} placeholder="Energy Commission of Nigeria" required />
                  <Field label="Position / Title" value={form.position}   onChange={(v) => setForm((f) => ({ ...f, position: v }))}    placeholder="Director, Policy Research" />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 4 }}>Dashboard Profile *</label>
                  <select value={form.profile_key} onChange={(e) => setForm((f) => ({ ...f, profile_key: e.target.value }))} required
                    style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
                    <option value="">Select your profile…</option>
                    {GROUPS.map((g) => (
                      <optgroup key={g.id} label={g.label}>
                        {g.profiles.map((p) => <option key={p.key} value={p.key}>{p.name} — {p.tagline}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 4 }}>Justification / Purpose *</label>
                  <textarea value={form.justification} onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))} required rows={3}
                    placeholder="Briefly describe how you will use the NEDB dashboard in your official capacity…"
                    style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
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

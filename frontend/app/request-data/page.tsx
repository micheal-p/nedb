"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const SERIES_LIST = [
  { id: "crude_oil_production",    name: "Crude Oil Production" },
  { id: "natural_gas_production",  name: "Natural Gas Production" },
  { id: "pms_sales",               name: "PMS (Petrol) Sales" },
  { id: "ago_sales",               name: "AGO (Diesel) Sales" },
  { id: "kerosine_sales",          name: "Kerosene / DPK Sales" },
  { id: "lpg_sales",               name: "LPG Sales" },
  { id: "electricity_generation",  name: "Electricity Generation" },
  { id: "electricity_sent_out",    name: "Electricity Sent Out" },
  { id: "electricity_consumption", name: "Electricity Consumption" },
  { id: "renewable_energy",        name: "Renewable Energy Capacity" },
  { id: "fuelwood_consumption",    name: "Fuelwood Consumption" },
  { id: "faac_oil_revenue",        name: "FAAC Oil Revenue" },
  { id: "upstream_royalties",      name: "Upstream Royalties Collected" },
];

export default function RequestDataPage() {
  const [form, setForm] = useState({
    full_name: "", organization: "", email: "", purpose: "", date_range: "",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");

  function toggleSeries(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, requested_series: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed.");
      setMsg(data.message);
      setStatus("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Submission failed.");
      setStatus("err");
    }
  }

  return (
    <>
      <Navbar active="databank" />
      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="page-wrap">
          <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem", color: "var(--ink-5)" }}>/</span>
            <span>Request Data</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)" }}>
            Data Request Portal
          </h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.5rem", maxWidth: 540 }}>
            For bulk datasets, custom date ranges, or restricted-access series not available for public download, submit a request below. The NEDB team will respond within 3 business days.
          </p>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap" style={{ maxWidth: 700 }}>
          {status === "done" ? (
            <div style={{ padding: "2.5rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: "var(--green-tint)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width="24" height="24" fill="none" stroke="#0E7A3C" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 400, marginBottom: "0.5rem" }}>Request Submitted</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", maxWidth: 400, margin: "0 auto 1.5rem" }}>{msg}</p>
              <Link href="/" className="btn btn-secondary">Back to Data Bank</Link>
            </div>
          ) : (
            <form onSubmit={submit} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Full Name *</span>
                  <input className="form-input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Amina Okoro" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Organisation</span>
                  <input className="form-input" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="NERC / University of Lagos" />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Email Address *</span>
                <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="amina@nerc.gov.ng" />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Purpose of Request *</span>
                <textarea className="form-input" required rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Research on electricity access trends in rural communities..." style={{ resize: "vertical", fontFamily: "inherit" }} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>Date Range Needed</span>
                <input className="form-input" value={form.date_range} onChange={(e) => setForm({ ...form, date_range: e.target.value })} placeholder="e.g. 2010 – 2024" />
              </label>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.6rem" }}>Data Series Required</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                  {SERIES_LIST.map((s) => (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--ink-3)", cursor: "pointer", padding: "0.35rem 0.5rem", borderRadius: "var(--r-sm)", background: selected.includes(s.id) ? "var(--green-tint)" : "transparent", border: `1px solid ${selected.includes(s.id) ? "var(--green)" : "transparent"}` }}>
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSeries(s.id)} style={{ accentColor: "var(--green)" }} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>

              {status === "err" && (
                <div style={{ padding: "0.75rem 1rem", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "#991B1B", marginBottom: "1rem" }}>{msg}</div>
              )}

              <button type="submit" className="btn btn-primary" disabled={status === "sending"} style={{ width: "100%" }}>
                {status === "sending" ? "Submitting…" : "Submit Data Request"}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

"use client";

// ── /request-data — Data request service ────────────────────────────────────
// Most people who land here do not need to be here: what they want is already
// published and downloadable. So the page leads with that, and the request form
// is for the cases the public catalogue genuinely cannot serve — bulk extracts,
// long custom ranges, sub-national breakdowns, or series still withheld.
//
// The series list is the live published catalogue rather than a hardcoded array
// that drifts the moment a series is published or withdrawn.

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Breadcrumbs, ErrorSummary } from "@/components/ui/gov";
import { SECTOR_LABEL } from "@/lib/bulletin-shared";

type Series = { id: string; name: string; sector: string; unit_default: string; frequency: string; record_count?: number };

const PURPOSES = [
  { id: "research",  label: "Academic research", hint: "A university, institute or thesis project" },
  { id: "policy",    label: "Policy or government work", hint: "Analysis for an MDA or public body" },
  { id: "commercial",label: "Commercial or investment analysis", hint: "Due diligence, market study, feasibility" },
  { id: "media",     label: "Journalism", hint: "Reporting or fact-checking" },
  { id: "other",     label: "Something else", hint: "Tell us in the description" },
];

export default function RequestDataPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    full_name: "", organization: "", email: "", purpose_kind: "", purpose: "", date_range: "", format: "csv",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ anchor?: string; message: string }[]>([]);

  useEffect(() => {
    fetch("/api/series")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setSeries(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  const bySector = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? series.filter((s) => s.name.toLowerCase().includes(needle) || s.id.includes(needle)) : series;
    return filtered.reduce((acc, s) => {
      (acc[s.sector] ??= []).push(s);
      return acc;
    }, {} as Record<string, Series[]>);
  }, [series, query]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: { anchor?: string; message: string }[] = [];
    if (!form.full_name.trim())    found.push({ anchor: "full_name", message: "Enter your full name" });
    if (!form.email.trim())        found.push({ anchor: "email", message: "Enter your email address" });
    if (!form.purpose_kind)        found.push({ anchor: "purpose_kind", message: "Choose what the data is for" });
    if (!form.purpose.trim())      found.push({ anchor: "purpose", message: "Describe what you need and why" });
    if (selected.length === 0)     found.push({ anchor: "series-picker", message: "Select at least one data series" });
    if (found.length) {
      setErrors(found);
      document.getElementById("error-summary-anchor")?.scrollIntoView({ block: "center" });
      return;
    }

    setStatus("sending"); setErrors([]);
    try {
      const chosen = PURPOSES.find((p) => p.id === form.purpose_kind)?.label ?? form.purpose_kind;
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          organization: form.organization,
          email: form.email,
          date_range: form.date_range,
          purpose: `[${chosen}] [Preferred format: ${form.format.toUpperCase()}] ${form.purpose}`,
          requested_series: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors([{ message: data.error ?? "Submission failed. Please try again." }]); setStatus("idle"); return; }
      setReference(data.reference ?? null);
      setStatus("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors([{ message: "Network error. Please try again." }]);
      setStatus("idle");
    }
  }

  // ── Confirmation ─────────────────────────────────────────────────────────
  if (status === "done") {
    return (
      <>
        <Navbar active="databank" />
        <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem", minHeight: "55vh" }}>
          <div className="page-wrap" style={{ maxWidth: 680 }}>
            <div style={{ background: "var(--green)", color: "#fff", padding: "1.6rem 1.85rem" }}>
              <div className="eyebrow" style={{ color: "rgba(255,255,255,0.85)" }}>Request received</div>
              <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, margin: 0 }}>We have your data request</h1>
              {reference && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.35rem", fontWeight: 700, marginTop: "0.6rem" }}>{reference}</div>
              )}
            </div>
            <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "none", padding: "1.6rem 1.85rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.75 }}>
              <p style={{ margin: "0 0 1rem" }}>
                The NEDB data management unit will respond to <strong style={{ color: "var(--ink)" }}>{form.email}</strong> within{" "}
                <strong style={{ color: "var(--ink)" }}>3 working days</strong>. Larger extracts may take longer to prepare, and you will be told if so.
              </p>
              <p style={{ margin: "0 0 1.25rem" }}>
                You asked for {selected.length} series{form.date_range ? `, covering ${form.date_range}` : ""}, preferred as {form.format.toUpperCase()}.
              </p>
              <Link href="/" className="btn btn-secondary">Back to the Data Bank</Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const totalPublished = series.length;

  return (
    <>
      <Navbar active="databank" />

      <div className="page-head">
        <div className="page-wrap">
          <Breadcrumbs items={[{ label: "Data Bank", href: "/" }, { label: "Request data" }]} />
          <h1>Request data</h1>
          <p className="lede">
            For bulk extracts, long custom ranges, sub-national breakdowns, or series not yet published.
            Most published statistics can be downloaded immediately without asking anyone.
          </p>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">

          {/* Try this first — most requests are unnecessary */}
          <div style={{ background: "var(--blue-tint)", border: "1px solid var(--blue)", borderLeft: "3px solid var(--blue)", padding: "1.1rem 1.35rem", marginBottom: "2rem" }}>
            <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>
              You may not need to make a request
            </div>
            <div style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7 }}>
              All {totalPublished > 0 ? totalPublished : ""} published series are free to browse and download as CSV or Excel, with no
              account and no waiting. Try the{" "}
              <Link href="/" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>series catalogue</Link>,{" "}
              the <Link href="/compare" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>compare tool</Link>, or the{" "}
              <Link href="/api-docs" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>public API</Link> for
              programmatic access.
            </div>
          </div>

          <div id="error-summary-anchor"><ErrorSummary errors={errors} /></div>

          <form onSubmit={submit} noValidate className="split-rail" style={{ gap: "2rem", alignItems: "start" }}>

            {/* Main column */}
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* 1. What data */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">1. Which data do you need?</span>
                  <span style={{ fontSize: "var(--t-xs)", color: selected.length ? "var(--green-deep)" : "var(--ink-5)", fontWeight: 600 }}>
                    {selected.length} selected
                  </span>
                </div>
                <div style={{ padding: "1rem 1.15rem" }} id="series-picker">
                  <input className="form-input" value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search series by name…" style={{ marginBottom: "0.9rem" }} />

                  {series.length === 0 ? (
                    <div style={{ fontSize: "var(--t-base)", color: "var(--ink-4)" }}>Loading the published catalogue…</div>
                  ) : Object.keys(bySector).length === 0 ? (
                    <div style={{ fontSize: "var(--t-base)", color: "var(--ink-4)" }}>No series match “{query}”.</div>
                  ) : (
                    Object.entries(bySector).map(([sector, list]) => (
                      <div key={sector} style={{ marginBottom: "1rem" }}>
                        <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>{SECTOR_LABEL[sector] ?? sector}</div>
                        <div className="grid-2" style={{ gap: "0.35rem" }}>
                          {list.map((s) => {
                            const on = selected.includes(s.id);
                            return (
                              <label key={s.id} style={{
                                display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
                                padding: "0.5rem 0.6rem", border: `1px solid ${on ? "var(--green)" : "var(--border)"}`,
                                background: on ? "var(--green-tint)" : "var(--surface-white)",
                              }}>
                                <input type="checkbox" checked={on} onChange={() => toggle(s.id)}
                                  style={{ accentColor: "var(--green)", marginTop: 2 }} />
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: "block", fontSize: "var(--t-base)", color: "var(--ink)", fontWeight: on ? 600 : 400 }}>{s.name}</span>
                                  <span style={{ display: "block", fontSize: "var(--t-2xs)", color: "var(--ink-5)" }}>
                                    {s.frequency} · {s.unit_default}{s.record_count != null ? ` · ${s.record_count.toLocaleString()} records` : ""}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. What for */}
              <div className="panel">
                <div className="panel-header"><span className="panel-title">2. What is it for?</span></div>
                <div style={{ padding: "1rem 1.15rem" }}>
                  <div id="purpose_kind" className="grid-auto" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
                    {PURPOSES.map((p) => {
                      const on = form.purpose_kind === p.id;
                      return (
                        <label key={p.id} style={{
                          display: "block", cursor: "pointer", padding: "0.65rem 0.8rem",
                          border: `1px solid ${on ? "var(--green)" : "var(--border)"}`,
                          background: on ? "var(--green-tint)" : "var(--surface-white)",
                        }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="radio" name="purpose_kind" checked={on}
                              onChange={() => setForm({ ...form, purpose_kind: p.id })}
                              style={{ accentColor: "var(--green)" }} />
                            <span style={{ fontSize: "var(--t-base)", fontWeight: 600, color: "var(--ink)" }}>{p.label}</span>
                          </span>
                          <span style={{ display: "block", fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 2, paddingLeft: 24 }}>{p.hint}</span>
                        </label>
                      );
                    })}
                  </div>

                  <label style={{ display: "block" }}>
                    <span className="form-label">Describe what you need *</span>
                    <textarea id="purpose" className="form-input" rows={4} value={form.purpose}
                      onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                      placeholder="For example: monthly PMS and AGO sales by state for 2020 to 2025, to model regional fuel demand for a university study."
                      style={{ resize: "vertical", lineHeight: 1.6 }} />
                    <span style={{ display: "block", fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 4 }}>
                      The more precisely you describe the cut you need, the faster it can be prepared.
                    </span>
                  </label>
                </div>
              </div>

              {/* 3. About you */}
              <div className="panel">
                <div className="panel-header"><span className="panel-title">3. About you</span></div>
                <div style={{ padding: "1rem 1.15rem" }}>
                  <div className="grid-2" style={{ gap: "0.9rem" }}>
                    <label>
                      <span className="form-label">Full name *</span>
                      <input id="full_name" className="form-input" value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Amina Okoro" />
                    </label>
                    <label>
                      <span className="form-label">Email address *</span>
                      <input id="email" className="form-input" type="email" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="a.okoro@unilag.edu.ng" />
                    </label>
                    <label>
                      <span className="form-label">Organisation</span>
                      <input className="form-input" value={form.organization}
                        onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="University of Lagos" />
                    </label>
                    <label>
                      <span className="form-label">Period needed</span>
                      <input className="form-input" value={form.date_range}
                        onChange={(e) => setForm({ ...form, date_range: e.target.value })} placeholder="2015 to 2025" />
                    </label>
                  </div>

                  <div style={{ marginTop: "0.9rem" }}>
                    <span className="form-label">Preferred format</span>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      {[["csv", "CSV"], ["xlsx", "Excel"], ["json", "JSON"]].map(([v, l]) => (
                        <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--t-base)", color: "var(--ink-2)", cursor: "pointer" }}>
                          <input type="radio" name="format" checked={form.format === v}
                            onChange={() => setForm({ ...form, format: v })} style={{ accentColor: "var(--green)" }} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>

                  <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.7, margin: "1rem 0 0" }}>
                    Your details are used to process this request and are handled under the{" "}
                    <Link href="/privacy" style={{ color: "var(--green)", fontWeight: 600 }}>Privacy Notice</Link> (NDPA 2023).
                    Data supplied is subject to the{" "}
                    <Link href="/terms-of-data-use" style={{ color: "var(--green)", fontWeight: 600 }}>Terms of Data Use</Link>.
                  </p>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={status === "sending"} style={{ alignSelf: "flex-start", minWidth: 220 }}>
                {status === "sending" ? "Submitting…" : "Submit data request"}
              </button>
            </div>

            {/* Rail: what happens next, and the running selection */}
            <aside style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "sticky", top: "1rem" }}>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Your selection</span></div>
                <div style={{ padding: "0.9rem 1.1rem" }}>
                  {selected.length === 0 ? (
                    <div style={{ fontSize: "var(--t-base)", color: "var(--ink-4)", lineHeight: 1.6 }}>
                      Nothing selected yet. Choose the series you need from the list.
                    </div>
                  ) : (
                    <>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {selected.map((id) => {
                          const s = series.find((x) => x.id === id);
                          return (
                            <li key={id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", padding: "0.35rem 0", borderBottom: "1px solid var(--border-soft)", fontSize: "var(--t-sm)", color: "var(--ink-2)" }}>
                              <span style={{ minWidth: 0 }}>{s?.name ?? id}</span>
                              <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${s?.name ?? id}`}
                                style={{ background: "none", border: "none", color: "var(--ink-5)", cursor: "pointer", fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>×</button>
                            </li>
                          );
                        })}
                      </ul>
                      <button type="button" onClick={() => setSelected([])}
                        style={{ marginTop: "0.6rem", background: "none", border: "none", padding: 0, color: "var(--green)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                        Clear selection
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><span className="panel-title">What happens next</span></div>
                <div style={{ padding: "0.9rem 1.1rem", fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7 }}>
                  <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
                    <li style={{ marginBottom: "0.5rem" }}>You receive a reference number immediately.</li>
                    <li style={{ marginBottom: "0.5rem" }}>The data management unit reviews the request, normally within <strong style={{ color: "var(--ink)" }}>3 working days</strong>.</li>
                    <li style={{ marginBottom: "0.5rem" }}>Where the request can be met from published data, you are sent the extract or pointed to the download.</li>
                    <li>Where it involves withheld or unpublished data, you are told what can and cannot be released, and why.</li>
                  </ol>
                </div>
              </div>
            </aside>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
}

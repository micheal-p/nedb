"use client";

// Public PENA respondent form — /f/<share_token>
// Google-Forms-style single-column flow: consent gate, typed inputs, state→LGA
// cascading pickers, and live place suggestions on address questions (the
// picked suggestion pins the response on the assessment map).

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

type Question = {
  id: number; label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; analytics_key: string | null;
  config: { options?: string[]; min?: number; max?: number } | null; display_order: number;
};

type FormDef = {
  status: "open" | "closed" | "draft";
  title: string; description?: string | null; consent_text?: string;
  questions?: Question[];
};

type Lga = { id: number; name: string; state_name: string };
type GeoHit = { display_name: string; lat: number; lng: number };

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "11px 12px", border: "1px solid var(--border)", borderRadius: 8,
  fontSize: "1rem", fontFamily: "var(--font-sans)", boxSizing: "border-box", background: "#fff",
  color: "var(--ink)", // 16px minimum — anything smaller makes iOS Safari zoom on focus
};

export default function PenaPublicForm() {
  const { token } = useParams<{ token: string }>();
  const [def, setDef] = useState<FormDef | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [lgas, setLgas] = useState<Lga[]>([]);
  const [lgaId, setLgaId] = useState<number | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [geoOpenFor, setGeoOpenFor] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/pena/r/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDef)
      .catch(() => setLoadFailed(true));
    fetch("/api/lgas").then((r) => (r.ok ? r.json() : [])).then(setLgas).catch(() => {});
  }, [token]);

  const states = useMemo(() => [...new Set(lgas.map((l) => l.state_name))].sort(), [lgas]);
  const stateQ = def?.questions?.find((q) => q.qtype === "state_ref");
  const chosenState = stateQ ? answers[stateQ.slug] : undefined;
  const stateLgas = useMemo(
    () => (chosenState ? lgas.filter((l) => l.state_name === chosenState) : lgas),
    [lgas, chosenState]
  );

  const setAnswer = useCallback((slug: string, v: string) => {
    setAnswers((a) => ({ ...a, [slug]: v }));
  }, []);

  function onAddressInput(q: Question, v: string) {
    setAnswer(q.slug, v);
    setGeo(null); // typed text invalidates a previously picked pin
    if (geoTimer.current) clearTimeout(geoTimer.current);
    if (v.trim().length < 3) { setGeoHits([]); setGeoOpenFor(null); return; }
    geoTimer.current = setTimeout(async () => {
      try {
        const extra = chosenState ? `, ${chosenState}` : "";
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(v + extra)}`);
        const hits: GeoHit[] = res.ok ? await res.json() : [];
        setGeoHits(hits);
        setGeoOpenFor(hits.length ? q.slug : null);
      } catch { /* suggestions are optional */ }
    }, 400);
  }

  async function submit() {
    setError("");
    if (!def?.questions) return;
    for (const q of def.questions) {
      const v = q.qtype === "lga_ref" ? (lgaId != null ? "x" : "") : (answers[q.slug] ?? "");
      if (q.is_required && !String(v).trim()) { setError(`"${q.label}" is required.`); return; }
    }
    if (!consent) { setError("Please accept the consent statement to submit."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/pena/r/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          lga_id: lgaId,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          consent: true,
          website: "", // honeypot — bots fill it, humans never see it
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Submission failed. Please try again."); return; }
      setDone(j.message ?? "Response recorded. Thank you.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--green)" }}>
            Nigeria Energy Data Bank · PENA
          </div>
        </div>
        {children}
        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.68rem", color: "var(--ink-5)", lineHeight: 1.6 }}>
          Collected under the Nigeria Data Protection Act 2023. Personal details are never published —
          only anonymised, aggregated statistics enter the open data bank.
        </div>
      </div>
    </div>
  );

  if (loadFailed) return shell(
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "3rem 2rem", textAlign: "center" }}>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Assessment not found</div>
      <div style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>This link is invalid or has been removed.</div>
    </div>
  );
  if (!def) return shell(
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "3rem 2rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading…</div>
  );
  if (def.status !== "open") return shell(
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "3rem 2rem", textAlign: "center" }}>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{def.title}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>
        {def.status === "closed" ? "This assessment is closed and no longer accepting responses." : "This assessment is not open yet. Please check back later."}
      </div>
    </div>
  );
  if (done) return shell(
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "3rem 2rem", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--green-tint)", border: "2px solid var(--green)", color: "var(--green)", fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>✓</div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Response recorded</div>
      <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6 }}>{done}</div>
    </div>
  );

  return shell(
    <>
      {/* Title card */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderTop: "4px solid var(--green)", borderRadius: "var(--r-lg)", padding: "1.75rem 1.75rem 1.5rem", marginBottom: "0.875rem" }}>
        <h1 style={{ fontSize: "1.45rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>{def.title}</h1>
        {def.description && <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.625rem", lineHeight: 1.6 }}>{def.description}</p>}
        <p style={{ fontSize: "0.72rem", color: "var(--ink-5)", marginTop: "0.75rem", marginBottom: 0 }}>* Required &nbsp;·&nbsp; One response per email address</p>
      </div>

      {/* Questions */}
      {(def.questions ?? []).map((q) => (
        <div key={q.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.25rem 1.75rem", marginBottom: "0.875rem", position: "relative" }}>
          <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, color: "var(--ink)", marginBottom: "0.7rem" }}>
            {q.label} {q.is_required && <span style={{ color: "var(--red)" }}>*</span>}
            {q.unit && <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--ink-5)", marginLeft: 6 }}>({q.unit})</span>}
          </label>

          {q.qtype === "select" ? (
            <select value={answers[q.slug] ?? ""} onChange={(e) => setAnswer(q.slug, e.target.value)} style={fieldStyle}>
              <option value="">Choose…</option>
              {(q.config?.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : q.qtype === "state_ref" ? (
            <select value={answers[q.slug] ?? ""} onChange={(e) => { setAnswer(q.slug, e.target.value); setLgaId(null); }} style={fieldStyle}>
              <option value="">Choose your state…</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : q.qtype === "lga_ref" ? (
            <select
              value={lgaId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setLgaId(id);
                const l = lgas.find((x) => x.id === id);
                setAnswer(q.slug, l?.name ?? "");
              }}
              style={fieldStyle}
              disabled={!!stateQ && !chosenState}
            >
              <option value="">{stateQ && !chosenState ? "Choose your state first…" : "Choose your Local Government Area…"}</option>
              {stateLgas.map((l) => <option key={l.id} value={l.id}>{l.name}{!chosenState ? ` — ${l.state_name}` : ""}</option>)}
            </select>
          ) : q.qtype === "address" ? (
            <div style={{ position: "relative" }}>
              <input
                value={answers[q.slug] ?? ""}
                onChange={(e) => onAddressInput(q, e.target.value)}
                onBlur={() => setTimeout(() => setGeoOpenFor(null), 200)}
                placeholder="Street, area, or a well-known landmark"
                style={fieldStyle}
                autoComplete="off"
              />
              {geo && <div style={{ fontSize: "0.7rem", color: "var(--green)", marginTop: 6, fontWeight: 600 }}>✓ Location pinned on the map</div>}
              {geoOpenFor === q.slug && geoHits.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", zIndex: 20, overflow: "hidden" }}>
                  {geoHits.map((h, i) => (
                    <button
                      key={i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setAnswer(q.slug, h.display_name);
                        setGeo({ lat: h.lat, lng: h.lng });
                        setGeoHits([]);
                        setGeoOpenFor(null);
                      }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", borderBottom: i < geoHits.length - 1 ? "1px solid var(--border)" : "none", fontSize: "0.78rem", color: "var(--ink-2)", cursor: "pointer", lineHeight: 1.4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-tint)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      {h.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <input
              type={q.qtype === "number" ? "number" : q.qtype === "email" ? "email" : q.qtype === "phone" ? "tel" : "text"}
              inputMode={q.qtype === "number" ? "decimal" : q.qtype === "phone" ? "tel" : undefined}
              min={q.config?.min} max={q.config?.max}
              value={answers[q.slug] ?? ""}
              onChange={(e) => setAnswer(q.slug, e.target.value)}
              placeholder={q.qtype === "phone" ? "080X XXX XXXX" : q.qtype === "email" ? "you@example.com" : ""}
              style={fieldStyle}
            />
          )}
        </div>
      ))}

      {/* Consent + submit */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.25rem 1.75rem" }}>
        <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--green)" }} />
          <span style={{ fontSize: "0.76rem", color: "var(--ink-3)", lineHeight: 1.6 }}>{def.consent_text}</span>
        </label>

        {error && <div style={{ fontSize: "0.8rem", color: "var(--red)", background: "var(--red-tint)", padding: "0.625rem 0.875rem", borderRadius: 6, marginTop: "0.875rem" }}>{error}</div>}

        <button onClick={submit} disabled={submitting}
          style={{ marginTop: "1rem", width: "100%", padding: "0.8rem", background: submitting ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
          {submitting ? "Submitting…" : "Submit Response"}
        </button>
      </div>
    </>
  );
}

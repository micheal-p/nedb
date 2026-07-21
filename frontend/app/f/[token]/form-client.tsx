"use client";

// Public PENA respondent form — /f/<share_token>
// Google-Forms-style single-column flow with:
//  • Google Sign-In identity when NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured
//    (verified email, no typing) — falls back to a typed email field
//  • "already filled" lock: device marker + server-side email/IP dedupe
//  • offline queue: a failed-network submit is saved locally and auto-retried
//  • state→LGA cascading pickers, live place suggestions on address questions
//  • chrome strings in English / Pidgin / Hausa / Yorùbá / Igbo
//  • ?preview=1 — staff-only preview of draft forms, submissions disabled

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { PENA_LANGS, PENA_STRINGS, type PenaLang } from "@/lib/pena-i18n";

type Question = {
  id: number; label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; analytics_key: string | null;
  config: { options?: string[]; min?: number; max?: number } | null; display_order: number;
};

type FormDef = {
  status: "open" | "closed" | "draft";
  preview?: boolean;
  title: string; description?: string | null; consent_text?: string;
  questions?: Question[];
  google_client_id?: string | null;
};

type Lga = { id: number; name: string; state_name: string };
type GeoHit = { display_name: string; lat: number; lng: number };
type AnswerVal = string | string[] | number;

type GsiWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
        renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
      };
    };
  };
};

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "11px 12px", border: "1px solid var(--border)", borderRadius: 8,
  fontSize: "1rem", fontFamily: "var(--font-sans)", boxSizing: "border-box", background: "#fff",
  color: "var(--ink)", // 16px minimum — anything smaller makes iOS Safari zoom on focus
};

function decodeJwtEmail(credential: string): string | null {
  try {
    const payload = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const j = JSON.parse(atob(payload));
    return typeof j.email === "string" ? j.email.toLowerCase() : null;
  } catch { return null; }
}

export default function PenaPublicForm() {
  const { token } = useParams<{ token: string }>();
  const [def, setDef] = useState<FormDef | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [lang, setLang] = useState<PenaLang>("en");
  const [answers, setAnswers] = useState<Record<string, AnswerVal>>({});
  const [lgas, setLgas] = useState<Lga[]>([]);
  const [lgaId, setLgaId] = useState<number | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [geoOpenFor, setGeoOpenFor] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gsiRef = useRef<HTMLDivElement>(null);

  const t = PENA_STRINGS[lang];
  const doneKey = `pena_done_${token}`;
  const queueKey = `pena_queue_${token}`;

  // ── Load form definition + reference data ─────────────────────────────────
  useEffect(() => {
    const isPreview = typeof window !== "undefined" && window.location.search.includes("preview=1");
    setPreview(isPreview);
    try {
      if (!isPreview && localStorage.getItem(doneKey)) setAlready(true);
      if (localStorage.getItem(queueKey)) setOfflineQueued(true);
      const savedLang = localStorage.getItem("pena_lang") as PenaLang | null;
      if (savedLang && PENA_STRINGS[savedLang]) setLang(savedLang);
    } catch { /* private mode */ }

    fetch(`/api/pena/r/${token}${isPreview ? "?preview=1" : ""}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDef)
      .catch(() => setLoadFailed(true));
    fetch("/api/lgas").then((r) => (r.ok ? r.json() : [])).then(setLgas).catch(() => {});
  }, [token, doneKey, queueKey]);

  // ── Google Sign-In button ─────────────────────────────────────────────────
  useEffect(() => {
    if (!def?.google_client_id || googleToken || done || already) return;
    const clientId = def.google_client_id;
    function render() {
      const g = (window as GsiWindow).google;
      if (!g || !gsiRef.current) return;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => { setGoogleToken(r.credential); setGoogleEmail(decodeJwtEmail(r.credential)); },
      });
      g.accounts.id.renderButton(gsiRef.current, { theme: "outline", size: "large", width: 280, text: "signin_with" });
    }
    if ((window as GsiWindow).google) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [def, googleToken, done, already]);

  const states = useMemo(() => [...new Set(lgas.map((l) => l.state_name))].sort(), [lgas]);
  const stateQ = def?.questions?.find((q) => q.qtype === "state_ref");
  const chosenState = stateQ ? (answers[stateQ.slug] as string | undefined) : undefined;
  const stateLgas = useMemo(
    () => (chosenState ? lgas.filter((l) => l.state_name === chosenState) : lgas),
    [lgas, chosenState]
  );

  const setAnswer = useCallback((slug: string, v: AnswerVal) => {
    setAnswers((a) => ({ ...a, [slug]: v }));
  }, []);

  function pickLang(l: PenaLang) {
    setLang(l);
    try { localStorage.setItem("pena_lang", l); } catch { /* private mode */ }
  }

  function onAddressInput(q: Question, v: string) {
    setAnswer(q.slug, v);
    setGeo(null); // typed text invalidates a previously picked pin
    if (geoTimer.current) clearTimeout(geoTimer.current);
    if (v.trim().length < 3) { setGeoHits([]); setGeoOpenFor(null); return; }
    geoTimer.current = setTimeout(async () => {
      try {
        // Bias the search with the picked LGA + state — "Aguda" alone matches
        // both Aguda (Surulere) and Aguda (Ifako-Ijaiye); the LGA settles it.
        const lgaQ = def?.questions?.find((x) => x.qtype === "lga_ref");
        const lgaName = lgaQ ? ((answers[lgaQ.slug] as string) ?? "") : "";
        const extra = [lgaName, chosenState].filter(Boolean).map((s) => `, ${s}`).join("");
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(v + extra)}`);
        const hits: GeoHit[] = res.ok ? await res.json() : [];
        setGeoHits(hits);
        setGeoOpenFor(hits.length ? q.slug : null);
      } catch { /* suggestions are optional */ }
    }, 400);
  }

  // ── Submit + offline queue ────────────────────────────────────────────────
  const postPayload = useCallback(async (payload: object): Promise<{ ok: boolean; status: number; body: { error?: string; message?: string } }> => {
    const res = await fetch(`/api/pena/r/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  }, [token]);

  const markDone = useCallback((message: string) => {
    setDone(message);
    setOfflineQueued(false);
    try { localStorage.setItem(doneKey, "1"); localStorage.removeItem(queueKey); } catch { /* private mode */ }
  }, [doneKey, queueKey]);

  const trySyncQueue = useCallback(async () => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(queueKey); } catch { /* private mode */ }
    if (!raw) return;
    try {
      const r = await postPayload(JSON.parse(raw));
      if (r.ok) markDone(r.body.message ?? "Response recorded.");
      else if (r.status === 409) { markDone(""); setAlready(true); }
      else { try { localStorage.removeItem(queueKey); } catch { /* ignore */ } setOfflineQueued(false); setError(r.body.error ?? "Submission failed."); }
    } catch { /* still offline — keep the queue */ }
  }, [queueKey, postPayload, markDone]);

  // A validation error must be seen — scroll it into view when it appears
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  useEffect(() => {
    if (!offlineQueued) return;
    trySyncQueue();
    const onOnline = () => trySyncQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [offlineQueued, trySyncQueue]);

  async function submit() {
    setError("");
    if (preview) return;
    if (!def?.questions) return;
    for (const q of def.questions) {
      if (q.qtype === "email" && googleToken) continue; // auto-filled server-side
      const v = q.qtype === "lga_ref" ? (lgaId != null ? "x" : "") : (answers[q.slug] ?? "");
      const empty = Array.isArray(v) ? v.length === 0 : String(v).trim() === "";
      if (q.is_required && empty) { setError(`"${q.label}" — ${t.requiredNote.replace("* ", "")}`); return; }
    }
    if (!consent) { setError(t.consentRequired); return; }

    const payload = {
      answers,
      lga_id: lgaId,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      consent: true,
      google_token: googleToken,
      website: "", // honeypot — bots fill it, humans never see it
    };

    setSubmitting(true);
    try {
      const r = await postPayload(payload);
      if (r.ok) { markDone(r.body.message ?? t.thanksBody); return; }
      if (r.status === 409) { setAlready(true); try { localStorage.setItem(doneKey, "1"); } catch { /* ignore */ } return; }
      setError(r.body.error ?? "Submission failed. Please try again.");
    } catch {
      // Network unreachable — save on-device and retry automatically later
      try { localStorage.setItem(queueKey, JSON.stringify(payload)); setOfflineQueued(true); }
      catch { setError("Network error — please try again."); }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: "1rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--green)" }}>
            Nigeria Energy Data Bank · PENA
          </div>
          <select value={lang} onChange={(e) => pickLang(e.target.value as PenaLang)} aria-label={t.langLabel}
            style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.72rem", background: "#fff", color: "var(--ink-3)" }}>
            {PENA_LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        {children}
        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.68rem", color: "var(--ink-5)", lineHeight: 1.6 }}>
          Collected under the Nigeria Data Protection Act 2023. Personal details are never published —
          only anonymised, aggregated statistics enter the open data bank.
        </div>
      </div>
    </div>
  );

  const card = (children: React.ReactNode) => (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "3rem 2rem", textAlign: "center" }}>{children}</div>
  );

  if (loadFailed) return shell(card(<>
    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Assessment not found</div>
    <div style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>This link is invalid or has been removed.</div>
  </>));
  if (!def) return shell(card(<span style={{ color: "var(--ink-5)", fontSize: "0.85rem" }}>{t.loading}</span>));
  if (already && !done) return shell(card(<>
    {/* Deliberately NOT a green tick — this screen means the response was
        refused as a duplicate, and must never be mistaken for success */}
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(217,164,4,0.12)", border: "2px solid #B8860B", color: "#B8860B", fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>!</div>
    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{def.title}</div>
    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{t.already}</div>
    <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
      This new response was <strong>not recorded</strong> — this device or internet connection has already
      submitted. If you are on a shared network and haven&apos;t personally filled it, try again on your own
      mobile data.
    </div>
  </>));
  if (def.status !== "open") return shell(card(<>
    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{def.title}</div>
    <div style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>{def.status === "closed" ? t.closed : t.notOpen}</div>
  </>));
  if (offlineQueued && !done) return shell(card(<>
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface)", border: "2px solid var(--ink-4)", color: "var(--ink-3)", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>⏳</div>
    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{t.offlinePending}</div>
    <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6, marginBottom: "1rem" }}>{t.offlineSaved}</div>
    <button onClick={trySyncQueue} style={{ padding: "0.6rem 1.5rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>{t.syncNow}</button>
  </>));
  if (done) return shell(card(<>
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--green-tint)", border: "2px solid var(--green)", color: "var(--green)", fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>✓</div>
    <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{t.thanksTitle}</div>
    <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6 }}>{done || t.thanksBody}</div>
  </>));

  return shell(
    <>
      {preview && (
        <div style={{ background: "#1B2A4A", color: "#fff", borderRadius: "var(--r-md)", padding: "0.625rem 1rem", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.875rem", textAlign: "center" }}>
          {t.previewBanner}
        </div>
      )}

      {/* Title card */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderTop: "4px solid var(--green)", borderRadius: "var(--r-lg)", padding: "1.75rem 1.75rem 1.5rem", marginBottom: "0.875rem" }}>
        <h1 style={{ fontSize: "1.45rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>{def.title}</h1>
        {def.description && <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.625rem", lineHeight: 1.6 }}>{def.description}</p>}
        <p style={{ fontSize: "0.72rem", color: "var(--ink-5)", marginTop: "0.75rem", marginBottom: 0 }}>{t.requiredNote}</p>
      </div>

      {/* Questions */}
      {(def.questions ?? []).map((q) => (
        <div key={q.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.25rem 1.75rem", marginBottom: "0.875rem", position: "relative" }}>
          <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, color: "var(--ink)", marginBottom: "0.7rem" }}>
            {q.label} {q.is_required && <span style={{ color: "var(--red)" }}>*</span>}
            {q.unit && <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--ink-5)", marginLeft: 6 }}>({q.unit})</span>}
          </label>

          {q.qtype === "email" && def.google_client_id ? (
            googleToken ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--green-tint)", border: "1px solid var(--green-line)", borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: "0.85rem", color: "var(--ink-2)" }}>{t.signedInAs} <strong>{googleEmail}</strong></span>
              </div>
            ) : (
              <div>
                <div ref={gsiRef} style={{ minHeight: 44 }} />
                <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", marginTop: 6 }}>{t.signInHint}</div>
              </div>
            )
          ) : q.qtype === "select" ? (
            <select value={(answers[q.slug] as string) ?? ""} onChange={(e) => setAnswer(q.slug, e.target.value)} style={fieldStyle}>
              <option value="">{t.choose}</option>
              {(q.config?.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : q.qtype === "multiselect" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(q.config?.options ?? []).map((o) => {
                const cur = (answers[q.slug] as string[] | undefined) ?? [];
                const on = cur.includes(o);
                return (
                  <label key={o} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.9rem", color: "var(--ink-2)" }}>
                    <input type="checkbox" checked={on}
                      onChange={() => setAnswer(q.slug, on ? cur.filter((x) => x !== o) : [...cur, o])}
                      style={{ width: 17, height: 17, accentColor: "var(--green)" }} />
                    {o}
                  </label>
                );
              })}
            </div>
          ) : q.qtype === "rating" ? (
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = answers[q.slug] === n;
                return (
                  <button key={n} type="button" onClick={() => setAnswer(q.slug, n)}
                    style={{ width: 46, height: 46, borderRadius: 8, border: `1px solid ${on ? "var(--green)" : "var(--border)"}`, background: on ? "var(--green)" : "#fff", color: on ? "#fff" : "var(--ink-3)", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}>
                    {n}
                  </button>
                );
              })}
            </div>
          ) : q.qtype === "longtext" ? (
            <textarea value={(answers[q.slug] as string) ?? ""} onChange={(e) => setAnswer(q.slug, e.target.value)} rows={4}
              style={{ ...fieldStyle, resize: "vertical" }} />
          ) : q.qtype === "date" ? (
            <input type="date" value={(answers[q.slug] as string) ?? ""} onChange={(e) => setAnswer(q.slug, e.target.value)} style={fieldStyle} />
          ) : q.qtype === "state_ref" ? (
            <select value={(answers[q.slug] as string) ?? ""} onChange={(e) => { setAnswer(q.slug, e.target.value); setLgaId(null); }} style={fieldStyle}>
              <option value="">{t.chooseState}</option>
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
              <option value="">{stateQ && !chosenState ? t.chooseStateFirst : t.chooseLga}</option>
              {stateLgas.map((l) => <option key={l.id} value={l.id}>{l.name}{!chosenState ? ` — ${l.state_name}` : ""}</option>)}
            </select>
          ) : q.qtype === "address" ? (
            <div style={{ position: "relative" }}>
              <input
                value={(answers[q.slug] as string) ?? ""}
                onChange={(e) => onAddressInput(q, e.target.value)}
                onBlur={() => setTimeout(() => setGeoOpenFor(null), 200)}
                placeholder={t.addressPlaceholder}
                style={fieldStyle}
                autoComplete="off"
              />
              {geo && <div style={{ fontSize: "0.7rem", color: "var(--green)", marginTop: 6, fontWeight: 600 }}>✓ {t.pinned}</div>}
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
              value={(answers[q.slug] as string) ?? ""}
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

        {error && <div ref={errorRef} style={{ fontSize: "0.8rem", color: "var(--red)", background: "var(--red-tint)", padding: "0.625rem 0.875rem", borderRadius: 6, marginTop: "0.875rem" }}>{error}</div>}

        <button onClick={submit} disabled={submitting || preview}
          style={{ marginTop: "1rem", width: "100%", padding: "0.8rem", background: submitting || preview ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, cursor: submitting || preview ? "not-allowed" : "pointer" }}>
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </>
  );
}

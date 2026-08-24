"use client";

// ── /data-point/pena — Assessment journey board ─────────────────────────────
// A list of forms is not a programme. An energy needs assessment moves through
// a lifecycle — designed, collecting, past the privacy floor, published, closed
// — and at any moment somebody needs to know which stage each assessment has
// reached and what it is waiting on. That is what this board shows.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getRole, isAdminRole } from "@/lib/auth";
import { K_ANON_MIN } from "@/lib/pena";

type PenaForm = {
  id: number; slug: string; title: string; description: string | null;
  status: "draft" | "open" | "closed"; response_count: number;
  question_count?: number; is_public_stats?: boolean; created_at: string;
};

const STAGES = [
  { id: "design",  label: "Designed",            blurb: "Questions set, not yet collecting" },
  { id: "collect", label: "Collecting",          blurb: "Link is live and taking responses" },
  { id: "floor",   label: "Past privacy floor",  blurb: `${K_ANON_MIN}+ verified responses — statistics can publish` },
  { id: "publish", label: "Published",           blurb: "Aggregates are open data" },
  { id: "closed",  label: "Closed",              blurb: "Collection complete" },
];

/** Where this assessment sits, and the single next thing to do about it. */
function journeyOf(f: PenaForm): { index: number; next: string; tone: "green" | "amber" | "ink" } {
  if (f.status === "draft") {
    return {
      index: 0, tone: "amber",
      next: (f.question_count ?? 0) === 0
        ? "Add questions, then open it for responses."
        : "Open it for responses to start collecting.",
    };
  }
  if (f.status === "closed") {
    return {
      index: 4, tone: "ink",
      next: f.is_public_stats
        ? "Collection complete and the results are public."
        : "Collection complete. Publish the aggregates if the findings should be open data.",
    };
  }
  if (f.response_count < K_ANON_MIN) {
    const left = K_ANON_MIN - f.response_count;
    return {
      index: 1, tone: "amber",
      next: `${left} more verified response${left === 1 ? "" : "s"} before any statistic can publish. Share the link, or send enumerators out.`,
    };
  }
  if (!f.is_public_stats) {
    return {
      index: 2, tone: "amber",
      next: "Past the privacy floor. Review the insights, then publish the aggregates as open data.",
    };
  }
  return {
    index: 3, tone: "green",
    next: "Published and still collecting. Use the findings in planning, or close collection once the sample is sufficient.",
  };
}

export default function PenaJourneyPage() {
  const router = useRouter();
  const [forms, setForms] = useState<PenaForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/pena"); return; }
    fetch("/api/pena/forms", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setForms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const admin = isAdminRole(getRole());
  const totalVerified = forms.reduce((a, f) => a + f.response_count, 0);
  const collecting = forms.filter((f) => f.status === "open").length;
  const publishable = forms.filter((f) => f.response_count >= K_ANON_MIN && !f.is_public_stats).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem 1.5rem 4rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Data Point · PENA</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Energy Assessments</h1>
            <p style={{ fontSize: "0.83rem", color: "var(--ink-3)", marginTop: "0.4rem", maxWidth: 660, lineHeight: 1.6 }}>
              Household and business energy needs assessments, from design through collection to open data.
              Each assessment shows the stage it has reached and the next action it is waiting on.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/data-point/dashboard" style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>← Dashboard</Link>
            {admin && <Link href="/admin/pena" className="btn btn-primary btn-sm">Manage assessments</Link>}
          </div>
        </div>

        {/* Programme summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", marginBottom: "1.5rem" }}>
          {[
            { label: "Assessments", value: String(forms.length), tone: "var(--ink)" },
            { label: "Collecting now", value: String(collecting), tone: collecting ? "var(--green)" : "var(--ink-5)" },
            { label: "Verified responses", value: totalVerified.toLocaleString(), tone: "var(--ink)" },
            { label: "Ready to publish", value: String(publishable), tone: publishable ? "var(--amber)" : "var(--ink-5)" },
          ].map((c) => (
            <div key={c.label} style={{ background: "var(--surface-white)", padding: "1rem 1.15rem" }}>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: c.tone, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)", marginTop: 3 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* The journey, stated once */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-4)", marginBottom: "0.7rem" }}>The assessment journey</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: "0.5rem" }} className="pena-stages">
            {STAGES.map((s, i) => (
              <div key={s.id} style={{ borderTop: "3px solid var(--border)", paddingTop: "0.5rem" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-5)" }}>{i + 1}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink)" }}>{s.label}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--ink-4)", lineHeight: 1.5, marginTop: 2 }}>{s.blurb}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3.5rem 2rem", background: "var(--surface-white)", border: "1px solid var(--border)", color: "var(--ink-4)", fontSize: "0.84rem", lineHeight: 1.7 }}>
            No assessments yet.
            {admin ? <> Create the first one from the <Link href="/admin/pena" style={{ color: "var(--green)", fontWeight: 600 }}>admin console</Link>.</> : " An administrator creates assessments."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {forms.map((f) => {
              const j = journeyOf(f);
              const pctToFloor = Math.min(100, (f.response_count / K_ANON_MIN) * 100);
              const toneColor = j.tone === "green" ? "var(--green)" : j.tone === "amber" ? "var(--amber)" : "var(--ink-4)";
              return (
                <div key={f.id} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: `3px solid ${toneColor}`, padding: "1.1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                        <Link href={`/data-point/pena/${f.id}`} style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{f.title}</Link>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 7px", border: `1px solid ${toneColor}`, color: toneColor }}>
                          {STAGES[j.index].label}
                        </span>
                        {f.is_public_stats && <span className="tag tag-green" style={{ fontSize: "0.58rem" }}>OPEN DATA</span>}
                      </div>
                      {f.description && <div style={{ fontSize: "0.76rem", color: "var(--ink-4)", lineHeight: 1.5 }}>{f.description}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{f.response_count.toLocaleString()}</div>
                      <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-5)" }}>Verified</div>
                    </div>
                  </div>

                  {/* Stage rail */}
                  <div style={{ display: "flex", gap: 3, marginBottom: "0.55rem" }}>
                    {STAGES.map((s, i) => (
                      <div key={s.id} title={s.label}
                        style={{ flex: 1, height: 4, background: i <= j.index ? toneColor : "var(--surface-muted)" }} />
                    ))}
                  </div>

                  {/* Privacy floor progress, only while it still matters */}
                  {f.response_count < K_ANON_MIN && f.status !== "draft" && (
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginBottom: "0.5rem" }}>
                      {f.response_count} of {K_ANON_MIN} responses toward the privacy floor
                      <span style={{ display: "inline-block", width: 90, height: 5, background: "var(--surface-muted)", border: "1px solid var(--border-soft)", marginLeft: 8, verticalAlign: "middle" }}>
                        <span style={{ display: "block", width: `${pctToFloor}%`, height: "100%", background: toneColor }} />
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", borderTop: "1px solid var(--border-soft)", paddingTop: "0.55rem" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--ink-2)", lineHeight: 1.55, flex: 1, minWidth: 220 }}>
                      <strong style={{ color: "var(--ink)" }}>Next:</strong> {j.next}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
                      <Link href={`/data-point/pena/${f.id}`} style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--green)", textDecoration: "underline", textUnderlineOffset: 2 }}>Insights</Link>
                      {admin && <Link href={`/admin/pena/${f.id}`} style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--ink-4)", textDecoration: "underline", textUnderlineOffset: 2 }}>Manage</Link>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 760px) {
          .pena-stages { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

"use client";

// A planning-folder file opened through its share link: read-only for anyone
// holding the token, briefing included because it was saved with the file.

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PathwayView from "@/components/necal/PathwayView";
import type { Scenario } from "@/lib/necal-scenario";
import type { PlanBase } from "@/lib/necal";

function SharedBody() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [data, setData] = useState<{ filename: string; scenario: Scenario; base: PlanBase | null; briefing: string | null; owner: string; created_at: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const share = sp.get("share");
    if (!share) { setFailed(true); return; }
    fetch(`/api/necal/files/${id}?share=${encodeURIComponent(share)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [id, sp]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      {failed ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-4)", fontSize: "0.85rem" }}>
          This share link is not valid, or sharing was stopped by the owner.
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading…</div>
      ) : (
        <PathwayView
          name={data.filename}
          scenario={data.scenario}
          base={data.base ?? { generationGwh: 0 }}
          briefing={data.briefing}
          byline={`Shared from ${data.owner}'s planning folder · saved ${new Date(data.created_at).toLocaleString("en-NG")}`}
        />
      )}
    </main>
  );
}

export default function SharedFilePage() {
  return (
    <>
    <Navbar />
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--surface)" }} />}>
      <SharedBody />
    </Suspense>
    <Footer />
    </>
  );
}

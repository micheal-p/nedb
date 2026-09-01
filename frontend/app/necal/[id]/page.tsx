"use client";

// One published pathway, rendered read-only from its frozen anchor.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PathwayView from "@/components/necal/PathwayView";
import type { Scenario } from "@/lib/necal-scenario";
import type { PlanBase } from "@/lib/necal";

export default function PublishedPathwayPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ name: string; scenario: Scenario; base: PlanBase; published_at: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/necal/published/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [id]);

  return (
    <>
    <Navbar active="graph" />
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      {failed ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-4)", fontSize: "0.85rem" }}>Pathway not found.</div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading…</div>
      ) : (
        <PathwayView
          name={data.name}
          scenario={data.scenario}
          base={data.base}
          byline={`Published ${new Date(data.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} · National Energy Calculator`}
        />
      )}
    </div>
    <Footer />
    </>
  );
}

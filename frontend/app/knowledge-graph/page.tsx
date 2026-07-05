"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CoatOfArms from "@/components/layout/CoatOfArms";
import NetworkGraph, { type NetworkGraphHandle } from "@/components/charts/NetworkGraph";
import {
  NODE_STYLE, EDGE_LABEL, traceDownstream, degreeCentrality,
  type GraphData, type GraphNode, type NodeType, type Centrality,
} from "@/lib/graph-model";
import { exportGraphXlsx } from "@/lib/graph-excel";

interface GraphResponse {
  nodes: GraphNode[];
  edges: { source: string; target: string; type: GraphData["edges"][number]["type"]; weight: number }[];
  analytics: { centrality: Centrality[]; singlePointsOfFailure: string[]; nodeCount: number; edgeCount: number };
}

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [analytics, setAnalytics] = useState<GraphResponse["analytics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"explore" | "spof" | "trace">("explore");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printPng, setPrintPng] = useState<string | null>(null);
  const graphRef = useRef<NetworkGraphHandle>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((res: GraphResponse) => {
        setData({ nodes: res.nodes, edges: res.edges });
        setAnalytics(res.analytics);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const nodeByKey = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.key, n])), [data]);

  // Highlight set depends on mode
  const trace = useMemo(() => {
    if (mode !== "trace" || !selected || !data) return null;
    return traceDownstream(data, selected.key);
  }, [mode, selected, data]);

  const highlight = useMemo(() => {
    if (mode === "spof" && analytics) return new Set(analytics.singlePointsOfFailure);
    if (mode === "trace" && trace) return new Set([selected!.key, ...trace.reached]);
    return undefined;
  }, [mode, analytics, trace, selected]);

  function handleNodeClick(node: GraphNode) {
    setSelected(node);
    setMode("trace");
  }
  function reset() { setMode("explore"); setSelected(null); }
  function showSpof() { setMode("spof"); setSelected(null); }

  // Every capture goes through a clean frame: clear any trace dimming, re-fit the
  // view, wait for the canvas to redraw — so exports never inherit a grey, panned,
  // or zoomed-out state (the "washed-out PNG" problem).
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function captureCleanPng(): Promise<string | null> {
    if (mode !== "explore") { setMode("explore"); setSelected(null); await sleep(350); }
    graphRef.current?.fitView();
    await sleep(300);
    return graphRef.current?.capturePng() ?? null;
  }

  async function exportPng() {
    const url = await captureCleanPng();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = "nedb-energy-knowledge-graph.png"; a.click();
  }

  async function exportExcel() {
    if (!data || !analytics) return;
    setExporting(true);
    try {
      await exportGraphXlsx({
        graph: data,
        centrality: degreeCentrality(data), // full ranking, not just the API's top 8
        singlePointsOfFailure: analytics.singlePointsOfFailure,
        graphPng: await captureCleanPng(),
      });
    } finally {
      setExporting(false);
    }
  }

  // Print: browsers won't reliably rasterize a live canvas, so we snapshot it to an
  // <img> that replaces the canvas in print CSS, then open the print dialog.
  async function printBrief() {
    const png = await captureCleanPng();
    setPrintPng(png);
    await sleep(200);
    window.print();
  }

  // trace breakdown by type for the insight panel
  const traceBreakdown = useMemo(() => {
    if (!trace || !data) return null;
    const counts: Partial<Record<NodeType, number>> = {};
    for (const key of trace.reached) {
      const t = nodeByKey.get(key)?.type;
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [trace, data, nodeByKey]);

  return (
    <>
      <div className="no-print"><Navbar active="graph" /></div>

      {/* ── SUB-HEADER ── */}
      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "1.5rem 0" }}>
        <div className="page-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ maxWidth: 620 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
              <span className="tag tag-green">Beta</span>
              <span className="tag tag-muted">Graph Intelligence</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.15 }}>
              National Energy Knowledge Graph
            </h1>
            <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.4rem", lineHeight: 1.6 }}>
              Nigeria&apos;s energy system as a connected network — fuels, power plants, the transmission grid,
              distribution companies, states and the policies that govern them. Built in-house on NEDB&apos;s
              own database. Click any node to trace what it powers downstream.
            </p>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={exportPng} className="btn btn-secondary btn-sm">Export PNG</button>
            <button onClick={exportExcel} disabled={exporting} className="btn btn-secondary btn-sm">
              {exporting ? "Building…" : "Export Excel"}
            </button>
            <button onClick={printBrief} className="btn btn-primary btn-sm">Print Brief</button>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "1.5rem 0 4rem" }}>
        <div className="page-wrap">
          {loading ? (
            <div style={{ padding: "5rem", textAlign: "center", color: "var(--ink-5)" }}>Loading knowledge graph…</div>
          ) : !data ? (
            <div style={{ padding: "5rem", textAlign: "center", color: "var(--ink-5)" }}>Graph unavailable. Run migration 016 to seed the graph.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.25rem", alignItems: "start" }} className="graph-layout">
              {/* ── LEFT: toolbar + canvas ── */}
              <div>
                {/* Toolbar: view controls left, status right */}
                <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={reset} className={`gbtn${mode === "explore" ? " gbtn-active" : ""}`}>Explore</button>
                    <button onClick={showSpof} className={`gbtn${mode === "spof" ? " gbtn-active" : ""}`}>Single Points of Failure</button>
                    {mode === "trace" && selected && (
                      <button onClick={reset} className="gbtn gbtn-clear">✕ Clear trace: {selected.label}</button>
                    )}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>
                    {mode === "spof" ? "Critical nodes highlighted" : mode === "trace" ? "Downstream trace active" : "Drag nodes · scroll to zoom · click to trace"}
                  </div>
                </div>

                <div className="graph-canvas-wrap">
                  <NetworkGraph
                    ref={graphRef}
                    data={data}
                    highlight={highlight}
                    dimUnhighlighted={mode === "trace"}
                    onNodeClick={handleNodeClick}
                    height={560}
                  />
                </div>
                {/* Print-only snapshot — canvases don't rasterize reliably in print */}
                {printPng && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={printPng} alt="Energy Knowledge Graph" className="print-graph-img" style={{ display: "none", width: "100%", border: "1px solid #ddd", borderRadius: 8 }} />
                )}

                {/* Mode explainer under the graph */}
                <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "#fff", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)", fontSize: "0.76rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                  {mode === "explore" && <>Each node is an entity in Nigeria&apos;s energy system; each link is a real relationship (fuel supply, generation, wheeling, distribution, policy). Node size reflects how connected it is.</>}
                  {mode === "spof" && <><strong style={{ color: "var(--ink)" }}>Single points of failure</strong> are nodes whose removal would disconnect part of the network — computed with an articulation-point algorithm. The Transmission Company of Nigeria (TCN) is the clearest example: every generated megawatt must pass through it to reach any DisCo.</>}
                  {mode === "trace" && selected && <>Tracing everything downstream of <strong style={{ color: "var(--ink)" }}>{selected.label}</strong>. Highlighted nodes are directly or indirectly powered by it — this is the kind of &ldquo;ripple&rdquo; query the Neo4j proposal describes, running on our own Postgres.</>}
                </div>
              </div>

              {/* ── RIGHT: insight sidebar ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Legend */}
                <div className="gcard">
                  <div className="gcard-title">Legend</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0.75rem 1rem" }}>
                    {(Object.keys(NODE_STYLE) as NodeType[]).map((t) => (
                      <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "var(--ink-3)" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: NODE_STYLE[t].color, flexShrink: 0 }} />
                        {NODE_STYLE[t].label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Context panel — trace OR selected OR analytics */}
                {mode === "trace" && selected && trace && traceBreakdown ? (
                  <div className="gcard">
                    <div className="gcard-title">Downstream Impact</div>
                    <div style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{selected.label}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", marginBottom: "0.6rem", textTransform: "capitalize" }}>{selected.type} · {trace.reached.length} entities affected</div>
                      {/* Node dossier — description + structured facts from meta */}
                      {(() => {
                        const m = (selected.meta ?? {}) as Record<string, unknown>;
                        const facts: [string, string][] = [];
                        if (m.capacity_mw) facts.push(["Capacity", `${Number(m.capacity_mw).toLocaleString()} MW`]);
                        if (m.fuel) facts.push(["Fuel", String(m.fuel)]);
                        if (m.state) facts.push(["State", String(m.state)]);
                        if (m.operator) facts.push(["Operator", String(m.operator)]);
                        if (m.year) facts.push(["Since", String(m.year)]);
                        return (
                          <>
                            {typeof m.description === "string" && m.description && (
                              <p style={{ fontSize: "0.73rem", color: "var(--ink-3)", lineHeight: 1.55, margin: "0 0 0.6rem", padding: "0.5rem 0.6rem", background: "var(--surface)", borderRadius: 6, borderLeft: "2px solid var(--green)" }}>
                                {m.description}
                              </p>
                            )}
                            {facts.map(([k, v]) => (
                              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--ink-5)" }}>{k}</span>
                                <span style={{ fontWeight: 600, color: "var(--ink)", textAlign: "right" }}>{v}</span>
                              </div>
                            ))}
                            {(facts.length > 0 || m.description) && <div style={{ borderTop: "1px solid var(--border)", margin: "0.5rem 0" }} />}
                          </>
                        );
                      })()}
                      {Object.entries(traceBreakdown).map(([t, n]) => (
                        <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.76rem" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-4)" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: NODE_STYLE[t as NodeType].color }} />
                            {NODE_STYLE[t as NodeType].label}
                          </span>
                          <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="gcard">
                    <div className="gcard-title">Network Analytics</div>
                    <div style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.875rem" }}>
                        <div><div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{analytics?.nodeCount}</div><div style={{ fontSize: "0.62rem", textTransform: "uppercase", color: "var(--ink-5)" }}>Nodes</div></div>
                        <div><div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{analytics?.edgeCount}</div><div style={{ fontSize: "0.62rem", textTransform: "uppercase", color: "var(--ink-5)" }}>Relationships</div></div>
                        <div><div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--red)" }}>{analytics?.singlePointsOfFailure.length}</div><div style={{ fontSize: "0.62rem", textTransform: "uppercase", color: "var(--ink-5)" }}>Critical</div></div>
                      </div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)", marginBottom: "0.5rem" }}>Most Connected</div>
                      {analytics?.centrality.slice(0, 6).map((c) => (
                        <div key={c.key} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.75rem" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: NODE_STYLE[c.type].color, flexShrink: 0 }} />
                            {c.label}
                          </span>
                          <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", flexShrink: 0, marginLeft: 8 }}>{c.degree}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Value framing */}
                <div className="gcard" style={{ borderLeft: "3px solid var(--green)" }}>
                  <div style={{ padding: "0.875rem 1rem", fontSize: "0.74rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                    This graph runs entirely on NEDB&apos;s existing Postgres — no external graph-database subscription. Relationships, traversal and centrality are computed in-house.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edge-type key (print + screen footer) */}
      <div className="page-wrap no-print" style={{ paddingBottom: "2rem", display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.7rem", color: "var(--ink-5)" }}>
        {Object.entries(EDGE_LABEL).map(([k, v]) => (
          <span key={k}>— {v}</span>
        ))}
      </div>

      <div className="no-print"><Footer /></div>

      {/* Print-only brief header */}
      <div className="print-only" style={{ display: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 0", borderBottom: "2px solid var(--green)" }}>
          <CoatOfArms size={44} />
          <div>
            <div style={{ fontWeight: 700, color: "var(--green)" }}>Energy Commission of Nigeria — NEDB</div>
            <div style={{ fontSize: "1.2rem", fontFamily: "var(--font-serif)" }}>National Energy Knowledge Graph — Brief</div>
          </div>
        </div>
      </div>

      <style>{`
        .gbtn { height: 30px; padding: 0 12px; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--border); border-radius: 6px; background: #fff; color: var(--ink-4); cursor: pointer; }
        .gbtn:hover { border-color: var(--green); color: var(--green); }
        .gbtn-active { background: var(--ink); color: #fff; border-color: var(--ink); }
        .gbtn-clear { background: var(--green-tint); color: var(--green); border-color: var(--green-line); }
        .gcard { background: #fff; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
        .gcard-title { padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-4); }
        @media (max-width: 900px) {
          .graph-layout { grid-template-columns: 1fr !important; }
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .graph-layout { grid-template-columns: 1fr !important; }
          .graph-canvas-wrap { display: none !important; }
          .print-graph-img { display: block !important; }
        }
      `}</style>
    </>
  );
}

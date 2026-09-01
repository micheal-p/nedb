"use client";

// ── NetworkGraph.tsx ────────────────────────────────────────────────────────
// Force-directed canvas for the Energy Knowledge Graph. react-force-graph-2d is
// canvas-based and touches window, so it is dynamically imported with ssr:false.
// Nodes are coloured by entity type and sized by degree; a highlight set (e.g.
// single points of failure, or a downstream trace) is drawn with an accent ring.
// capturePng() exposes the rendered canvas for the PDF/Excel report.

import { useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from "react";
import dynamic from "next/dynamic";
import { NODE_STYLE, EDGE_COLOR, type GraphData, type GraphNode } from "@/lib/graph-model";

// ── The lit look ────────────────────────────────────────────────────────────
// The graph now wears the platform's night identity: ink ground, nodes as
// lights with a soft canvas glow, luminous edges, and particles flowing along
// each link — energy moving through the system, the same language as the
// home-page map. The light-theme palette in graph-model stays untouched for
// the PDF export; these are the on-screen equivalents, lifted for a dark
// ground.
const INK_BG = "#101416";
export const DARK_NODE: Record<string, string> = {
  fuel: "#E8A04C", genco: "#4CC97B", transmission: "#F07862", disco: "#7AA2F7",
  state: "#B78AE8", policy: "#C9CFD4", institution: "#A98EEA", terminal: "#5BC8DE",
  refinery: "#F09B5E", gasplant: "#8B93F0", product: "#B9B3AC", export: "#4FC4B4",
  databank: "#38E08A", platform: "#EFCB6E", operator: "#D9A876",
};
export const DARK_EDGE: Record<string, string> = {
  fuel_supply: "rgba(232,160,76,0.30)", generates: "rgba(76,201,123,0.32)",
  wheels: "rgba(240,120,98,0.36)", distributes: "rgba(122,162,247,0.30)",
  governs: "rgba(201,207,212,0.16)", regulates: "rgba(169,142,234,0.26)",
  supplies: "rgba(91,200,222,0.30)", produces: "rgba(240,155,94,0.30)",
  exports: "rgba(79,196,180,0.30)", operates: "rgba(185,179,172,0.24)",
  tracks: "rgba(56,224,138,0.32)",
};

// Loaded through FG2DWrapper because next/dynamic does not forward refs —
// the instance ref travels as the plain `fgRef` prop instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("./FG2DWrapper"), { ssr: false }) as any;


export interface NetworkGraphHandle {
  capturePng: () => string | null;
  fitView: () => void;
  focusNode: (key: string) => void;
}

interface Props {
  data: GraphData;
  highlight?: Set<string>;      // keys to accent (spof / trace)
  dimUnhighlighted?: boolean;   // fade non-highlighted when a trace is active
  onNodeClick?: (node: GraphNode) => void;
  height?: number;
}

const NetworkGraph = forwardRef<NetworkGraphHandle, Props>(function NetworkGraph(
  { data, highlight, dimUnhighlighted, onNodeClick, height = 540 },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const didFit = useRef(false);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Fallback: if onEngineStop never fires (or fires before the ref attaches),
  // fit once anyway after the layout has had time to settle.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!didFit.current) {
        didFit.current = true;
        fitConnected();
      }
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // degree per node → node radius
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of data.edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [data]);

  // Zoom-to-fit framed on CONNECTED nodes only — a disconnected node drifts to
  // the canvas edge and would otherwise shrink the whole cluster to a dot.
  const fitConnected = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fgRef.current?.zoomToFit(0, 40, (n: any) => (degree.get(n.key) ?? 0) > 0);
  };

  const graphData = useMemo(() => ({
    nodes: data.nodes.map((n) => ({ ...n, id: n.key })),
    links: data.edges.map((e) => ({ ...e })),
  }), [data]);

  useImperativeHandle(ref, () => ({
    capturePng: () => {
      const canvas = wrapRef.current?.querySelector("canvas");
      return canvas ? (canvas as HTMLCanvasElement).toDataURL("image/png") : null;
    },
    fitView: () => fitConnected(),
    focusNode: (key: string) => {
      // graphData node objects are mutated in place by the force engine (x/y)
      const n = (graphData.nodes as unknown as { key: string; x?: number; y?: number }[])
        .find((g) => g.key === key);
      if (n && Number.isFinite(n.x) && Number.isFinite(n.y)) {
        fgRef.current?.centerAt(n.x, n.y, 500);
        fgRef.current?.zoom(2.4, 500);
      }
    },
  }), [graphData]);

  return (
    <div ref={wrapRef} style={{ width: "100%", height, background: `radial-gradient(ellipse 70% 70% at 50% 42%, rgba(21,64,38,0.35), transparent 75%), ${INK_BG}`, borderRadius: "var(--r-md)", border: "1px solid var(--border)", overflow: "hidden" }}>
      <ForceGraph2D
        fgRef={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={120}
        d3VelocityDecay={0.3}
        onEngineStop={() => {
          // Zoom to fit once after the force layout settles, so node labels are
          // legible on load instead of a small cluster lost in a large canvas.
          if (!didFit.current) {
            didFit.current = true;
            fitConnected();
          }
        }}
        nodeLabel={(n: GraphNode) => {
          const m = (n.meta ?? {}) as Record<string, unknown>;
          const bits = [NODE_STYLE[n.type]?.label ?? n.type];
          if (m.capacity_mw) bits.push(`${Number(m.capacity_mw).toLocaleString()} MW`);
          if (m.state) bits.push(String(m.state));
          return `<div style="font:600 12px Inter,sans-serif;padding:2px 0">${n.label}</div><div style="font:400 11px Inter,sans-serif;opacity:.7">${bits.join(" · ")}</div>`;
        }}
        linkColor={(l: { type: string }) => DARK_EDGE[l.type] ?? (EDGE_COLOR as Record<string, string>)[l.type] ?? "rgba(255,255,255,0.12)"}
        linkWidth={(l: { weight?: number }) => Math.max(0.6, Math.min(4, 0.6 + Math.log10(Math.max(1, l.weight ?? 1)) * 1.1))}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        // Energy moving through the system: particles flow along every link in
        // the direction the relationship points, heavier links carrying more.
        linkDirectionalParticles={(l: { weight?: number }) => ((l.weight ?? 1) > 100 ? 3 : 2)}
        linkDirectionalParticleSpeed={0.0035}
        linkDirectionalParticleWidth={1.7}
        linkDirectionalParticleColor={(l: { type: string }) => DARK_EDGE[l.type]?.replace(/0\.\d+\)$/, "0.9)") ?? "rgba(190,240,211,0.9)"}
        onNodeClick={(n: GraphNode) => onNodeClick?.(n)}
        // Pin nodes where the user drops them — otherwise the force simulation
        // reheats and pulls the node straight back ("it doesn't let me own my drag")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeDragEnd={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const style = NODE_STYLE[node.type as keyof typeof NODE_STYLE] ?? NODE_STYLE.state;
          const deg = degree.get(node.key) ?? 1;
          const r = style.size + Math.min(4, deg * 0.35);
          const isHi = highlight?.has(node.key);
          const dim = dimUnhighlighted && highlight && !isHi;

          const fill = DARK_NODE[node.type as string] ?? style.color;

          // accent ring for highlighted nodes
          if (isHi) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(240,120,98,0.25)";
            ctx.fill();
          }

          // every node is a light: soft canvas glow in its own colour
          ctx.save();
          ctx.shadowColor = dim ? "transparent" : fill;
          ctx.shadowBlur = dim ? 0 : Math.min(18, 6 + deg * 1.2);
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = dim ? "rgba(110,120,125,0.35)" : fill;
          ctx.fill();
          ctx.restore();
          ctx.lineWidth = isHi ? 2 : 0.75;
          ctx.strokeStyle = isHi ? "#F07862" : "rgba(16,20,22,0.9)";
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.stroke();

          // label — constant ~11px on screen regardless of zoom (divide by scale),
          // with a white halo so text stays legible over edges and nearby nodes
          const label = node.label as string;
          const fontSize = 11 / globalScale;
          if (globalScale > 0.55 || deg >= 4 || isHi) {
            ctx.font = `${isHi ? 600 : 400} ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.lineWidth = fontSize / 3.5;
            ctx.strokeStyle = "rgba(16,20,22,0.85)";
            ctx.strokeText(label, node.x, node.y + r + 1.5 / globalScale);
            ctx.fillStyle = dim ? "rgba(140,150,155,0.5)" : "rgba(235,242,238,0.92)";
            ctx.fillText(label, node.x, node.y + r + 1.5 / globalScale);
          }
        }}
        nodePointerAreaPaint={(node: { x: number; y: number; type: string }, color: string, ctx: CanvasRenderingContext2D) => {
          const style = NODE_STYLE[node.type as keyof typeof NODE_STYLE] ?? NODE_STYLE.state;
          const deg = degree.get((node as unknown as GraphNode).key) ?? 1;
          const r = style.size + Math.min(4, deg * 0.35);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
          ctx.fill();
        }}
      />
    </div>
  );
});

export default NetworkGraph;

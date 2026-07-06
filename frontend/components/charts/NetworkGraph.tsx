"use client";

// ── NetworkGraph.tsx ────────────────────────────────────────────────────────
// Force-directed canvas for the Energy Knowledge Graph. react-force-graph-2d is
// canvas-based and touches window, so it is dynamically imported with ssr:false.
// Nodes are coloured by entity type and sized by degree; a highlight set (e.g.
// single points of failure, or a downstream trace) is drawn with an accent ring.
// capturePng() exposes the rendered canvas for the PDF/Excel report.

import { useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from "react";
import dynamic from "next/dynamic";
import { NODE_STYLE, type GraphData, type GraphNode } from "@/lib/graph-model";

// Loaded through FG2DWrapper because next/dynamic does not forward refs —
// the instance ref travels as the plain `fgRef` prop instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("./FG2DWrapper"), { ssr: false }) as any;

const EDGE_COLOR: Record<string, string> = {
  fuel_supply: "rgba(180,83,9,0.35)",
  generates:   "rgba(14,122,60,0.35)",
  wheels:      "rgba(192,57,43,0.40)",
  distributes: "rgba(29,78,216,0.30)",
  governs:     "rgba(10,10,10,0.18)",
  regulates:   "rgba(124,58,237,0.25)",
  supplies:    "rgba(8,145,178,0.30)",
  produces:    "rgba(234,88,12,0.35)",
  exports:     "rgba(15,118,110,0.35)",
  operates:    "rgba(87,83,78,0.30)",
};

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
    <div ref={wrapRef} style={{ width: "100%", height, background: "#FBFAF6", borderRadius: "var(--r-md)", border: "1px solid var(--border)", overflow: "hidden" }}>
      <ForceGraph2D
        fgRef={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="#FBFAF6"
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
        linkColor={(l: { type: string }) => EDGE_COLOR[l.type] ?? "rgba(0,0,0,0.15)"}
        linkWidth={(l: { weight?: number }) => Math.max(0.5, Math.min(4, Math.sqrt((l.weight ?? 1)) / 12))}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
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

          // accent ring for highlighted nodes
          if (isHi) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(224,79,57,0.20)";
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = dim ? "rgba(180,175,168,0.5)" : style.color;
          ctx.fill();
          ctx.lineWidth = isHi ? 2 : 0.8;
          ctx.strokeStyle = isHi ? "#E04F39" : "#ffffff";
          ctx.stroke();

          // label — constant ~11px on screen regardless of zoom (divide by scale),
          // with a white halo so text stays legible over edges and nearby nodes
          const label = node.label as string;
          const fontSize = 11 / globalScale;
          if (globalScale > 1.1 || deg >= 6) {
            ctx.font = `${fontSize}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.lineWidth = fontSize / 3.5;
            ctx.strokeStyle = "rgba(251,250,246,0.9)";
            ctx.strokeText(label, node.x, node.y + r + 1.5 / globalScale);
            ctx.fillStyle = dim ? "rgba(120,110,100,0.5)" : "#0A0A0A";
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

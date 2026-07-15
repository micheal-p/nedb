// ── lib/graph-model.ts ──────────────────────────────────────────────────────
// Pure, framework-free graph utilities for the Energy Knowledge Graph. Given
// typed nodes + edges it computes the analytics that a graph database would
// normally provide: degree centrality and single-point-of-failure detection
// (articulation points). No React, no I/O — the same modular contract as
// analytics.ts and report-model.ts.

export type NodeType = "fuel" | "genco" | "transmission" | "disco" | "state" | "policy" | "institution" | "terminal" | "refinery" | "gasplant" | "product" | "export" | "databank" | "platform";
export type EdgeType = "fuel_supply" | "generates" | "wheels" | "distributes" | "governs" | "regulates" | "supplies" | "produces" | "exports" | "operates" | "tracks" | "finances" | "displaces" | "located_in";

export interface GraphNode {
  key: string;
  label: string;
  type: NodeType;
  meta?: Record<string, unknown> | null;
}
export interface GraphEdge {
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Presentation metadata (shared by graph canvas + legend) ─────────────────

export const NODE_STYLE: Record<NodeType, { color: string; label: string; size: number }> = {
  fuel:         { color: "#B45309", label: "Fuel / Primary Energy", size: 7 },
  genco:        { color: "#0E7A3C", label: "Generation (GenCo)",     size: 6 },
  transmission: { color: "#C0392B", label: "Transmission (TCN)",     size: 10 },
  disco:        { color: "#1D4ED8", label: "Distribution (DisCo)",   size: 6 },
  state:        { color: "#6B21A8", label: "State (Demand)",         size: 5 },
  policy:       { color: "#0A0A0A", label: "Policy Instrument",      size: 6 },
  institution:  { color: "#7C3AED", label: "Institution / Regulator", size: 8 },
  terminal:     { color: "#0891B2", label: "Export Terminal",         size: 6 },
  refinery:     { color: "#EA580C", label: "Refinery",                size: 7 },
  gasplant:     { color: "#4338CA", label: "Gas Processing / LNG",    size: 7 },
  product:      { color: "#57534E", label: "Petroleum Product",       size: 5 },
  export:       { color: "#0F766E", label: "Export Market",           size: 8 },
  databank:     { color: "#1EB06A", label: "NEDB (Data Backbone)",    size: 14 },
  platform:     { color: "#E8B84B", label: "NEIIA Product",           size: 6 },
};

export const EDGE_LABEL: Record<EdgeType, string> = {
  fuel_supply:  "supplies",
  generates:    "generates to",
  wheels:       "wheels to",
  distributes:  "distributes to",
  governs:      "governs",
  regulates:    "regulates",
  supplies:     "supplies",
  produces:     "produces",
  exports:      "exports to",
  operates:     "operates",
  tracks:       "tracks data for",
  finances:     "finances",
  displaces:    "displaces",
  located_in:   "located in",
};

// ── Degree centrality ───────────────────────────────────────────────────────

export interface Centrality {
  key: string;
  label: string;
  type: NodeType;
  degree: number;   // total connections
  inDeg: number;
  outDeg: number;
}

/** Rank nodes by how connected they are. Highest degree = most systemically central. */
export function degreeCentrality(g: GraphData): Centrality[] {
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const n of g.nodes) { inDeg.set(n.key, 0); outDeg.set(n.key, 0); }
  for (const e of g.edges) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }
  return g.nodes
    .map((n) => ({
      key: n.key, label: n.label, type: n.type,
      inDeg: inDeg.get(n.key) ?? 0,
      outDeg: outDeg.get(n.key) ?? 0,
      degree: (inDeg.get(n.key) ?? 0) + (outDeg.get(n.key) ?? 0),
    }))
    .sort((a, b) => b.degree - a.degree);
}

// ── Single points of failure (Tarjan articulation points) ───────────────────
// An articulation point is a node whose removal splits the network into
// disconnected pieces — i.e. a single point of failure for energy delivery.

export function articulationPoints(g: GraphData): string[] {
  const adj = new Map<string, Set<string>>();
  for (const n of g.nodes) adj.set(n.key, new Set());
  for (const e of g.edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source); // undirected for connectivity
  }

  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const aps = new Set<string>();
  let timer = 0;

  // iterative DFS to avoid stack overflow on larger graphs
  for (const start of g.nodes.map((n) => n.key)) {
    if (visited.has(start)) continue;
    const stack: { node: string; iter: Iterator<string>; children: number }[] = [];
    visited.add(start);
    disc.set(start, timer); low.set(start, timer); timer++;
    parent.set(start, null);
    stack.push({ node: start, iter: (adj.get(start) ?? new Set()).values(), children: 0 });

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const next = frame.iter.next();
      if (!next.done) {
        const to = next.value;
        if (!visited.has(to)) {
          visited.add(to);
          parent.set(to, frame.node);
          disc.set(to, timer); low.set(to, timer); timer++;
          frame.children++;
          stack.push({ node: to, iter: (adj.get(to) ?? new Set()).values(), children: 0 });
        } else if (to !== parent.get(frame.node)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, disc.get(to)!));
        }
      } else {
        stack.pop();
        const p = parent.get(frame.node);
        if (p !== null && p !== undefined) {
          low.set(p, Math.min(low.get(p)!, low.get(frame.node)!));
          if (parent.get(p) !== null && low.get(frame.node)! >= disc.get(p)!) aps.add(p);
        }
      }
    }
    // root is an articulation point iff it has more than one DFS child
    let rootChildren = 0;
    for (const [, v] of parent) if (v === start) rootChildren++;
    if (rootChildren > 1) aps.add(start);
  }

  return [...aps];
}

// ── Downstream trace (BFS over directed edges) ──────────────────────────────
// "If this node fails / this fuel is disrupted, what does it affect?"

export interface TracePath {
  reached: string[];        // all downstream node keys
  hops: { key: string; depth: number }[];
}

export function traceDownstream(g: GraphData, startKey: string, maxDepth = 6): TracePath {
  const out = new Map<string, string[]>();
  for (const e of g.edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e.target);
  }
  const reached = new Set<string>();
  const hops: { key: string; depth: number }[] = [];
  const queue: { key: string; depth: number }[] = [{ key: startKey, depth: 0 }];
  reached.add(startKey);
  while (queue.length) {
    const { key, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const nxt of out.get(key) ?? []) {
      if (!reached.has(nxt)) {
        reached.add(nxt);
        hops.push({ key: nxt, depth: depth + 1 });
        queue.push({ key: nxt, depth: depth + 1 });
      }
    }
  }
  return { reached: [...reached].filter((k) => k !== startKey), hops };
}

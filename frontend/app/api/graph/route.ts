import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import {
  degreeCentrality, articulationPoints,
  type GraphData, type GraphNode, type GraphEdge,
} from "@/lib/graph-model";

// GET /api/graph — full Energy Knowledge Graph + computed analytics.
// Nodes, edges, degree-centrality ranking, and single-point-of-failure list are
// all returned so the client can render without recomputing heavy pieces.
export async function GET() {
  const [{ data: nodeRows, error: ne }, { data: edgeRows, error: ee }, { data: liveRows }] = await Promise.all([
    db().from("graph_nodes").select("node_key, label, node_type, meta"),
    db().from("graph_edges").select("source_key, target_key, edge_type, weight"),
    // Living graph: latest national reading per mapped series, shown on the node dossier
    db().from("energy_records")
      .select("series_type_id, period, value, unit, region")
      .in("series_type_id", ["natural_gas_production", "crude_oil_production", "electricity_generation", "renewable_capacity", "pms_sales"])
      .order("period_date", { ascending: false })
      .limit(400),
  ]);

  // series → graph node carrying its live reading
  const LIVE_MAP: Record<string, string> = {
    natural_gas_production: "fuel_gas",
    crude_oil_production: "product_crude",
    electricity_generation: "tcn",
    renewable_capacity: "fuel_hydro",
    pms_sales: "prod_pms",
  };
  const liveByNode = new Map<string, { value: number; unit: string; period: string; series: string }>();
  for (const r of liveRows ?? []) {
    if (r.region && !["NGA", "", "national"].includes(r.region)) continue;
    const nodeKey = LIVE_MAP[r.series_type_id];
    if (nodeKey && !liveByNode.has(nodeKey)) {
      liveByNode.set(nodeKey, { value: Number(r.value), unit: r.unit, period: r.period, series: r.series_type_id });
    }
  }

  if (ne || ee) return err(ne?.message ?? ee?.message ?? "graph load failed", 500);

  const nodes: GraphNode[] = (nodeRows ?? []).map((n) => ({
    key: n.node_key, label: n.label, type: n.node_type,
    meta: liveByNode.has(n.node_key)
      ? { ...(n.meta ?? {}), live: liveByNode.get(n.node_key) }
      : n.meta,
  }));
  const edges: GraphEdge[] = (edgeRows ?? []).map((e) => ({
    source: e.source_key, target: e.target_key, type: e.edge_type, weight: Number(e.weight ?? 1),
  }));

  const graph: GraphData = { nodes, edges };
  const centrality = degreeCentrality(graph);
  const spof = articulationPoints(graph);

  return ok({
    nodes,
    edges,
    analytics: {
      centrality: centrality.slice(0, 8),
      singlePointsOfFailure: spof,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  });
}

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
  const [{ data: nodeRows, error: ne }, { data: edgeRows, error: ee }] = await Promise.all([
    db().from("graph_nodes").select("node_key, label, node_type, meta"),
    db().from("graph_edges").select("source_key, target_key, edge_type, weight"),
  ]);

  if (ne || ee) return err(ne?.message ?? ee?.message ?? "graph load failed", 500);

  const nodes: GraphNode[] = (nodeRows ?? []).map((n) => ({
    key: n.node_key, label: n.label, type: n.node_type, meta: n.meta,
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

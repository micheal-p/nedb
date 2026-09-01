import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// POST /api/graph/sync — the graph stops being entirely hand-seeded: licensed
// operators are derived from the companies registry, one node per active
// company, wired to what their sector actually touches. Derived rows are
// namespaced (co_<id>) and rebuilt wholesale on every sync, so the registry
// is the source of truth and the graph can never drift from it — phase two
// of the revamp: the registry feeds the picture.

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin required", 403);
  const who = String(admin.username ?? admin.sub ?? "unknown");

  const { data: companies, error: ce } = await db()
    .from("companies_registry")
    .select("id, company, oml_blocks, operator_type, sector, status");
  if (ce) return err(ce.message, 500);

  const active = (companies ?? []).filter((c) => (c.status ?? "").toLowerCase() === "active");

  // Rebuild the derived layer wholesale
  await db().from("graph_edges").delete().like("source_key", "co_%");
  await db().from("graph_nodes").delete().like("node_key", "co_%");

  const nodes = active.map((c) => ({
    node_key: `co_${c.id}`,
    label: String(c.company).replace(/\s*\([^)]*\)\s*$/, ""),
    node_type: "operator",
    meta: {
      description: `${c.operator_type ?? "Operator"} · ${c.sector}${c.oml_blocks ? ` · ${c.oml_blocks}` : ""} — derived from the companies registry`,
      registry_id: c.id,
      oml_blocks: c.oml_blocks,
    },
  }));
  if (nodes.length) {
    const { error } = await db().from("graph_nodes").insert(nodes);
    if (error) return err(error.message, 500);
  }

  // Sector → what the operator actually touches in the system
  const TARGET: Record<string, string> = { Upstream: "product_crude", Midstream: "fuel_gas", Downstream: "prod_pms", Power: "tcn" };
  const edges = active
    .map((c) => ({ source_key: `co_${c.id}`, target_key: TARGET[c.sector ?? ""] ?? "product_crude", edge_type: "operates", weight: 1 }))
    .filter((e) => e.target_key);
  if (edges.length) {
    const { error } = await db().from("graph_edges").insert(edges);
    if (error) return err(error.message, 500);
  }

  await logAudit({ action: "GRAPH_SYNCED", performed_by: who, notes: `Derived ${nodes.length} operator nodes and ${edges.length} edges from the companies registry` });
  return ok({ operators: nodes.length, edges: edges.length });
}

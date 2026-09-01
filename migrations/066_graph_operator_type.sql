-- ── 066: the graph learns the operator layer ────────────────────────────────
-- Run after 065. graph_nodes carries a CHECK on node_type; 'operator' — the
-- registry-derived company layer from /api/graph/sync — joins the list.

ALTER TABLE graph_nodes DROP CONSTRAINT IF EXISTS graph_nodes_node_type_check;
ALTER TABLE graph_nodes ADD CONSTRAINT graph_nodes_node_type_check
  CHECK (node_type IN ('fuel', 'genco', 'transmission', 'disco', 'state', 'policy', 'institution',
                       'terminal', 'refinery', 'gasplant', 'product', 'export', 'databank', 'platform', 'operator'));

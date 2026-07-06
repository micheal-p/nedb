-- ── 024: Remove disconnected fuel nodes from the knowledge graph ─────────────
-- fuel_diesel and fuel_coal were seeded in 016 but have no relationships:
-- no grid-connected power plant in Nigeria runs on diesel or coal, so within a
-- grid supply-chain graph they are orphans — the force layout flings them to
-- the edges of the canvas. They should return only when off-grid/self-generation
-- modelling is added (where diesel genuinely belongs).

DELETE FROM graph_nodes WHERE node_key IN ('fuel_diesel', 'fuel_coal');

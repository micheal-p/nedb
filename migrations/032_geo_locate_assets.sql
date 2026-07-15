-- ── 032: Anchor assets to the states they actually sit in ─────────────────────
-- Every generation plant, refinery and export terminal already carries a
-- `state` field in its own meta JSON (set back in 016/018/025) — it was just
-- never turned into a graph edge. The result: 37 state nodes had exactly one
-- connection (their franchise DisCo), so the force layout flings them out as a
-- ring of single-thread leaves — the "scattered nodes" the graph visibly has.
--
-- This doesn't invent geography — it reads the state each node already
-- declares about itself and wires it in as a real 'located_in' edge. States
-- that host a plant, refinery or terminal go from one connection to several;
-- states that genuinely don't host any of these (most of the North) stay at
-- one, honestly, because that's the real topology.
--
-- The two deepwater FPSOs (Bonga, Agbami) are deliberately skipped — their
-- meta.state is "Deep offshore," which isn't a state.

ALTER TABLE graph_edges DROP CONSTRAINT IF EXISTS graph_edges_edge_type_check;
ALTER TABLE graph_edges ADD CONSTRAINT graph_edges_edge_type_check
  CHECK (edge_type IN ('fuel_supply','generates','wheels','distributes','governs',
                       'regulates','supplies','produces','exports','operates','tracks',
                       'finances','displaces','located_in'));

INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('genco_afam','state_rivers','located_in',1),
('genco_alaoji','state_abia','located_in',1),
('genco_azura','state_edo','located_in',1),
('genco_dadinkowa','state_gombe','located_in',1),
('genco_delta','state_delta','located_in',1),
('genco_egbin','state_lagos','located_in',1),
('genco_gbarain','state_bayelsa','located_in',1),
('genco_geregu','state_kogi','located_in',1),
('genco_geregu_nipp','state_kogi','located_in',1),
('genco_ibom','state_akwaibom','located_in',1),
('genco_ihovbor','state_edo','located_in',1),
('genco_jebba','state_niger','located_in',1),
('genco_kainji','state_niger','located_in',1),
('genco_kashimbilla','state_taraba','located_in',1),
('genco_katsina_wind','state_katsina','located_in',1),
('genco_odukpani','state_crossriver','located_in',1),
('genco_okpai','state_delta','located_in',1),
('genco_olorunsogo','state_ogun','located_in',1),
('genco_omoku','state_rivers','located_in',1),
('genco_omotosho','state_ondo','located_in',1),
('genco_rivers_ipp','state_rivers','located_in',1),
('genco_sapele','state_delta','located_in',1),
('genco_sapele_nipp','state_delta','located_in',1),
('genco_shiroro','state_niger','located_in',1),
('genco_zungeru','state_niger','located_in',1),
('mid_nlng','state_rivers','located_in',1),
('ref_dangote','state_lagos','located_in',1),
('ref_kaduna','state_kaduna','located_in',1),
('ref_ph','state_rivers','located_in',1),
('ref_warri','state_delta','located_in',1),
('term_bonny','state_rivers','located_in',1),
('term_brass','state_bayelsa','located_in',1),
('term_escravos','state_delta','located_in',1),
('term_forcados','state_delta','located_in',1),
('term_quaiboe','state_akwaibom','located_in',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

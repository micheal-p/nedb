-- ── 026: Precise Dangote Refinery location ───────────────────────────────────
-- All public records place the refinery in the Lekki Free Zone, IBEJU-LEKKI LGA,
-- Lagos State — on the Epe axis but not within Epe LGA. Making the dossier
-- precise so the assistant answers with the full location.

UPDATE graph_nodes SET meta = meta || jsonb_build_object(
  'description',
  '650,000 bpd single-train refinery in the Lekki Free Zone, Ibeju-Lekki LGA, Lagos State (on the Epe axis) — the largest in Africa. Began production 2024, supplying PMS, AGO, kerosene and LPG to the domestic market and export.',
  'lga', 'Ibeju-Lekki'
) WHERE node_key = 'ref_dangote';

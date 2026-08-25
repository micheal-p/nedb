-- ── 049: close the last two public WRITE paths ──────────────────────────────
-- Run in the Supabase SQL editor after 048.
--
-- After 047 the only policies still granted TO PUBLIC are intentional public
-- READS (lgas, series_types, energy_records, the custom_* portal, graph nodes
-- and edges, nbs_benchmarks, the companies registry listing) plus these two,
-- which are writes:
--
--   companies_registry."service role write registry"  cmd = ALL
--     The name says service role. The grant says PUBLIC. Anyone holding the
--     anon key could INSERT, UPDATE or DELETE rows in the companies registry.
--
--   access_requests.insert_request                    cmd = INSERT, CHECK true
--     An unrestricted public INSERT with no column restriction. A request row
--     carries granted_profile, which the provisioning step reads when an admin
--     approves it, so a forged row is a route to being granted a planning
--     profile. It also allows unbounded junk into the queue.
--
-- Neither is needed. Every write in the application goes through the API using
-- SUPABASE_SERVICE_ROLE_KEY, which BYPASSES row-level security, and there is no
-- browser-side Supabase client in this codebase (no NEXT_PUBLIC_SUPABASE_* key
-- exists anywhere). The public access-request form posts to
-- /api/access-requests, which is server-side and unaffected.

DROP POLICY IF EXISTS "service role write registry" ON companies_registry;
DROP POLICY IF EXISTS "insert_request"              ON access_requests;

-- Verify: this should return only SELECT policies afterwards.
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public' AND 'public' = ANY(roles)
--   ORDER BY (cmd <> 'SELECT') DESC, tablename;

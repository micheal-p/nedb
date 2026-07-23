-- ── 037: RLS lockdown — remove world-open "service role" policies ────────────
-- Run in the Supabase SQL editor after 036.
--
-- Every policy below was written as
--   CREATE POLICY "service_role_x" ON x USING (true) WITH CHECK (true);
-- with no FOR/TO clause — which PostgreSQL interprets as FOR ALL TO PUBLIC.
-- That means anyone holding the project's anon key could read AND write these
-- tables directly through PostgREST, bypassing every auth check in the API.
--
-- The policies are also unnecessary: the API talks to the database with the
-- service-role key, which BYPASSES row-level security entirely. Dropping them
-- changes nothing for the app and closes the anon-key door. Intentional
-- public READ policies (lgas, custom_* public portal, nbs_benchmarks) remain.

DROP POLICY IF EXISTS "service_role_lgas"            ON lgas;
DROP POLICY IF EXISTS "service_role_full"            ON access_requests;
DROP POLICY IF EXISTS "service_role_custom_series"   ON custom_series;
DROP POLICY IF EXISTS "service_role_custom_columns"  ON custom_columns;
DROP POLICY IF EXISTS "service_role_custom_records"  ON custom_records;
DROP POLICY IF EXISTS "service_nodes"                ON graph_nodes;
DROP POLICY IF EXISTS "service_edges"                ON graph_edges;
DROP POLICY IF EXISTS "service_doc_chunks"           ON doc_chunks;
DROP POLICY IF EXISTS "service_api_keys"             ON api_keys;
DROP POLICY IF EXISTS "service_ask_logs"             ON ask_logs;
DROP POLICY IF EXISTS "service_subscribers"          ON subscribers;
DROP POLICY IF EXISTS "service_report_state"         ON report_state;
DROP POLICY IF EXISTS "service_role_pena_forms"      ON pena_forms;
DROP POLICY IF EXISTS "service_role_pena_questions"  ON pena_questions;
DROP POLICY IF EXISTS "service_role_pena_responses"  ON pena_responses;
DROP POLICY IF EXISTS "service_role_nbs_benchmarks"  ON nbs_benchmarks;

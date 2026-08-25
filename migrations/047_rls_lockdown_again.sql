-- ── 047: RLS lockdown, again — the 037 regression ───────────────────────────
-- Run in the Supabase SQL editor after 046.
--
-- Migration 037 removed every policy written as
--   CREATE POLICY "service_role_x" ON x USING (true) WITH CHECK (true);
-- because with no FOR/TO clause PostgreSQL reads it as FOR ALL TO PUBLIC, so
-- anyone holding the project's anon key could read AND write the table straight
-- through PostgREST, bypassing every check in the API.
--
-- Migrations 040, 043, 044, 045 and 046 then reintroduced exactly that pattern
-- on eleven new tables. Among them:
--
--   company_declarations  the hash-chained ledger the whole tamper-evidence
--                         argument rests on. A public INSERT path into an
--                         append-only ledger defeats the point of having one.
--   pena_view_log         the record of who looked at assessment data.
--   pena_form_access      the access control table itself.
--
-- The policies were never needed. The API talks to the database with the
-- service-role key, which BYPASSES row-level security entirely. Dropping them
-- changes nothing for the app and closes the anon-key door.
--
-- Intentional public READ policies (lgas, the custom_* public portal,
-- nbs_benchmarks) are untouched.

DROP POLICY IF EXISTS "service_role_bulletin_editions"  ON bulletin_editions;
DROP POLICY IF EXISTS "service_role_bulletin_stories"   ON bulletin_stories;
DROP POLICY IF EXISTS "service_role_broadcasts"         ON broadcasts;
DROP POLICY IF EXISTS "service_role_company_declarations" ON company_declarations;
DROP POLICY IF EXISTS "service_role_telemetry_readings" ON telemetry_readings;
DROP POLICY IF EXISTS "service_role_reconciliation_runs" ON reconciliation_runs;
DROP POLICY IF EXISTS "service_role_pena_form_access"   ON pena_form_access;
DROP POLICY IF EXISTS "service_role_pena_view_log"      ON pena_view_log;
DROP POLICY IF EXISTS "service_role_access_events"      ON access_request_events;
DROP POLICY IF EXISTS "service_role_tickets"            ON support_tickets;
DROP POLICY IF EXISTS "service_role_ticket_replies"     ON support_ticket_replies;

-- Belt and braces: RLS on, no permissive policy, service role still passes.
ALTER TABLE bulletin_editions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletin_stories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_declarations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_readings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pena_form_access        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pena_view_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_request_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_replies  ENABLE ROW LEVEL SECURITY;

-- Verify: this should return zero rows after the migration.
--   SELECT tablename, policyname, roles
--   FROM pg_policies
--   WHERE schemaname = 'public' AND 'public' = ANY(roles);

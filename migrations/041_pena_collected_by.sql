-- ── 041: PENA enumerator mode ───────────────────────────────────────────────
-- A signed-in staff enumerator collects many responses door to door on one
-- device and one connection; responses they record carry their username so
-- field-collected data is attributable and auditable.

ALTER TABLE pena_responses ADD COLUMN IF NOT EXISTS collected_by TEXT;

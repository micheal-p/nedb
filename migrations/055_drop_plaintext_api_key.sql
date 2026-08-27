-- ── 055: drop the plaintext API key column ──────────────────────────────────
-- Run after 054.
--
-- 054 added key_hash and intended to keep api_keys.key until a deploy had been
-- verified against the hash. That was the wrong sequence: `key` is NOT NULL, so
-- as soon as the application stopped writing it, issuing a key failed with
--
--   null value in column "key" of relation "api_keys" violates not-null constraint
--
-- Keeping the column was not a safety net, it was the thing that broke. There
-- is nothing to lose by dropping it now: no keys have ever been issued on this
-- database, so there is no plaintext to migrate and no integration to break.
--
-- After this the secret exists in exactly one place, for one moment: the HTTP
-- response to the administrator who issued it. Nothing can retrieve it again.

ALTER TABLE api_keys DROP COLUMN IF EXISTS key;

-- key_hash is how a presented key is matched, so it must be present.
UPDATE api_keys SET key_hash = NULL WHERE key_hash = '';
ALTER TABLE api_keys ALTER COLUMN key_hash SET NOT NULL;

COMMENT ON TABLE api_keys IS
  'Public API credentials. The secret is never stored: only its SHA-256 (key_hash), a non-secret prefix for recognition, and the last four characters.';

-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'api_keys' ORDER BY column_name;   -- 'key' must be absent

-- ── 054: store API keys hashed, not in clear ────────────────────────────────
-- Run after 053.
--
-- api_keys.key holds the live secret in plain text, and the admin console
-- selects and displays it. Anyone with a database export, a backup, a screen
-- share or a screenshot of that page has working credentials for the public
-- API. There is no reason to hold the secret: verification only needs to know
-- whether a presented key matches, which a hash answers.
--
-- The change is made so existing integrations keep working:
--   • key_hash and key_prefix are added and populated from the existing keys
--   • key is kept for now, so a deploy can land before the column is dropped
--   • 055 drops it once the application is verified against the hash
--
-- key_prefix is the first 12 characters ("nedb_" plus 7). It is not a secret
-- and it is what lets an administrator recognise a key in a list after the
-- secret itself is no longer retrievable.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS key_hash   TEXT,
  ADD COLUMN IF NOT EXISTS key_prefix TEXT,
  ADD COLUMN IF NOT EXISTS last_four  TEXT;

UPDATE api_keys
SET key_hash   = encode(digest(key, 'sha256'), 'hex'),
    key_prefix = left(key, 12),
    last_four  = right(key, 4)
WHERE key_hash IS NULL AND key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_hash ON api_keys(key_hash);

COMMENT ON COLUMN api_keys.key IS
  'DEPRECATED plaintext secret. Superseded by key_hash; dropped in 055. Do not read.';
COMMENT ON COLUMN api_keys.key_hash IS
  'SHA-256 of the issued key. The secret is shown once at issue and never stored.';

-- Verify:
--   SELECT id, label, key_prefix, last_four, key_hash IS NOT NULL AS hashed FROM api_keys;

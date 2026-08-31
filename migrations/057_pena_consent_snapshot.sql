-- ── 057: record WHAT each respondent consented to, not only when ────────────
-- Run after 056.
--
-- pena_responses.consent_at has always recorded the moment consent was given.
-- The wording consented to lived in one mutable column, pena_forms.consent_text,
-- which an administrator can edit at any time through PATCH /api/pena/forms/:id.
--
-- So the platform could say a household consented at 14:32 on a Tuesday, and
-- could not say to what. That is the one thing NDPA 2023 asks a controller to
-- be able to demonstrate, and consent-first is the whole argument PENA rests
-- on. Every response written from now on carries its own copy of the statement
-- the respondent accepted.
--
-- DELIBERATELY NOT BACKFILLED. Copying today's form wording onto responses
-- collected before this migration would manufacture a consent record that was
-- never captured: the wording may have changed since. NULL here means exactly
-- what it should mean, "we did not record this at the time", and it stays
-- visible rather than being papered over.

ALTER TABLE pena_responses
  ADD COLUMN IF NOT EXISTS consent_text TEXT;

COMMENT ON COLUMN pena_responses.consent_text IS
  'The consent statement this respondent accepted, copied at submit time. NULL on responses collected before migration 057, where the wording at the time was not captured.';

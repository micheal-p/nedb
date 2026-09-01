-- ── 058: opt-in re-contact, the foundation PENA panels stand on ─────────────
-- Run after 057.
--
-- Every PENA assessment is a snapshot. Measuring whether anything improved
-- means asking the same household again later, and nothing in the current
-- consent covers being contacted again. Retro-fitting consent is not a thing
-- that can be done, so the box has to exist before the responses arrive.
--
-- The permission is opt-in, unticked by default, separate from the consent
-- required to submit, and recorded per response. 057 already snapshots the
-- consent wording per response, so which household agreed to which text is
-- answerable.

ALTER TABLE pena_responses
  ADD COLUMN IF NOT EXISTS recontact_ok BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN pena_responses.recontact_ok IS
  'Respondent ticked the optional box allowing NEDB to contact them again for a follow-up assessment. Opt-in, false by default, withdrawable.';

-- The three seeded assessments still carry the original default consent text
-- verbatim. Fold them onto the new default, which names the follow-up box.
-- Only exact matches are touched: an admin-edited consent stays as written.
UPDATE pena_forms
SET consent_text =
  'I voluntarily provide this information to the Nigeria Energy Data Bank (NEDB) for energy access ' ||
  'assessment and planning. I understand that my personal details (name, email, phone, address) will be ' ||
  'kept confidential in line with the Nigeria Data Protection Act 2023 and Section 37 of the Constitution, ' ||
  'and that only anonymised, aggregated statistics — never my identity or location — may be published as ' ||
  'open data. NEDB will contact me again about a follow-up assessment only if I tick the optional box ' ||
  'below, and I can withdraw that permission at any time. I may request removal of my data at any time.'
WHERE consent_text =
  'I voluntarily provide this information to the Nigeria Energy Data Bank (NEDB) for energy access ' ||
  'assessment and planning. I understand that my personal details (name, email, phone, address) will be ' ||
  'kept confidential in line with the Nigeria Data Protection Act 2023 and Section 37 of the Constitution, ' ||
  'and that only anonymised, aggregated statistics — never my identity or location — may be published as ' ||
  'open data. I may request removal of my data at any time.';

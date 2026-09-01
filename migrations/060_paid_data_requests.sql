-- ── 060: data requests carry a price ────────────────────────────────────────
-- Run after 059.
--
-- The open data stays free — that is the point of the open data. What a data
-- request buys is WORK: a custom extract, a merge, a filtered cut prepared by
-- the data management unit. Work priced at nothing gets requested without
-- thought and fulfilled without priority, so a request is now quoted by an
-- administrator and paid before it is fulfilled. A quote of zero remains
-- possible: waiving the fee is a decision, not a default.
--
-- Status flow: pending → quoted → paid → fulfilled, or declined at any point.

ALTER TABLE data_requests
  ADD COLUMN IF NOT EXISTS price_ngn    NUMERIC,
  ADD COLUMN IF NOT EXISTS quote_note   TEXT,          -- what the price covers, shown to the requester
  ADD COLUMN IF NOT EXISTS priced_by    TEXT,
  ADD COLUMN IF NOT EXISTS priced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paystack_ref TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS paid_at      TIMESTAMPTZ;

COMMENT ON COLUMN data_requests.price_ngn IS
  'Processing fee quoted by an administrator, naira. NULL = not yet quoted; 0 = fee deliberately waived.';

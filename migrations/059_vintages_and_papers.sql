-- ── 059: frozen data vintages, orders on them, and working papers ───────────
-- Run after 058.
--
-- A vintage is the data bank frozen at a moment: every published series with
-- its records, and every published assessment's k-anonymised aggregates,
-- captured as one document with a checksum. The live series keep moving; the
-- vintage never does. That is what makes a figure citable — "as published on
-- 1 September 2026, checksum sha256:…" — and what makes a purchased dataset
-- worth paying for: the copy one buyer gets is provably the copy every buyer
-- gets.
--
-- Immutability is enforced by the DATABASE, not by convention. Once a row
-- exists, its content, checksum and label cannot change — a trigger refuses
-- the update. Title, notes, price and publication state stay editable,
-- because none of them are the thing the checksum vouches for.

CREATE TABLE IF NOT EXISTS data_vintages (
  id           BIGSERIAL PRIMARY KEY,
  label        TEXT NOT NULL UNIQUE,          -- e.g. 'v2026-09'
  title        TEXT NOT NULL,
  notes        TEXT,
  snapshot     JSONB NOT NULL,                -- the frozen content itself
  manifest     JSONB NOT NULL,                -- what is inside: series, counts, assessments
  checksum     TEXT NOT NULL,                 -- sha256 over the canonical snapshot JSON
  price_ngn    NUMERIC,                       -- NULL or 0 = free download
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION forbid_vintage_content_change() RETURNS trigger AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.checksum IS DISTINCT FROM OLD.checksum
     OR NEW.label    IS DISTINCT FROM OLD.label
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A vintage is immutable: its snapshot, checksum, label and creation time cannot change. Create a new vintage instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vintage_immutable ON data_vintages;
CREATE TRIGGER trg_vintage_immutable
  BEFORE UPDATE ON data_vintages
  FOR EACH ROW EXECUTE FUNCTION forbid_vintage_content_change();

-- Orders: who asked to buy which vintage, and whether they paid. The download
-- token is issued only on a verified payment; a free vintage needs no order.
CREATE TABLE IF NOT EXISTS vintage_orders (
  id             BIGSERIAL PRIMARY KEY,
  vintage_id     BIGINT NOT NULL REFERENCES data_vintages(id) ON DELETE RESTRICT,
  reference      TEXT NOT NULL UNIQUE,        -- NEDB/VNT/yyyy/00001 — also the Paystack reference
  email          TEXT NOT NULL,
  buyer_name     TEXT,
  organisation   TEXT,
  amount_ngn     NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | invoice_requested | cancelled
  paystack_ref   TEXT,
  download_token TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vintage_orders_vintage ON vintage_orders(vintage_id);

-- Working papers: a bulletin grown into a manuscript. The body is generated
-- from the aggregates (lib/pena-analysis.ts) against a named vintage, so the
-- paper's every figure can be reproduced from the frozen snapshot it cites.
CREATE TABLE IF NOT EXISTS working_papers (
  id           BIGSERIAL PRIMARY KEY,
  paper_no     TEXT NOT NULL UNIQUE,          -- NEDB/WP/2026/01
  title        TEXT NOT NULL,
  authors      TEXT,
  vintage_id   BIGINT REFERENCES data_vintages(id),
  pena_form_id BIGINT REFERENCES pena_forms(id) ON DELETE SET NULL,
  body         JSONB NOT NULL,                -- summary, findings, caveats, tables, methods facts
  status       TEXT NOT NULL DEFAULT 'draft', -- draft | published
  published_at TIMESTAMPTZ,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on, no policies: all access is through the API with the service role,
-- which bypasses RLS. A catch-all "service role" policy would only reopen the
-- world-writable hole 047 closed (the 037 lesson).
ALTER TABLE data_vintages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vintage_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_papers ENABLE ROW LEVEL SECURITY;

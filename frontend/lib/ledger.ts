// ── lib/ledger.ts ───────────────────────────────────────────────────────────
// Tamper-evident append-only ledger for company declarations.
//
// Each entry stores the hash of the entry before it, so the entries form a
// chain. Changing any historical figure changes that entry's hash, which
// breaks every hash after it — so silent edits become detectable rather than
// merely discouraged. This is what makes the trail "immutable" in the sense
// that matters to a revenue authority: not that the row cannot be written to,
// but that a rewrite cannot be hidden.
//
// Corrections are handled the way a statistics office handles them: never by
// editing the original, always by appending a superseding entry that points at
// the one it replaces.

import { createHash } from "node:crypto";
import { db } from "@/lib/supabase-server";

export const GENESIS_HASH = "0".repeat(64);

export type DeclarationInput = {
  company_id?: number | null;
  company_name: string;
  oml_block?: string | null;
  period: string;
  period_date: string;
  kind: "production" | "sales" | "export" | "tax_paid" | "royalty_paid";
  volume?: number | null;
  volume_unit?: string | null;
  value_usd?: number | null;
  value_ngn?: number | null;
  fx_rate?: number | null;
  source?: string | null;
  notes?: string | null;
  supersedes_id?: number | null;
};

/**
 * Canonical string for hashing. Field order is fixed and values are
 * normalised, so the same declaration always hashes identically regardless of
 * how the JSON happened to be ordered on the way in.
 */
export function canonicalise(d: DeclarationInput, seq: number, prevHash: string, filedBy: string): string {
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)));
  return [
    seq,
    prevHash,
    d.company_name.trim(),
    (d.oml_block ?? "").trim(),
    d.period.trim(),
    d.period_date,
    d.kind,
    num(d.volume),
    (d.volume_unit ?? "").trim(),
    num(d.value_usd),
    num(d.value_ngn),
    num(d.fx_rate),
    (d.source ?? "").trim(),
    d.supersedes_id ?? "",
    filedBy,
  ].join("");
}

export function hashEntry(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** Head of the chain: the sequence number and hash of the most recent entry. */
export async function chainHead(): Promise<{ seq: number; hash: string }> {
  const { data } = await db()
    .from("company_declarations")
    .select("seq, row_hash")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { seq: 0, hash: GENESIS_HASH };
  return { seq: Number(data.seq), hash: String(data.row_hash) };
}

/** Append a declaration to the chain. Returns the stored row. */
export async function appendDeclaration(d: DeclarationInput, filedBy: string) {
  const head = await chainHead();
  const seq = head.seq + 1;
  const canonical = canonicalise(d, seq, head.hash, filedBy);
  const row_hash = hashEntry(canonical);

  const { data, error } = await db()
    .from("company_declarations")
    .insert({
      company_id: d.company_id ?? null,
      company_name: d.company_name.trim(),
      oml_block: d.oml_block?.trim() || null,
      period: d.period.trim(),
      period_date: d.period_date,
      kind: d.kind,
      volume: d.volume ?? null,
      volume_unit: d.volume_unit ?? null,
      value_usd: d.value_usd ?? null,
      value_ngn: d.value_ngn ?? null,
      fx_rate: d.fx_rate ?? null,
      source: d.source ?? null,
      notes: d.notes ?? null,
      seq,
      prev_hash: head.hash,
      row_hash,
      supersedes_id: d.supersedes_id ?? null,
      filed_by: filedBy,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export type ChainVerification = {
  entries: number;
  intact: boolean;
  brokenAt: number | null;
  reason: string | null;
  headHash: string;
};

/**
 * Walk the chain and confirm every entry still hashes to what it claims, and
 * that each links to the one before it. A break tells you the exact sequence
 * number where the record stopped being trustworthy.
 */
export async function verifyChain(limit = 5000): Promise<ChainVerification> {
  const { data } = await db()
    .from("company_declarations")
    .select("seq, prev_hash, row_hash, company_name, oml_block, period, period_date, kind, volume, volume_unit, value_usd, value_ngn, fx_rate, source, supersedes_id, filed_by")
    .order("seq", { ascending: true })
    .limit(limit);

  const rows = data ?? [];
  let prev = GENESIS_HASH;

  for (const r of rows) {
    if (String(r.prev_hash) !== prev) {
      return { entries: rows.length, intact: false, brokenAt: Number(r.seq), reason: "chain link does not match the previous entry", headHash: prev };
    }
    const recomputed = hashEntry(
      canonicalise(
        {
          company_name: r.company_name as string,
          oml_block: r.oml_block as string | null,
          period: r.period as string,
          period_date: String(r.period_date).slice(0, 10),
          kind: r.kind as DeclarationInput["kind"],
          volume: r.volume as number | null,
          volume_unit: r.volume_unit as string | null,
          value_usd: r.value_usd as number | null,
          value_ngn: r.value_ngn as number | null,
          fx_rate: r.fx_rate as number | null,
          source: r.source as string | null,
          supersedes_id: r.supersedes_id as number | null,
        },
        Number(r.seq),
        String(r.prev_hash),
        String(r.filed_by)
      )
    );
    if (recomputed !== String(r.row_hash)) {
      return { entries: rows.length, intact: false, brokenAt: Number(r.seq), reason: "entry contents no longer match their recorded hash", headHash: prev };
    }
    prev = String(r.row_hash);
  }

  return { entries: rows.length, intact: true, brokenAt: null, reason: null, headHash: prev };
}

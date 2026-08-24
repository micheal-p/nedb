import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireRole, requireAdmin } from "@/lib/api-helpers";
import { appendDeclaration, verifyChain, type DeclarationInput } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";

const KINDS = new Set(["production", "sales", "export", "tax_paid", "royalty_paid"]);

function periodDate(period: string): string | null {
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  const q = period.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `${q[1]}-${String((Number(q[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
  if (/^\d{4}$/.test(period)) return `${period}-01-01`;
  return null;
}

// GET /api/nrs/declarations — the filed record, newest first.
// ?verify=1 also walks the hash chain and reports its integrity.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("authentication required", 401);

  const sp = new URL(req.url).searchParams;
  let q = db()
    .from("company_declarations")
    .select("id, seq, company_name, oml_block, period, kind, volume, volume_unit, value_usd, value_ngn, fx_rate, source, supersedes_id, filed_by, filed_at, row_hash")
    .order("seq", { ascending: false })
    .limit(Math.min(500, Number(sp.get("limit") ?? 200)));

  if (sp.get("company")) q = q.eq("company_name", sp.get("company")!);
  if (sp.get("period"))  q = q.eq("period", sp.get("period")!);
  if (sp.get("kind"))    q = q.eq("kind", sp.get("kind")!);

  const { data, error } = await q;
  if (error) return err(error.message, 500);

  const payload: Record<string, unknown> = { declarations: data ?? [] };
  if (sp.get("verify") === "1") payload.chain = await verifyChain();
  return ok(payload);
}

// POST /api/nrs/declarations — file a declaration (appends to the chain).
// Editors may file; the entry is immutable once written. A correction is a new
// entry carrying supersedes_id, never an edit.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "editor");
  if (!auth) return err("editor access or above is required to file a declaration", 403);

  const body = await req.json().catch(() => null);
  if (!body?.company_name || !body?.period || !body?.kind) {
    return err("company_name, period and kind are required");
  }
  if (!KINDS.has(body.kind)) return err(`kind must be one of: ${[...KINDS].join(", ")}`);

  const pd = periodDate(String(body.period));
  if (!pd) return err("period must be YYYY-MM, YYYY-QN or YYYY");

  const hasVolume = body.volume !== undefined && body.volume !== null && body.volume !== "";
  const hasValue = [body.value_usd, body.value_ngn].some((v) => v !== undefined && v !== null && v !== "");
  if (!hasVolume && !hasValue) return err("a declaration needs a volume, an amount, or both");

  const input: DeclarationInput = {
    company_id: body.company_id ?? null,
    company_name: String(body.company_name),
    oml_block: body.oml_block ?? null,
    period: String(body.period),
    period_date: pd,
    kind: body.kind,
    volume: hasVolume ? Number(body.volume) : null,
    volume_unit: body.volume_unit ?? null,
    value_usd: body.value_usd ? Number(body.value_usd) : null,
    value_ngn: body.value_ngn ? Number(body.value_ngn) : null,
    fx_rate: body.fx_rate ? Number(body.fx_rate) : null,
    source: body.source ?? null,
    notes: body.notes ?? null,
    supersedes_id: body.supersedes_id ?? null,
  };

  try {
    const row = await appendDeclaration(input, String(auth.username ?? auth.sub ?? "unknown"));
    await logAudit({
      action: input.supersedes_id ? "DECLARATION_CORRECT" : "DECLARATION_FILE",
      performed_by: String(auth.username ?? auth.sub ?? "unknown"),
      period: input.period,
      notes: `${input.supersedes_id ? "Correction to" : "Filed"} ${input.kind} declaration for ${input.company_name}${input.oml_block ? ` (${input.oml_block})` : ""} — ledger entry #${row.seq}`,
    });
    return ok({ declaration: row, seq: row.seq, row_hash: row.row_hash }, 201);
  } catch (e) {
    return err(e instanceof Error ? e.message : "could not file the declaration", 500);
  }
}

// DELETE is deliberately unimplemented: the ledger is append-only. Removing an
// entry would break every hash after it, which is the property that makes the
// trail worth keeping.
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) return err("admin access required", 403);
  return err("Declarations cannot be deleted. File a correction that supersedes the entry instead.", 405);
}

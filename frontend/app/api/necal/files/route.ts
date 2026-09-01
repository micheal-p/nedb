import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";
import { geminiConfigured, geminiGenerate } from "@/lib/gemini";
import { buildBriefingPrompt } from "@/lib/necal-narrate";
import { usageFor } from "@/lib/necal-storage";

// The planning folder.
// GET  — your files, plus an honest usage line: bytes stored against your
//        quota (200MB free; more by request, granted by a superadmin).
// POST — save the open plan as a file: the scenario and anchor frozen at save
//        time, a timestamped default name, and, when asked, the machine-
//        drafted briefing generated once and stored WITH the file, so the
//        memo you saved is the memo you reread, not a fresh roll of the dice.

export async function GET(req: NextRequest) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  const [{ data, error }, usage] = await Promise.all([
    db().from("necal_files")
      .select("id, filename, bytes, share_token, created_at")
      .eq("owner_username", access.username)
      .order("created_at", { ascending: false })
      .limit(200),
    usageFor(access.username),
  ]);
  if (error) return err(error.message, 500);
  return ok({ files: data ?? [], usage });
}

export async function POST(req: NextRequest) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);

  const body = await req.json().catch(() => null);
  if (!body?.scenario || body.scenario.v !== 1) return err("A valid scenario payload is required.");

  const stamp = new Date();
  const defaultName = `NECAL Plan — ${String(body.scenario.name ?? "Untitled").slice(0, 60)} — ${stamp.toISOString().slice(0, 10)} ${stamp.toTimeString().slice(0, 5)}`;
  const filename = String(body.filename ?? "").trim().slice(0, 160) || defaultName;

  // The memo is generated at save time and stored with the file.
  let briefing: string | null = null;
  if (body.condensed && geminiConfigured()) {
    try { briefing = await geminiGenerate(buildBriefingPrompt(body.condensed)); } catch { briefing = null; }
  }

  const payload = { scenario: body.scenario, base: body.base ?? null, briefing };
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

  const usage = await usageFor(access.username);
  if (usage.usedBytes + bytes > usage.quotaMb * 1024 * 1024) {
    return err(
      `Your planning folder is full: ${(usage.usedBytes / 1048576).toFixed(1)}MB of ${usage.quotaMb}MB used. Request more space from the folder page — a superadmin grants allocations.`,
      507
    );
  }

  const { data, error } = await db()
    .from("necal_files")
    .insert({
      owner_username: access.username,
      filename,
      scenario: body.scenario,
      base: body.base ?? null,
      briefing,
      bytes,
    })
    .select("id, filename, bytes, created_at")
    .single();
  if (error) return err(error.message, 500);
  return ok({ ...data, briefing_included: !!briefing }, 201);
}

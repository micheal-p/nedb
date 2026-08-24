import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole, requireAdmin } from "@/lib/api-helpers";
import { sendSystemEmail } from "@/lib/mailer";
import { unsubToken } from "@/lib/monthly-report";
import { logAudit } from "@/lib/audit";

// Editorial broadcast to subscribers.
//
// Sends are chunked with a small pause between batches: the previous monthly
// send looped serially and swallowed every failure, so it reported a success
// count that included silent failures and timed out around a hundred
// recipients. Here delivery is counted honestly and the outcome is recorded in
// the broadcasts table, so a repeat send is visible rather than guessed at.

const BATCH = 8;
const PAUSE_MS = 900;

// GET /api/admin/broadcast — past sends, and who would receive a given topic set
export async function GET(req: NextRequest) {
  if (!(await requireRole(req, "editor"))) return err("editor access required", 403);

  const topics = (new URL(req.url).searchParams.get("topics") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const { data: history } = await db()
    .from("broadcasts")
    .select("id, subject, topics, recipients, delivered, failed, sent_by, sent_at")
    .order("sent_at", { ascending: false })
    .limit(25);

  const { data: subs } = await db().from("subscribers").select("email, topics").eq("is_active", true);
  const audience = (subs ?? []).filter((s) => matchesTopics(s.topics as string[] | null, topics));

  return ok({
    history: history ?? [],
    audience_size: audience.length,
    total_active: (subs ?? []).length,
  });
}

/** A subscriber with no topics wants everything; an empty filter targets everyone. */
function matchesTopics(subTopics: string[] | null, filter: string[]): boolean {
  if (!filter.length) return true;
  if (!subTopics?.length) return true;
  return filter.some((t) => subTopics.includes(t));
}

// POST /api/admin/broadcast — send. Admin only: this leaves the building.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required to send a broadcast", 403);

  const body = await req.json().catch(() => null);
  const subject = String(body?.subject ?? "").trim();
  const message = String(body?.body ?? "").trim();
  const topics: string[] = Array.isArray(body?.topics) ? body.topics : [];
  const storyId: number | null = body?.story_id ?? null;

  if (!subject) return err("A subject is required.");
  if (!message) return err("The message body is required.");

  const { data: subs } = await db()
    .from("subscribers")
    .select("email, name, topics")
    .eq("is_active", true);

  const audience = (subs ?? []).filter((s) => matchesTopics(s.topics as string[] | null, topics));
  if (!audience.length) return err("No active subscribers match those topics.");

  // Dry run lets an editor confirm the audience before anything is sent.
  if (body?.preview) {
    return ok({ preview: true, audience_size: audience.length, sample: audience.slice(0, 5).map((s) => s.email) });
  }

  const paragraphs = message
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  let delivered = 0;
  let failed = 0;

  for (let i = 0; i < audience.length; i += BATCH) {
    const chunk = audience.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map((s) =>
        sendSystemEmail({
          to: s.email as string,
          subject,
          heading: subject,
          bodyHtml: `${paragraphs}
            <p style="font-size:11px;color:#8a8a8a;line-height:1.6;margin:24px 0 0;border-top:1px solid #e5e5e5;padding-top:12px">
              You are receiving this because you subscribed to National Energy Data Bank updates.
              <a href="https://nedb.vercel.app/api/subscribe?action=unsub&amp;email=${encodeURIComponent(String(s.email))}&amp;t=${unsubToken(String(s.email))}" style="color:#0E7A3C">Unsubscribe</a>.
            </p>`,
        })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== false) delivered++;
      else failed++;
    }
    if (i + BATCH < audience.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  const { data: record } = await db()
    .from("broadcasts")
    .insert({
      subject, body: message, topics, story_id: storyId,
      recipients: audience.length, delivered, failed,
      sent_by: String(admin.username ?? admin.sub ?? "unknown"),
    })
    .select("id")
    .single();

  await logAudit({
    action: "BROADCAST_SEND",
    performed_by: String(admin.username ?? admin.sub ?? "unknown"),
    notes: `Broadcast "${subject}" — ${delivered} delivered, ${failed} failed, of ${audience.length} recipients`,
  });

  return ok({
    broadcast_id: record?.id ?? null,
    recipients: audience.length,
    delivered,
    failed,
    message: failed
      ? `Sent to ${delivered} of ${audience.length} subscribers. ${failed} could not be delivered — check the mail provider configuration.`
      : `Sent to all ${delivered} subscribers.`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

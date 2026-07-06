// ── lib/monthly-report.ts ───────────────────────────────────────────────────
// The monthly Energy Report engine, shared by the daily cron (scheduled sends)
// and the admin "Push now" action. Cycle semantics:
//   • anchor_at + 31 days = due date. The daily cron sends when due and then
//     advances the anchor by exactly 31 days — a fixed, complete timeline.
//   • A manual push sends immediately but NEVER moves the anchor, so an early
//     push does not delay or hasten the next scheduled send.
// Recipients = active staff work emails + active public subscribers (each
// subscriber email carries a signed unsubscribe link).

import { createHmac } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { computeSignal, type SignalRules } from "@/lib/signals";
import { sendSystemEmail } from "@/lib/mailer";

export const CYCLE_DAYS = 31;
const SITE = "https://nedb.vercel.app";

export function unsubToken(email: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "nedb")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

export interface CycleStatus {
  anchor_at: string;
  due_at: string;
  due: boolean;
  days_left: number;          // 0 when due
  last_sent_at: string | null;
  last_sent_via: string | null;
  last_sent_count: number | null;
}

export async function getCycleStatus(): Promise<CycleStatus | null> {
  const { data } = await db().from("report_state").select("*").eq("id", 1).single();
  if (!data) return null;
  const due_at = new Date(new Date(data.anchor_at).getTime() + CYCLE_DAYS * 86_400_000);
  const msLeft = due_at.getTime() - Date.now();
  return {
    anchor_at: data.anchor_at,
    due_at: due_at.toISOString(),
    due: msLeft <= 0,
    days_left: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    last_sent_at: data.last_sent_at,
    last_sent_via: data.last_sent_via,
    last_sent_count: data.last_sent_count,
  };
}

const LEVEL_COLOR: Record<string, string> = {
  above: "#0E7A3C", neutral: "#5C5650", warn: "#92400E", critical: "#991B1B",
};

async function buildReportHtml(): Promise<{ html: string; seriesCount: number } | null> {
  const [{ data: series }, { data: rows }] = await Promise.all([
    db().from("series_types").select("id, name, unit_default, signal_rules"),
    db().from("energy_records")
      .select("series_type_id, period, period_date, value, region")
      .order("period_date", { ascending: true })
      .limit(3000),
  ]);

  const national = (rows ?? []).filter((r) => !r.region || ["NGA", "", "national"].includes(r.region));
  const bySeries = new Map<string, { period: string; value: number | null }[]>();
  for (const r of national) {
    if (!bySeries.has(r.series_type_id)) bySeries.set(r.series_type_id, []);
    bySeries.get(r.series_type_id)!.push({ period: r.period, value: r.value === null ? null : Number(r.value) });
  }

  const lines: string[] = [];
  for (const s of series ?? []) {
    const data = bySeries.get(s.id) ?? [];
    if (!data.length) continue;
    const latest = data[data.length - 1];
    const isMonthly = /^\d{4}-\d{2}$/.test(latest.period);
    const lag = isMonthly && data.length >= 13 ? 12 : 1;
    const prev = data.length > lag ? data[data.length - 1 - lag] : null;
    const yoy = prev && prev.value ? (((latest.value ?? 0) - prev.value) / Math.abs(prev.value)) * 100 : null;
    const sig = s.signal_rules ? computeSignal(s.signal_rules as SignalRules, data) : null;
    lines.push(`
      <tr style="border-bottom:1px solid #E7E5E0">
        <td style="padding:9px 8px;font-weight:600;font-size:13px">${s.name}</td>
        <td style="padding:9px 8px;font-family:monospace;font-size:13px;text-align:right">${(latest.value ?? 0).toLocaleString()} ${s.unit_default}</td>
        <td style="padding:9px 8px;font-family:monospace;font-size:12px;color:#8E867B">${latest.period}</td>
        <td style="padding:9px 8px;font-family:monospace;font-size:13px;text-align:right;color:${yoy === null ? "#8E867B" : yoy >= 0 ? "#0E7A3C" : "#991B1B"}">${yoy === null ? "—" : (yoy >= 0 ? "+" : "") + yoy.toFixed(1) + "%"}</td>
        <td style="padding:9px 8px;font-size:11px;font-weight:700;text-transform:uppercase;color:${LEVEL_COLOR[sig?.level ?? "neutral"]}">${sig?.level ?? "—"}</td>
      </tr>`);
  }
  if (!lines.length) return null;

  const html = `
    <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 16px">
      The latest national position across all published NEDB series:
    </p>
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:2px solid #0E7A3C">
        <th style="padding:8px;text-align:left;font-size:11px;color:#8E867B;text-transform:uppercase">Series</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#8E867B;text-transform:uppercase">Latest</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:#8E867B;text-transform:uppercase">Period</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#8E867B;text-transform:uppercase">YoY</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:#8E867B;text-transform:uppercase">Signal</th>
      </tr>
      ${lines.join("")}
    </table>
    <p style="font-size:13px;margin:20px 0 0"><a href="${SITE}" style="color:#0E7A3C;font-weight:700">Explore the Data Bank →</a></p>`;
  return { html, seriesCount: lines.length };
}

export async function sendMonthlyReport(via: "scheduled" | "manual"): Promise<{ sent: number; seriesCount: number }> {
  const report = await buildReportHtml();
  if (!report) return { sent: 0, seriesCount: 0 };

  const [{ data: staff }, { data: subs }] = await Promise.all([
    db().from("staff_users").select("email").eq("is_active", true).not("email", "is", null),
    db().from("subscribers").select("email").eq("is_active", true),
  ]);

  const month = new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const subject = `NEDB Monthly Energy Report — ${month}`;
  let sent = 0;

  // Staff: work emails, no unsubscribe (platform accounts manage themselves)
  const staffEmails = [...new Set((staff ?? []).map((s) => s.email).filter(Boolean))];
  for (const to of staffEmails) {
    await sendSystemEmail({ to, subject, heading: `Monthly Energy Report · ${month}`, bodyHtml: report.html });
    sent++;
  }

  // Public subscribers: personalised unsubscribe link
  for (const s of subs ?? []) {
    const unsub = `${SITE}/api/subscribe?action=unsub&email=${encodeURIComponent(s.email)}&t=${unsubToken(s.email)}`;
    await sendSystemEmail({
      to: s.email,
      subject,
      heading: `Monthly Energy Report · ${month}`,
      bodyHtml: report.html + `
        <p style="font-size:11px;color:#8E867B;margin:20px 0 0">
          You receive this because you subscribed on the NEDB website.
          <a href="${unsub}" style="color:#8E867B">Unsubscribe</a>
        </p>`,
    });
    sent++;
  }

  // Record the send; only SCHEDULED sends advance the anchor (complete timeline)
  const patch: Record<string, unknown> = {
    last_sent_at: new Date().toISOString(),
    last_sent_via: via,
    last_sent_count: sent,
  };
  if (via === "scheduled") {
    const { data: st } = await db().from("report_state").select("anchor_at").eq("id", 1).single();
    if (st) {
      let anchor = new Date(st.anchor_at);
      const now = Date.now();
      while (anchor.getTime() + CYCLE_DAYS * 86_400_000 <= now) {
        anchor = new Date(anchor.getTime() + CYCLE_DAYS * 86_400_000);
      }
      patch.anchor_at = anchor.toISOString();
    }
  }
  await db().from("report_state").update(patch).eq("id", 1);

  return { sent, seriesCount: report.seriesCount };
}

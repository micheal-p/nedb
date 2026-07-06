import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { computeSignal, type SignalRules, type SignalLevel } from "@/lib/signals";
import { cacheGet, cacheSet } from "@/lib/redis";
import { sendSystemEmail } from "@/lib/mailer";

// GET /api/cron/signals — daily early-warning sweep.
// Recomputes every series' Current Signal; when a series TRANSITIONS into
// warn or critical, all active administrators are emailed within the hour of
// the cron. Previous levels are remembered in Redis so alerts fire once per
// transition, not every day.

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("Unauthorized", 401);
  }

  const [{ data: series }, { data: rows }, { data: admins }] = await Promise.all([
    db().from("series_types").select("id, name, unit_default, signal_rules").not("signal_rules", "is", null),
    db().from("energy_records")
      .select("series_type_id, period_date, value, region")
      .order("period_date", { ascending: true })
      .limit(3000),
    db().from("staff_users").select("email, full_name").eq("role", "admin").eq("is_active", true),
  ]);

  const national = (rows ?? []).filter((r) => !r.region || ["NGA", "", "national"].includes(r.region));
  const bySeries = new Map<string, { value: number | null }[]>();
  for (const r of national) {
    if (!bySeries.has(r.series_type_id)) bySeries.set(r.series_type_id, []);
    bySeries.get(r.series_type_id)!.push({ value: r.value === null ? null : Number(r.value) });
  }

  const alerts: { name: string; level: SignalLevel; text: string }[] = [];
  const statuses: Record<string, string> = {};

  for (const s of series ?? []) {
    const sig = computeSignal(s.signal_rules as SignalRules, bySeries.get(s.id) ?? []);
    if (!sig) { statuses[s.id] = "no data"; continue; }
    const prev = (await cacheGet<string>(`signal:${s.id}`)) ?? "unknown";
    await cacheSet(`signal:${s.id}`, sig.level, 60 * 60 * 24 * 45);
    statuses[s.id] = `${prev} → ${sig.level}`;
    const worsened = (sig.level === "warn" || sig.level === "critical") && prev !== sig.level;
    if (worsened) alerts.push({ name: s.name, level: sig.level, text: sig.text });
  }

  const recipients = (admins ?? []).map((a) => a.email).filter(Boolean);
  if (alerts.length && recipients.length) {
    const rowsHtml = alerts.map((a) => `
      <tr style="border-bottom:1px solid #E7E5E0">
        <td style="padding:10px 8px;font-weight:700;color:${a.level === "critical" ? "#991B1B" : "#92400E"};text-transform:uppercase;font-size:11px;width:80px">${a.level}</td>
        <td style="padding:10px 8px;font-weight:600;font-size:13px">${a.name}</td>
        <td style="padding:10px 8px;font-size:13px;color:#5C5650">${a.text}</td>
      </tr>`).join("");
    await sendSystemEmail({
      to: recipients,
      subject: `NEDB signal alert — ${alerts.length} series ${alerts.some((a) => a.level === "critical") ? "CRITICAL" : "warning"}`,
      heading: "Energy Signal Alert",
      bodyHtml: `
        <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 16px">
          The daily signal sweep detected ${alerts.length} series entering a warning or critical state:
        </p>
        <table style="width:100%;border-collapse:collapse">${rowsHtml}</table>
        <p style="font-size:13px;margin:20px 0 0"><a href="https://nedb.vercel.app/admin/freshness" style="color:#0E7A3C;font-weight:700">Open the Data Freshness board →</a></p>`,
    });
  }

  return ok({ ran_at: new Date().toISOString(), alerts: alerts.length, recipients: recipients.length, statuses });
}

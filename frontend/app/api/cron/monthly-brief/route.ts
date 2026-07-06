import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { computeSignal, type SignalRules } from "@/lib/signals";
import { sendSystemEmail } from "@/lib/mailer";

// GET /api/cron/monthly-brief — 1st of every month.
// Emails administrators a compact Energy Brief: latest value, YoY and signal
// state for every populated series. The platform reports to leadership by
// itself instead of waiting to be visited.

export const maxDuration = 60;

const LEVEL_COLOR: Record<string, string> = {
  above: "#0E7A3C", neutral: "#5C5650", warn: "#92400E", critical: "#991B1B",
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("Unauthorized", 401);
  }

  const [{ data: series }, { data: rows }, { data: admins }] = await Promise.all([
    db().from("series_types").select("id, name, unit_default, frequency, signal_rules"),
    db().from("energy_records")
      .select("series_type_id, period, period_date, value, region")
      .order("period_date", { ascending: true })
      .limit(3000),
    db().from("staff_users").select("email").eq("role", "admin").eq("is_active", true),
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

  const recipients = (admins ?? []).map((a) => a.email).filter(Boolean);
  const month = new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  if (recipients.length && lines.length) {
    await sendSystemEmail({
      to: recipients,
      subject: `NEDB Monthly Energy Brief — ${month}`,
      heading: `Monthly Energy Brief · ${month}`,
      bodyHtml: `
        <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 16px">
          Latest position across all populated NEDB series (national figures):
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
        <p style="font-size:13px;margin:20px 0 0"><a href="https://nedb.vercel.app/data-point/dashboard" style="color:#0E7A3C;font-weight:700">Open the Data Point dashboard →</a></p>`,
    });
  }

  return ok({ ran_at: new Date().toISOString(), series: lines.length, recipients: recipients.length });
}

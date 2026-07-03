import { Resend } from "resend";

const FROM = "NEDB Notifications <onboarding@resend.dev>";

function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendApprovalEmail(opts: {
  to: string;
  uploaderName: string;
  seriesName: string;
  committedRows: number;
  approvedBy: string;
  sessionId: number;
}) {
  const r = client(); if (!r) return;
  try {
    await r.emails.send({
      from: FROM,
      to:   opts.to,
      subject: `Upload approved — ${opts.seriesName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0A0A0A">
          <div style="background:#0E7A3C;padding:20px 24px;border-radius:8px 8px 0 0">
            <p style="color:#fff;font-size:13px;font-weight:700;margin:0;letter-spacing:0.08em;text-transform:uppercase">National Energy Data Bank · ECN</p>
          </div>
          <div style="border:1px solid #E7E5E0;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px">
            <h2 style="font-size:18px;font-weight:700;color:#0A0A0A;margin:0 0 8px">Upload Approved</h2>
            <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 20px">
              Hello ${opts.uploaderName}, your data submission has been reviewed and committed to the NEDB database.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
              <tr style="border-bottom:1px solid #E7E5E0"><td style="padding:8px 0;color:#8E867B;width:140px">Series</td><td style="padding:8px 0;font-weight:600">${opts.seriesName}</td></tr>
              <tr style="border-bottom:1px solid #E7E5E0"><td style="padding:8px 0;color:#8E867B">Records committed</td><td style="padding:8px 0;font-weight:600">${opts.committedRows.toLocaleString()}</td></tr>
              <tr style="border-bottom:1px solid #E7E5E0"><td style="padding:8px 0;color:#8E867B">Approved by</td><td style="padding:8px 0">${opts.approvedBy}</td></tr>
              <tr><td style="padding:8px 0;color:#8E867B">Session ID</td><td style="padding:8px 0;font-family:monospace">#${opts.sessionId}</td></tr>
            </table>
            <p style="font-size:12px;color:#8E867B;margin:0">This is an automated message from the National Energy Data Bank system. Do not reply to this email.</p>
          </div>
        </div>`,
    });
  } catch { /* email failure must never block the API response */ }
}

export async function sendRejectionEmail(opts: {
  to: string;
  uploaderName: string;
  seriesName: string;
  rejectedBy: string;
  sessionId: number;
}) {
  const r = client(); if (!r) return;
  try {
    await r.emails.send({
      from: FROM,
      to:   opts.to,
      subject: `Upload rejected — ${opts.seriesName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0A0A0A">
          <div style="background:#C0392B;padding:20px 24px;border-radius:8px 8px 0 0">
            <p style="color:#fff;font-size:13px;font-weight:700;margin:0;letter-spacing:0.08em;text-transform:uppercase">National Energy Data Bank · ECN</p>
          </div>
          <div style="border:1px solid #E7E5E0;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px">
            <h2 style="font-size:18px;font-weight:700;color:#0A0A0A;margin:0 0 8px">Upload Not Approved</h2>
            <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 20px">
              Hello ${opts.uploaderName}, your data submission for <strong>${opts.seriesName}</strong> was reviewed and could not be approved at this time. Please contact the NEDB administrator for details, then resubmit a corrected dataset.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
              <tr style="border-bottom:1px solid #E7E5E0"><td style="padding:8px 0;color:#8E867B;width:140px">Series</td><td style="padding:8px 0;font-weight:600">${opts.seriesName}</td></tr>
              <tr style="border-bottom:1px solid #E7E5E0"><td style="padding:8px 0;color:#8E867B">Reviewed by</td><td style="padding:8px 0">${opts.rejectedBy}</td></tr>
              <tr><td style="padding:8px 0;color:#8E867B">Session ID</td><td style="padding:8px 0;font-family:monospace">#${opts.sessionId}</td></tr>
            </table>
            <p style="font-size:12px;color:#8E867B;margin:0">This is an automated message from the National Energy Data Bank system. Do not reply to this email.</p>
          </div>
        </div>`,
    });
  } catch { /* non-fatal */ }
}

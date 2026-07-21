import { NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { resolveMx, resolve4 } from "node:dns/promises";
import { sendSystemEmail } from "@/lib/mailer";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { cacheGet, cacheSet } from "@/lib/redis";
import { computeTier, type TierConfig } from "@/lib/pena";

// Public respondent endpoints, keyed by the unguessable share token.
// GET  /api/pena/r/:token            — form definition (open forms only)
// GET  /api/pena/r/:token?preview=1  — staff-only preview, any status
// POST /api/pena/r/:token            — submit a response
//
// Identity & dedupe ("you have filled this form already"):
//   1. Google Sign-In id_token when provided — Google has already verified the
//      email, no OTP needed. Falls back to typed email + MX check otherwise.
//   2. DB-unique email per form (033).
//   3. One submission per IP per form (hash compare) — holds even if the
//      respondent signs out or switches Google accounts on the same device.
//      NOTE: Nigerian mobile carriers CGNAT thousands of users behind one IP;
//      if the field reports legit people blocked, raise MAX_PER_IP.
const MAX_PER_IP = 1;

type Question = {
  id: number; label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; analytics_key: string | null;
  config: { options?: string[]; min?: number; max?: number } | null;
};

async function loadForm(token: string) {
  const { data } = await db()
    .from("pena_forms")
    .select("id, title, description, consent_text, status, tier_config, require_verification")
    .eq("share_token", token)
    .single();
  return data;
}

// Public origin for links in emails — honour the proxy headers on Vercel
function siteOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "nedb.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function loadQuestions(formId: number) {
  const { data } = await db()
    .from("pena_questions")
    .select("id, label, slug, qtype, unit, is_required, analytics_key, config, display_order")
    .eq("form_id", formId)
    .order("display_order");
  return (data ?? []) as (Question & { display_order: number })[];
}

// Email domain must actually receive mail (MX, or at least an A record) —
// format-valid-but-fake domains are the cheapest bot signature. Verdicts are
// cached; DNS failures fail OPEN so an outage never blocks real respondents.
async function emailDomainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const cacheKey = `pena:mx:${domain}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;
  let valid: boolean;
  try {
    const mx = await resolveMx(domain);
    valid = mx.length > 0;
  } catch {
    try { valid = (await resolve4(domain)).length > 0; }
    catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOTFOUND" || code === "ENODATA") valid = false;
      else return true; // resolver outage — fail open, don't punish respondents
    }
  }
  await cacheSet(cacheKey, valid, 7 * 24 * 3600);
  return valid;
}

// Verify a Google Identity Services id_token and return its verified email.
// Uses Google's tokeninfo endpoint — fine at survey volume, no extra deps.
async function verifyGoogleToken(idToken: string): Promise<string | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const t = await res.json();
    if (t.aud !== clientId) return null;
    if (t.email_verified !== "true" && t.email_verified !== true) return null;
    return typeof t.email === "string" ? t.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await loadForm(token);
  if (!form) return err("Assessment not found", 404);

  const preview = new URL(req.url).searchParams.get("preview") === "1";
  if (preview) {
    const auth = await requireAuth(req);
    if (!auth) return err("Preview is staff-only", 403);
    return ok({
      status: "open", preview: true, title: form.title, description: form.description,
      consent_text: form.consent_text, questions: await loadQuestions(form.id),
      google_client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null,
    });
  }

  if (form.status !== "open") return ok({ status: form.status, title: form.title });
  return ok({
    status: "open", title: form.title, description: form.description,
    consent_text: form.consent_text, questions: await loadQuestions(form.id),
    google_client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null,
  });
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const rl = await checkRateLimitDurable(`pena-submit:${ip}`, 5, 3600);
  if (!rl.allowed) return err(`Too many submissions. Try again in ${Math.ceil(rl.resetIn / 60)} min.`, 429);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.answers !== "object" || !body.answers) return err("Bad request");
  if (body.website) return ok({ success: true }); // honeypot — pretend success, store nothing
  if (body.consent !== true) return err("You must accept the consent statement to submit.");

  const form = await loadForm(token);
  if (!form) return err("Assessment not found", 404);
  if (form.status !== "open") return err("This assessment is not accepting responses.", 403);

  // One per IP per form — holds across sign-in/sign-out on the same connection
  if (ip !== "anon") {
    const { count } = await db()
      .from("pena_responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", form.id)
      .eq("ip_hash", ipHash);
    if ((count ?? 0) >= MAX_PER_IP)
      return err("You have already filled this assessment from this connection.", 409);
  }

  const questions = await loadQuestions(form.id);

  // Google identity first: a valid id_token carries a Google-verified email
  let googleEmail: string | null = null;
  if (typeof body.google_token === "string" && body.google_token) {
    googleEmail = await verifyGoogleToken(body.google_token);
    if (!googleEmail) return err("Google sign-in could not be verified — please try again.");
  }

  // Validate + collect answers keyed by question slug
  const answers: Record<string, unknown> = {};
  for (const q of questions) {
    let raw = body.answers[q.slug];
    // The email question is auto-filled from Google when signed in
    if (q.qtype === "email" && googleEmail) raw = googleEmail;
    const empty = raw === undefined || raw === null ||
      (Array.isArray(raw) ? raw.length === 0 : String(raw).trim() === "");
    if (empty) {
      if (q.is_required) return err(`"${q.label}" is required.`);
      continue;
    }
    const cfg = q.config ?? {};
    if (q.qtype === "number") {
      const n = num(raw);
      if (n === null) return err(`"${q.label}" must be a number.`);
      if (typeof cfg.min === "number" && n < cfg.min) return err(`"${q.label}" must be at least ${cfg.min}.`);
      if (typeof cfg.max === "number" && n > cfg.max) return err(`"${q.label}" must be at most ${cfg.max}.`);
      answers[q.slug] = n;
    } else if (q.qtype === "rating") {
      const n = num(raw);
      if (n === null || n < 1 || n > 5 || !Number.isInteger(n)) return err(`"${q.label}" must be a rating from 1 to 5.`);
      answers[q.slug] = n;
    } else if (q.qtype === "date") {
      const s = String(raw);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) return err(`"${q.label}" must be a valid date.`);
      answers[q.slug] = s;
    } else if (q.qtype === "email") {
      const e = String(raw).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return err(`"${q.label}" must be a valid email address.`);
      // Google-verified emails skip the DNS check — Google already proved them
      if (!googleEmail && !(await emailDomainAcceptsMail(e)))
        return err(`"${q.label}": this email domain does not exist — please use a real email address.`);
      answers[q.slug] = e;
    } else if (q.qtype === "select") {
      const opts = cfg.options ?? [];
      if (opts.length && !opts.includes(String(raw))) return err(`"${q.label}": choose one of the listed options.`);
      answers[q.slug] = String(raw);
    } else if (q.qtype === "multiselect") {
      const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const opts = cfg.options ?? [];
      if (opts.length && arr.some((v) => !opts.includes(v))) return err(`"${q.label}": choose only from the listed options.`);
      answers[q.slug] = arr;
    } else if (q.qtype === "longtext") {
      answers[q.slug] = String(raw).trim().slice(0, 5000);
    } else {
      answers[q.slug] = String(raw).trim().slice(0, 2000);
    }
  }

  // Analytics extraction — keyed by analytics_key so label edits don't matter
  const byKey = (key: string) => {
    const q = questions.find((x) => x.analytics_key === key);
    return q ? answers[q.slug] : undefined;
  };
  const income        = num(byKey("income"));
  const lightHours    = num(byKey("light_hours"));
  const energyExpense = num(byKey("energy_expense"));
  const email         = googleEmail ?? ((byKey("email") as string) ?? null);

  // Geography: the LGA picker sends the picked lgas.id alongside the answers
  const lgaId = num(body.lga_id);
  let lga: { id: number; name: string; state_code: string; state_name: string } | null = null;
  if (lgaId) {
    const { data } = await db().from("lgas").select("id, name, state_code, state_name").eq("id", lgaId).single();
    lga = data;
  }
  const stateQ = questions.find((q) => q.qtype === "state_ref");
  const stateName = lga?.state_name ?? (stateQ ? (answers[stateQ.slug] as string) ?? null : null);

  const addrQ = questions.find((q) => q.qtype === "address");
  const addressText = addrQ ? ((answers[addrQ.slug] as string) ?? null) : null;

  // Coordinates: respondent picked a geocode suggestion → client sends lat/lng.
  // Otherwise best-effort server geocode; never block the submission on it.
  let lat = num(body.lat), lng = num(body.lng);
  let geocodeSource: string | null = lat != null && lng != null ? "respondent" : null;
  if (lat == null && addressText) {
    try {
      const q = `${addressText}, ${lga?.name ?? ""}, ${stateName ?? ""}, Nigeria`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ng&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "NEDB/1.0 (Nigeria Energy Data Bank; energy assessment geocoding)" }, signal: AbortSignal.timeout(3000) }
      );
      const hits = res.ok ? await res.json() : [];
      if (hits[0]) { lat = num(hits[0].lat); lng = num(hits[0].lon); geocodeSource = "server"; }
    } catch { /* enhancement only */ }
  }

  // Magic-link verification: pending unless Google already proved the inbox.
  // No email answer → nothing to verify against, so it counts directly.
  const needsLink = !!form.require_verification && !!email && !googleEmail;
  const verifyToken = needsLink ? randomBytes(24).toString("hex") : null;

  const { error } = await db().from("pena_responses").insert({
    form_id: form.id,
    verify_status: needsLink ? "pending" : "verified",
    verify_token: verifyToken,
    verified_at: needsLink ? null : new Date().toISOString(),
    answers,
    state_code: lga?.state_code ?? null,
    state_name: stateName,
    lga_id: lga?.id ?? null,
    lga_name: lga?.name ?? null,
    email,
    email_source: email ? (googleEmail ? "google" : "typed") : null,
    address_text: addressText,
    lat, lng,
    geocode_source: geocodeSource,
    income,
    light_hours: lightHours,
    energy_expense: energyExpense,
    tier: computeTier(income, lightHours, energyExpense, form.tier_config as Partial<TierConfig> | null),
    ip_hash: ipHash,
  });

  if (error) {
    if (error.code === "23505") return err("You have already filled this assessment with this email address.", 409);
    return err("Failed to submit. Please try again.");
  }

  if (needsLink && verifyToken) {
    const link = `${siteOrigin(req)}/v/${verifyToken}`;
    await sendSystemEmail({
      to: email!,
      subject: `Confirm your response — ${form.title}`,
      heading: "Confirm your assessment response",
      bodyHtml: `
        <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 20px">
          You (or someone using this email address) just submitted a response to
          <strong>${form.title}</strong> on the Nigeria Energy Data Bank. Tap the button
          below to confirm it was you — this link works once and expires in 48 hours.
        </p>
        <p style="margin:0 0 24px">
          <a href="${link}" style="display:inline-block;background:#0E7A3C;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px">Confirm my response</a>
        </p>
        <p style="font-size:12px;color:#8E867B;line-height:1.6;margin:0">
          If you did not fill this assessment, ignore this email — the unconfirmed
          response will not be counted and will expire automatically.
        </p>`,
    });
    return ok({
      success: true,
      pending: true,
      message: "Response recorded — now check your email and tap the confirmation link to verify it. Unverified responses expire after 48 hours.",
    });
  }

  return ok({ success: true, message: "Response recorded. Thank you for contributing to Nigeria's energy planning." });
}

import { NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { resolveMx, resolve4 } from "node:dns/promises";
import { sendSystemEmail } from "@/lib/mailer";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireRole } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { searchPlacesNG } from "@/lib/geocode";
import { computeTier, VERIFY_TTL_HOURS, type TierConfig } from "@/lib/pena";
import { normStateKey } from "@/lib/nbs-benchmarks";

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
//      The enumerator exemption below is editor-and-above only: it waives the
//      duplicate cap AND the email confirmation, so a bare viewer account
//      holding it meant any login could push auto-verified rows into the
//      published statistics.
//      NOTE: Nigerian mobile carriers CGNAT thousands of users behind one IP,
//      so a hard 1-per-IP silently locks out neighbours on the same carrier —
//      3 tolerates shared networks while still stopping bulk stuffing (the
//      email and device locks continue to block genuine double-fills).
const MAX_PER_IP = 3;

type Question = {
  id: number; label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; analytics_key: string | null;
  config: { options?: string[]; min?: number; max?: number } | null;
};

async function loadForm(token: string) {
  const { data } = await db()
    .from("pena_forms")
    .select("id, title, description, consent_text, status, tier_config, require_verification, slug")
    .eq("share_token", token)
    .single();
  return data;
}

// Public origin for links in emails. Configured first: a confirmation link
// built from request headers is a link an attacker can aim, and it would go
// out over NEDB's own mail. The header path stays as a fallback so a
// deployment without the variable still sends a working link.
function siteOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "nedb.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Anything interpolated into an email body is escaped. The assessment title is
// admin-authored rather than public, so this is a seatbelt, not a fix for a
// live hole.
const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Nigeria's bounding box, padded for offshore and border points. A coordinate
// outside it is not a Nigerian household: it is a typo, a stale pin, or a
// script. Drop the pin rather than refuse the response — the answers are worth
// having without a map location.
const NG_BOUNDS = { latMin: 3.5, latMax: 14.5, lngMin: 2.0, lngMax: 15.5 };
const inNigeria = (la: number | null, ln: number | null): boolean =>
  la != null && ln != null && isFinite(la) && isFinite(ln) &&
  la >= NG_BOUNDS.latMin && la <= NG_BOUNDS.latMax &&
  ln >= NG_BOUNDS.lngMin && ln <= NG_BOUNDS.lngMax;

// State names are grouped on verbatim string equality by every aggregate in
// the module, so "Lagos", "lagos" and "Lagos State" would report as three
// states. Fold a submitted name onto the spelling the lgas table uses, and
// refuse one that matches no state at all. Cached in module scope: the list
// changes when Nigeria creates a state.
let statesCache: { names: string[]; at: number } | null = null;
async function canonicalState(typed: string): Promise<string | null> {
  if (!statesCache || Date.now() - statesCache.at > 3_600_000) {
    const { data } = await db().from("lgas").select("state_name");
    const names = [...new Set((data ?? []).map((r) => r.state_name as string).filter(Boolean))];
    if (names.length) statesCache = { names, at: Date.now() };
  }
  const names = statesCache?.names ?? [];
  if (!names.length) return typed;   // lookup unavailable: never block a real respondent
  const key = normStateKey(typed);
  return names.find((n) => normStateKey(n) === key) ?? null;
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

  // Enumerator mode: a signed-in staff member collects many responses door to
  // door on one phone and one connection. Their submissions are attributed
  // (collected_by) and get a wider rate limit; the per-IP duplicate cap does
  // not apply to them. Anonymous respondents keep the strict limits.
  const enumerator = await requireRole(req, "editor");
  const rl = enumerator
    ? await checkRateLimitDurable(`pena-submit-enum:${enumerator.username ?? enumerator.sub}`, 100, 3600)
    : await checkRateLimitDurable(`pena-submit:${ip}`, 5, 3600);
  if (!rl.allowed) return err(`Too many submissions. Try again in ${Math.ceil(rl.resetIn / 60)} min.`, 429);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.answers !== "object" || !body.answers) return err("Bad request");
  if (body.website) return ok({ success: true }); // honeypot — pretend success, store nothing
  if (body.consent !== true) return err("You must accept the consent statement to submit.");

  const form = await loadForm(token);
  if (!form) return err("Assessment not found", 404);
  if (form.status !== "open") return err("This assessment is not accepting responses.", 403);

  // One per IP per form — holds across sign-in/sign-out on the same connection.
  // Expired pending rows don't count: their owners were told to fill again.
  const expiryCutoff = new Date(Date.now() - VERIFY_TTL_HOURS * 3_600_000).toISOString();
  if (ip !== "anon" && !enumerator) {
    const { count } = await db()
      .from("pena_responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", form.id)
      .eq("ip_hash", ipHash)
      .or(`verify_status.eq.verified,created_at.gte.${expiryCutoff}`);
    if ((count ?? 0) >= MAX_PER_IP)
      return err("You have already filled this assessment from this connection.", 409);
  }

  const questions = await loadQuestions(form.id);

  // Google identity first: a valid id_token carries a Google-verified email.
  // A stale/unverifiable token (id_tokens expire in ~1h — normal for
  // offline-queued submissions) falls back to the typed-email path instead of
  // rejecting: the answers carry the same address, it just loses the
  // "google-verified" mark.
  let googleEmail: string | null = null;
  if (typeof body.google_token === "string" && body.google_token) {
    googleEmail = await verifyGoogleToken(body.google_token);
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
  let stateName = lga?.state_name ?? null;
  if (!stateName && stateQ) {
    const typed = (answers[stateQ.slug] as string) ?? null;
    if (typed) {
      stateName = await canonicalState(typed);
      if (!stateName) return err(`"${stateQ.label}": choose a Nigerian state from the list.`);
    }
  }

  const addrQ = questions.find((q) => q.qtype === "address");
  const addressText = addrQ ? ((answers[addrQ.slug] as string) ?? null) : null;

  // Coordinates: respondent picked a geocode suggestion → client sends lat/lng.
  // Otherwise best-effort server geocode; never block the submission on it.
  let lat = num(body.lat), lng = num(body.lng);
  if (!inNigeria(lat, lng)) { lat = null; lng = null; }
  let geocodeSource: string | null = lat != null && lng != null ? "respondent" : null;
  if (lat == null && addressText) {
    const hits = await searchPlacesNG(`${addressText}, ${lga?.name ?? ""}, ${stateName ?? ""}, Nigeria`, 1);
    if (hits[0] && inNigeria(hits[0].lat, hits[0].lng)) {
      lat = hits[0].lat; lng = hits[0].lng; geocodeSource = "server";
    }
  }

  // An expired pending row must not hold the respondent's email hostage —
  // they were told the unconfirmed response would not count and to try again.
  if (email) {
    await db()
      .from("pena_responses")
      .delete()
      .eq("form_id", form.id)
      .eq("verify_status", "pending")
      .eq("email", email)
      .lt("created_at", expiryCutoff);
  }

  // Magic-link verification: pending unless Google already proved the inbox.
  // No email answer → nothing to verify against, so it counts directly.
  // Enumerator-collected responses are trusted on the enumerator's identity —
  // households in the field cannot be expected to confirm an email link.
  const needsLink = !!form.require_verification && !!email && !googleEmail && !enumerator;
  const verifyToken = needsLink ? randomBytes(24).toString("hex") : null;

  const row: Record<string, unknown> = {
    form_id: form.id,
    verify_status: needsLink ? "pending" : "verified",
    verify_token: verifyToken,
    verified_at: needsLink ? null : new Date().toISOString(),
    answers,
    // The wording this respondent actually agreed to. consent_text on the form
    // is editable at any time, so a timestamp alone cannot show what was
    // consented to — which is the one thing NDPA 2023 asks the controller to
    // be able to show.
    consent_text: form.consent_text,
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
    // Key only present for enumerator submissions so public submissions keep
    // working even before migration 041 adds the column.
    ...(enumerator ? { collected_by: String(enumerator.username ?? enumerator.sub) } : {}),
  };

  let { error } = await db().from("pena_responses").insert(row);

  // A push deploys before the migration can be run by hand, and a submit path
  // that inserts a column the database does not have yet would take public
  // collection down in the window between the two. Drop the consent snapshot
  // and take the response, loudly, rather than lose it. PostgREST answers with
  // PGRST204 from its schema cache before Postgres ever sees the statement;
  // 42703 is the raw undefined_column it would raise otherwise. Remove this
  // fallback once 057 is applied everywhere.
  if ((error?.code === "PGRST204" || error?.code === "42703") && "consent_text" in row) {
    console.warn("pena: consent_text column missing — run migration 057. Response stored without its consent snapshot.");
    delete row.consent_text;
    ({ error } = await db().from("pena_responses").insert(row));
  }

  if (error) {
    if (error.code === "23505") return err("You have already filled this assessment with this email address.", 409);
    return err("Failed to submit. Please try again.");
  }

  if (needsLink && verifyToken) {
    const link = `${siteOrigin(req)}/v/${verifyToken}`;
    await sendSystemEmail({
      to: email!,
      subject: `Confirm your response — ${form.title}`,   // plain text, not HTML
      heading: "Confirm your assessment response",
      bodyHtml: `
        <p style="font-size:14px;color:#5C5650;line-height:1.6;margin:0 0 20px">
          You (or someone using this email address) just submitted a response to
          <strong>${escapeHtml(form.title)}</strong> on the Nigeria Energy Data Bank. Tap the button
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

  // This response counted immediately, so the published aggregates are already
  // out of date. The magic-link path busts the same key on confirmation.
  if (form.slug) await cacheDel(`pena:pub:${form.slug}`);
  return ok({ success: true, message: "Response recorded. Thank you for contributing to Nigeria's energy planning." });
}

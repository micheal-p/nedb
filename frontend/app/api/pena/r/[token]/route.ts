import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { resolveMx, resolve4 } from "node:dns/promises";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { cacheGet, cacheSet } from "@/lib/redis";
import { computeTier } from "@/lib/pena";

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

// Public respondent endpoints, keyed by the unguessable share token.
// GET  /api/pena/r/:token — form definition (open forms only, no admin fields)
// POST /api/pena/r/:token — submit a response

type Question = {
  id: number; label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; analytics_key: string | null;
  config: Record<string, unknown> | null; display_order: number;
};

async function loadForm(token: string) {
  const { data } = await db()
    .from("pena_forms")
    .select("id, title, description, consent_text, status")
    .eq("share_token", token)
    .single();
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await loadForm(token);
  if (!form) return err("Assessment not found", 404);
  if (form.status !== "open") return ok({ status: form.status, title: form.title });

  const { data: questions } = await db()
    .from("pena_questions")
    .select("id, label, slug, qtype, unit, is_required, analytics_key, config, display_order")
    .eq("form_id", form.id)
    .order("display_order");

  return ok({
    status: "open",
    title: form.title,
    description: form.description,
    consent_text: form.consent_text,
    questions: questions ?? [],
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
  const rl = await checkRateLimitDurable(`pena-submit:${ip}`, 5, 3600);
  if (!rl.allowed) return err(`Too many submissions. Try again in ${Math.ceil(rl.resetIn / 60)} min.`, 429);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.answers !== "object" || !body.answers) return err("Bad request");
  if (body.website) return ok({ success: true }); // honeypot — pretend success, store nothing
  if (body.consent !== true) return err("You must accept the consent statement to submit.");

  const form = await loadForm(token);
  if (!form) return err("Assessment not found", 404);
  if (form.status !== "open") return err("This assessment is not accepting responses.", 403);

  const { data: qs } = await db()
    .from("pena_questions")
    .select("id, label, slug, qtype, is_required, analytics_key, config")
    .eq("form_id", form.id);
  const questions = (qs ?? []) as Question[];

  // Validate + collect answers keyed by question slug
  const answers: Record<string, unknown> = {};
  for (const q of questions) {
    const raw = body.answers[q.slug];
    const empty = raw === undefined || raw === null || String(raw).trim() === "";
    if (empty) {
      if (q.is_required) return err(`"${q.label}" is required.`);
      continue;
    }
    if (q.qtype === "number") {
      const n = num(raw);
      if (n === null) return err(`"${q.label}" must be a number.`);
      const cfg = q.config ?? {};
      if (typeof cfg.min === "number" && n < cfg.min) return err(`"${q.label}" must be at least ${cfg.min}.`);
      if (typeof cfg.max === "number" && n > cfg.max) return err(`"${q.label}" must be at most ${cfg.max}.`);
      answers[q.slug] = n;
    } else if (q.qtype === "email") {
      const e = String(raw).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return err(`"${q.label}" must be a valid email address.`);
      if (!(await emailDomainAcceptsMail(e))) return err(`"${q.label}": this email domain does not exist — please use a real email address.`);
      answers[q.slug] = e;
    } else if (q.qtype === "select") {
      const opts = (q.config?.options as string[]) ?? [];
      if (opts.length && !opts.includes(String(raw))) return err(`"${q.label}": choose one of the listed options.`);
      answers[q.slug] = String(raw);
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
  const email         = (byKey("email") as string) ?? null;

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

  const { error } = await db().from("pena_responses").insert({
    form_id: form.id,
    answers,
    state_code: lga?.state_code ?? null,
    state_name: stateName,
    lga_id: lga?.id ?? null,
    lga_name: lga?.name ?? null,
    email,
    address_text: addressText,
    lat, lng,
    geocode_source: geocodeSource,
    income,
    light_hours: lightHours,
    energy_expense: energyExpense,
    tier: computeTier(income, lightHours, energyExpense),
    ip_hash: createHash("sha256").update(ip).digest("hex"),
  });

  if (error) {
    if (error.code === "23505") return err("A response with this email address has already been submitted.", 409);
    return err("Failed to submit. Please try again.");
  }
  return ok({ success: true, message: "Response recorded. Thank you for contributing to Nigeria's energy planning." });
}

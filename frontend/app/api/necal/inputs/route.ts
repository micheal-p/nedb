import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";

// GET /api/necal/inputs — the planning model's data anchor.
//
// The model needs a starting position: generation, capacity, the fuel mix,
// consumption, fiscal receipts. Some of that NEDB holds and some it does not.
// This route reports BOTH — every input the model wants, whether the data bank
// can supply it, and where the number came from. A planning tool that silently
// substitutes an assumption for a measurement is worse than one that admits the
// gap, because nobody can tell which figures were real.
//
// Two distinctions this route is careful about:
//   • "not held" and "could not be read" are different answers. A database
//     outage must never be reported as an authoritative statement of holdings.
//   • a partial year is not an annual total. Summing three committed months and
//     calling it a year understates everything downstream by a factor of four.

type InputStatus = "measured" | "derived" | "missing" | "unavailable";

type Input = {
  id: string;
  label: string;
  status: InputStatus;
  value: number | null;
  unit: string;
  period: string | null;
  series_id: string | null;
  note: string;
};

const NATIONAL = ["NGA", "", "national"];
const isNational = (region: unknown) => !region || NATIONAL.includes(String(region));

/** Expected records in a full year, by frequency. */
function expectedForYear(frequency: string): number {
  if (frequency === "monthly") return 12;
  if (frequency === "quarterly") return 4;
  return 1;
}

type YearTotal = {
  total: number; period: string; count: number; expected: number;
  complete: boolean;
  /** More records than the frequency allows, so the sum is probably double counting. */
  overcounted: boolean;
};

/**
 * Annual national total for a series, taken from the most recent year that has
 * NATIONAL records — not the most recent year that has any record. A single
 * state-level row in a later year used to hide a complete national year behind
 * it and report the series as "not held".
 */
async function nationalYearTotal(seriesId: string, frequency: string): Promise<YearTotal | null | "error"> {
  const { data, error } = await db()
    .from("energy_records")
    .select("value, period_date, region")
    .eq("series_type_id", seriesId)
    .order("period_date", { ascending: false })
    .limit(600);
  if (error) return "error";

  const national = (data ?? []).filter((r) => isNational(r.region));
  if (!national.length) return null;

  const byYear = new Map<number, number[]>();
  for (const r of national) {
    const y = new Date(String(r.period_date)).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(Number(r.value ?? 0));
  }

  const expected = expectedForYear(frequency);
  const years = [...byYear.keys()].sort((a, b) => b - a);

  // Prefer the most recent COMPLETE year; fall back to the most recent partial
  // one but mark it, because an incomplete year understates the anchor.
  const complete = years.find((y) => (byYear.get(y)?.length ?? 0) >= expected);
  const chosen = complete ?? years[0];
  const values = byYear.get(chosen)!;

  return {
    total: values.reduce((a, b) => a + b, 0),
    period: String(chosen),
    count: values.length,
    expected,
    complete: values.length >= expected,
    overcounted: values.length > expected,
  };
}

/** Latest national value — for stock measures like installed capacity. */
async function nationalLatest(seriesId: string): Promise<{ value: number; period: string } | null | "error"> {
  const { data, error } = await db()
    .from("energy_records")
    .select("value, period, period_date, region")
    .eq("series_type_id", seriesId)
    .order("period_date", { ascending: false })
    .limit(400);
  if (error) return "error";

  const national = (data ?? []).find((r) => isNational(r.region));
  if (!national) return null;
  return { value: Number(national.value ?? 0), period: String(national.period) };
}

/** Frequencies, so completeness can be judged per series. */
async function frequencies(): Promise<Record<string, string> | "error"> {
  const { data, error } = await db().from("series_types").select("id, frequency");
  if (error) return "error";
  return Object.fromEntries((data ?? []).map((s) => [String(s.id), String(s.frequency ?? "annual")]));
}

function flowInput(
  id: string, label: string, unit: string, seriesId: string,
  result: YearTotal | null | "error", missingNote: string
): Input {
  if (result === "error") {
    return { id, label, status: "unavailable", value: null, unit, period: null, series_id: seriesId,
      note: "The data bank could not be read for this input. This is a read failure, not a statement that NEDB does not hold it." };
  }
  if (!result) {
    return { id, label, status: "missing", value: null, unit, period: null, series_id: seriesId, note: missingNote };
  }
  const note = result.overcounted
    ? `Sum of ${result.count} committed national records for ${result.period}, where a ${result.expected === 1 ? "year" : "complete year"} should hold ${result.expected}. The extra records are being added together, so this total is probably double counting. Check the series for duplicates before relying on it.`
    : result.complete
      ? `Sum of ${result.count} committed national records for ${result.period}, a complete year.`
      : `Sum of ${result.count} of an expected ${result.expected} committed national records for ${result.period}. This year is INCOMPLETE, so the annual total is understated and every figure derived from it is understated with it.`;

  return { id, label, status: "measured", value: result.total, unit, period: result.period, series_id: seriesId, note };
}

export async function GET(req: NextRequest) {
  // Enforced server-side on the signed profile claim. The client gate explains
  // a refusal; it does not make the decision.
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);

  const freq = await frequencies();
  if (freq === "error") return err("The series registry could not be read. No inputs can be reported.", 503);
  const f = (id: string) => freq[id] ?? "annual";

  const [gen, sent, cons, ren, gas, wood, faac] = await Promise.all([
    nationalYearTotal("electricity_generation", f("electricity_generation")),
    nationalYearTotal("electricity_sent_out", f("electricity_sent_out")),
    nationalYearTotal("electricity_consumption", f("electricity_consumption")),
    nationalLatest("renewable_energy"),
    nationalYearTotal("natural_gas_production", f("natural_gas_production")),
    nationalYearTotal("fuelwood_consumption", f("fuelwood_consumption")),
    nationalYearTotal("faac_oil_revenue", f("faac_oil_revenue")),
  ]);

  const inputs: Input[] = [];

  inputs.push(flowInput("generation", "Electricity generation", "GWh", "electricity_generation", gen,
    "No committed national records. The plan cannot be anchored on Nigeria's real position until this series is filled."));
  inputs.push(flowInput("sent_out", "Electricity sent out", "GWh", "electricity_sent_out", sent,
    "Not held. Transmission and distribution losses must be assumed rather than measured."));
  inputs.push(flowInput("consumption", "Electricity consumption", "GWh", "electricity_consumption", cons,
    "Not held. Final demand is derived from generation less assumed losses."));

  // ── Losses: only derivable when both sides describe the SAME year ────────
  // Comparing a 2024 generation total against a 2019 sent-out total produces a
  // nonsense loss rate — and where the newer year is partial, a negative one
  // that would invert the energy balance downstream.
  if (gen === "error" || sent === "error") {
    inputs.push({ id: "td_loss", label: "Transmission and distribution losses", status: "unavailable",
      value: null, unit: "%", period: null, series_id: null,
      note: "Cannot be derived because one of its inputs could not be read." });
  } else if (gen && sent && gen.period === sent.period && gen.complete && sent.complete
             && !gen.overcounted && !sent.overcounted && gen.total > 0) {
    const lossPct = ((gen.total - sent.total) / gen.total) * 100;
    if (lossPct >= 0 && lossPct < 100) {
      inputs.push({
        id: "td_loss", label: "Transmission and distribution losses", status: "derived",
        value: Number(lossPct.toFixed(1)), unit: "%", period: gen.period, series_id: null,
        note: `Derived: generation less energy sent out, both complete years for ${gen.period}. Not a separately reported figure.`,
      });
    } else {
      inputs.push({
        id: "td_loss", label: "Transmission and distribution losses", status: "missing",
        value: null, unit: "%", period: null, series_id: null,
        note: `Generation and energy sent out for ${gen.period} imply a loss rate of ${lossPct.toFixed(1)}%, which is not physically sensible. One of the two series is wrong; the model uses your assumption instead.`,
      });
    }
  } else {
    const why = !gen || !sent
      ? "both generation and energy sent out are needed, and one is not held"
      : gen.period !== sent.period
        ? `the latest complete year differs between the two series (${gen.period} against ${sent.period})`
        : gen.overcounted || sent.overcounted
          ? "one of the two years holds more records than a year should, so its total cannot be trusted"
          : "one of the two years is incomplete";
    inputs.push({
      id: "td_loss", label: "Transmission and distribution losses", status: "missing",
      value: null, unit: "%", period: null, series_id: null,
      note: `Cannot be derived: ${why}. The model uses your assumption instead.`,
    });
  }

  inputs.push(
    ren === "error"
      ? { id: "renewable_capacity", label: "Renewable capacity installed", status: "unavailable", value: null, unit: "MW", period: null, series_id: "renewable_energy", note: "The data bank could not be read for this input." }
      : ren
        ? { id: "renewable_capacity", label: "Renewable capacity installed", status: "measured", value: ren.value, unit: "MW", period: ren.period, series_id: "renewable_energy", note: `Latest committed national record, ${ren.period}. Reported for context; the plan's base-year mix is an assumption, not this figure.` }
        : { id: "renewable_capacity", label: "Renewable capacity installed", status: "missing", value: null, unit: "MW", period: null, series_id: "renewable_energy", note: "Not held. The base-year fuel mix is assumed rather than measured." }
  );

  inputs.push(flowInput("gas_production", "Natural gas production", "Bcf", "natural_gas_production", gas,
    "Not held. Gas-led pathways cannot be checked against domestic supply."));
  inputs.push(flowInput("fuelwood", "Fuelwood consumption", "M m³", "fuelwood_consumption", wood,
    "Not held. Household biomass displacement cannot be quantified."));
  inputs.push(flowInput("faac_revenue", "FAAC oil revenue", "₦ Billion", "faac_oil_revenue", faac,
    "Not held. Fiscal exposure to the transition cannot be sized from NEDB data."));

  // ── Things NEDB does not hold at all, named rather than hidden ──────────
  inputs.push(
    { id: "population", label: "Population", status: "missing", value: null, unit: "million", period: null, series_id: null,
      note: "Not an NEDB series. Supplied by you from NBS or UN projections; the model states the value it used." },
    { id: "gdp_growth", label: "Real GDP growth", status: "missing", value: null, unit: "%/yr", period: null, series_id: null,
      note: "Not an NEDB series. Supplied by you from NBS or IMF projections." },
    { id: "access_rate", label: "Electricity access rate", status: "missing", value: null, unit: "%", period: null, series_id: null,
      note: "Not an NEDB series. PENA assessments measure supply hours for respondents, which is not the same as a national access rate." },
  );

  const count = (s: InputStatus) => inputs.filter((i) => i.status === s).length;
  const genOk = gen !== "error" && !!gen;

  return ok({
    inputs,
    summary: {
      total: inputs.length,
      measured: count("measured"),
      derived: count("derived"),
      missing: count("missing"),
      unavailable: count("unavailable"),
      anchored: genOk,
      /** True when the anchor year is complete — a partial year understates everything. */
      anchorComplete: genOk && (gen as YearTotal).complete,
      /** True when the anchor year holds more records than it should — likely double counted. */
      anchorOvercounted: genOk && (gen as YearTotal).overcounted,
      readFailure: inputs.some((i) => i.status === "unavailable"),
    },
  });
}

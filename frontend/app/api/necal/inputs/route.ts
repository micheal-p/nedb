import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

// GET /api/necal/inputs — the planning model's data anchor.
//
// The model needs a starting position: generation, capacity, the fuel mix,
// consumption, fiscal receipts. Some of that NEDB holds and some it does not.
// This route reports BOTH — every input the model wants, whether the data bank
// can supply it, and where the number came from. A planning tool that silently
// substitutes an assumption for a measurement is worse than one that admits
// the gap, because nobody can tell which figures were real.

type InputStatus = "measured" | "derived" | "missing";

type Input = {
  id: string;
  label: string;
  status: InputStatus;
  value: number | null;
  unit: string;
  period: string | null;
  series_id: string | null;
  /** Why it is missing, or how it was derived. Shown verbatim in the UI. */
  note: string;
};

/** Sum a series across its most recent year with records. */
async function latestYearTotal(seriesId: string): Promise<{ total: number; period: string; count: number } | null> {
  const { data: newest } = await db()
    .from("energy_records")
    .select("period_date")
    .eq("series_type_id", seriesId)
    .order("period_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!newest) return null;

  const year = new Date(String(newest.period_date)).getFullYear();
  const { data: rows } = await db()
    .from("energy_records")
    .select("value, region")
    .eq("series_type_id", seriesId)
    .gte("period_date", `${year}-01-01`)
    .lte("period_date", `${year}-12-31`);

  const national = (rows ?? []).filter((r) => !r.region || ["NGA", "", "national"].includes(String(r.region)));
  if (!national.length) return null;
  return {
    total: national.reduce((a, r) => a + Number(r.value ?? 0), 0),
    period: String(year),
    count: national.length,
  };
}

/** Latest single value — for stock measures like installed capacity. */
async function latestValue(seriesId: string): Promise<{ value: number; period: string } | null> {
  const { data } = await db()
    .from("energy_records")
    .select("value, period, region")
    .eq("series_type_id", seriesId)
    .order("period_date", { ascending: false })
    .limit(12);
  const national = (data ?? []).filter((r) => !r.region || ["NGA", "", "national"].includes(String(r.region)));
  if (!national.length) return null;
  return { value: Number(national[0].value ?? 0), period: String(national[0].period) };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("authentication required", 401);

  const inputs: Input[] = [];

  // ── Electricity generation: the anchor for the whole demand chain ────────
  const gen = await latestYearTotal("electricity_generation");
  inputs.push(gen
    ? { id: "generation", label: "Electricity generation", status: "measured", value: gen.total, unit: "GWh", period: gen.period, series_id: "electricity_generation", note: `Sum of ${gen.count} committed national records for ${gen.period}.` }
    : { id: "generation", label: "Electricity generation", status: "missing", value: null, unit: "GWh", period: null, series_id: "electricity_generation", note: "No committed national records. The plan cannot be anchored on Nigeria's real position until this series is filled." });

  // ── Energy delivered to consumers ───────────────────────────────────────
  const sent = await latestYearTotal("electricity_sent_out");
  inputs.push(sent
    ? { id: "sent_out", label: "Electricity sent out", status: "measured", value: sent.total, unit: "GWh", period: sent.period, series_id: "electricity_sent_out", note: `Sum of ${sent.count} committed national records for ${sent.period}.` }
    : { id: "sent_out", label: "Electricity sent out", status: "missing", value: null, unit: "GWh", period: null, series_id: "electricity_sent_out", note: "Not held. Transmission and distribution losses must be assumed rather than measured." });

  const cons = await latestYearTotal("electricity_consumption");
  inputs.push(cons
    ? { id: "consumption", label: "Electricity consumption", status: "measured", value: cons.total, unit: "GWh", period: cons.period, series_id: "electricity_consumption", note: `Sum of ${cons.count} committed national records for ${cons.period}.` }
    : { id: "consumption", label: "Electricity consumption", status: "missing", value: null, unit: "GWh", period: null, series_id: "electricity_consumption", note: "Not held. Final demand is derived from generation less assumed losses." });

  // ── Losses: measured where both ends exist, assumed otherwise ────────────
  if (gen && sent && gen.total > 0) {
    const lossPct = ((gen.total - sent.total) / gen.total) * 100;
    inputs.push({
      id: "td_loss", label: "Transmission and distribution losses", status: "derived",
      value: Number(lossPct.toFixed(1)), unit: "%", period: gen.period, series_id: null,
      note: `Derived: generation less energy sent out, for ${gen.period}. Not a separately reported figure.`,
    });
  } else {
    inputs.push({
      id: "td_loss", label: "Transmission and distribution losses", status: "missing",
      value: null, unit: "%", period: null, series_id: null,
      note: "Cannot be derived without both generation and energy sent out. The model uses your assumption instead.",
    });
  }

  // ── Renewable capacity ──────────────────────────────────────────────────
  const ren = await latestValue("renewable_energy");
  inputs.push(ren
    ? { id: "renewable_capacity", label: "Renewable capacity installed", status: "measured", value: ren.value, unit: "MW", period: ren.period, series_id: "renewable_energy", note: `Latest committed national record, ${ren.period}.` }
    : { id: "renewable_capacity", label: "Renewable capacity installed", status: "missing", value: null, unit: "MW", period: null, series_id: "renewable_energy", note: "Not held. The base-year fuel mix is assumed rather than measured." });

  // ── Gas: the transition fuel the pathways lean on ────────────────────────
  const gas = await latestYearTotal("natural_gas_production");
  inputs.push(gas
    ? { id: "gas_production", label: "Natural gas production", status: "measured", value: gas.total, unit: "Bcf", period: gas.period, series_id: "natural_gas_production", note: `Sum of ${gas.count} committed national records for ${gas.period}.` }
    : { id: "gas_production", label: "Natural gas production", status: "missing", value: null, unit: "Bcf", period: null, series_id: "natural_gas_production", note: "Not held. Gas-led pathways cannot be checked against domestic supply." });

  // ── Biomass: what clean cooking has to displace ─────────────────────────
  const wood = await latestYearTotal("fuelwood_consumption");
  inputs.push(wood
    ? { id: "fuelwood", label: "Fuelwood consumption", status: "measured", value: wood.total, unit: "M m³", period: wood.period, series_id: "fuelwood_consumption", note: `Sum of ${wood.count} committed national records for ${wood.period}.` }
    : { id: "fuelwood", label: "Fuelwood consumption", status: "missing", value: null, unit: "M m³", period: null, series_id: "fuelwood_consumption", note: "Not held. Household biomass displacement cannot be quantified." });

  // ── Fiscal: what the energy system returns to government ────────────────
  const faac = await latestYearTotal("faac_oil_revenue");
  inputs.push(faac
    ? { id: "faac_revenue", label: "FAAC oil revenue", status: "measured", value: faac.total, unit: "₦ Billion", period: faac.period, series_id: "faac_oil_revenue", note: `Sum of ${faac.count} committed national records for ${faac.period}.` }
    : { id: "faac_revenue", label: "FAAC oil revenue", status: "missing", value: null, unit: "₦ Billion", period: null, series_id: "faac_oil_revenue", note: "Not held. Fiscal exposure to the transition cannot be sized from NEDB data." });

  // ── Things NEDB does not hold at all, named rather than hidden ──────────
  const external: Input[] = [
    { id: "population", label: "Population", status: "missing", value: null, unit: "million", period: null, series_id: null,
      note: "Not an NEDB series. Supplied by you from NBS or UN projections; the model states the value it used." },
    { id: "gdp_growth", label: "Real GDP growth", status: "missing", value: null, unit: "%/yr", period: null, series_id: null,
      note: "Not an NEDB series. Supplied by you from NBS or IMF projections." },
    { id: "access_rate", label: "Electricity access rate", status: "missing", value: null, unit: "%", period: null, series_id: null,
      note: "Not an NEDB series. PENA assessments measure supply hours for respondents, which is not the same as a national access rate." },
  ];
  inputs.push(...external);

  const measured = inputs.filter((i) => i.status === "measured").length;
  const derived  = inputs.filter((i) => i.status === "derived").length;

  return ok({
    inputs,
    summary: {
      total: inputs.length,
      measured,
      derived,
      missing: inputs.length - measured - derived,
      anchored: !!gen,
    },
  });
}

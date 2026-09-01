// ── lib/necal-docs.ts ───────────────────────────────────────────────────────
// One documented entry per driver, the way the UK's MacKay calculator ships a
// note per lever. Each entry says what the driver is, exactly how it enters
// the arithmetic, where a defensible number comes from, and what moving it
// does — so a planner can defend every slider position in a meeting.

export type DriverDoc = {
  key: string;
  label: string;
  unit: string;
  what: string;
  in_the_model: string;
  sources: string;
  moving_it: string;
};

export const DRIVER_DOCS: DriverDoc[] = [
  {
    key: "population",
    label: "Population at base year",
    unit: "millions",
    what: "How many people the system must serve at the start of the plan.",
    in_the_model: "Residential demand scales with population each year; the base value anchors the whole demand curve.",
    sources: "NPC census-based projections, UN World Population Prospects (mid-year estimate).",
    moving_it: "Raising it lifts demand, capacity, capital and emissions roughly in proportion — every downstream figure moves.",
  },
  {
    key: "populationGrowthPct",
    label: "Population growth",
    unit: "% a year",
    what: "The compounding rate at which the served population grows.",
    in_the_model: "Applied every year; over a 25-year horizon a half-point difference compounds into millions of people.",
    sources: "NPC and UN WPP growth trajectories; Nigeria has recently run near 2.4%.",
    moving_it: "Small changes dominate the horizon: it is usually the single most sensitive driver in the model.",
  },
  {
    key: "gdpGrowthPct",
    label: "Real GDP growth",
    unit: "% a year",
    what: "Growth of the productive economy, which pulls commercial and industrial electricity demand.",
    in_the_model: "Commercial and industrial demand scales with GDP growth net of the energy-intensity change.",
    sources: "NBS national accounts, IMF WEO projections.",
    moving_it: "Faster growth means more daytime, productive load — the demand that supply shortages currently suppress.",
  },
  {
    key: "energyIntensityChangePct",
    label: "Energy intensity change",
    unit: "% a year",
    what: "How much less (or more) energy each unit of GDP needs over time — the efficiency lever.",
    in_the_model: "Subtracted from GDP-driven demand growth each year. Negative values mean the economy gets more efficient.",
    sources: "IEA efficiency indicators; appliance standards and industrial efficiency programmes justify the ambition chosen.",
    moving_it: "The cheapest capacity is the demand you never create: a stronger efficiency assumption removes whole power stations from the build.",
  },
  {
    key: "accessPct",
    label: "Electricity access now",
    unit: "% of population",
    what: "The share of the population with any grid or off-grid electricity today.",
    in_the_model: "The unserved share is demand waiting to be added as access expands toward the target.",
    sources: "World Bank / SEforALL tracking; NBS living standards surveys. PENA measures supply hours, which is a different thing.",
    moving_it: "A lower starting point makes the access target more expensive: more people to connect, more demand to serve.",
  },
  {
    key: "accessTargetPct",
    label: "Access target at horizon",
    unit: "%",
    what: "The share of the population the plan commits to connecting by the horizon year.",
    in_the_model: "The gap between access now and the target phases in as new demand across the plan years.",
    sources: "National Energy Policy and SDG7 commitments; the eVillage programme's own targets.",
    moving_it: "Universal access is the largest single addition to demand in most Nigerian pathways — and the point of the exercise.",
  },
  {
    key: "tdLossPct",
    label: "Grid losses now",
    unit: "%",
    what: "Transmission and distribution losses, technical and commercial, as they stand.",
    in_the_model: "Generation must exceed delivered demand by the loss factor: demand ÷ (1 − losses).",
    sources: "NERC quarterly reports (ATC&C losses), TCN dispatch data.",
    moving_it: "Every point of loss is generation built and fuelled to serve nobody.",
  },
  {
    key: "tdLossTargetPct",
    label: "Grid loss target",
    unit: "%",
    what: "Where losses are planned to land by the horizon.",
    in_the_model: "Losses glide from the current value to the target across the plan years.",
    sources: "NERC performance improvement plans; DisCo franchise commitments.",
    moving_it: "Cutting losses is capacity you do not have to build: often the cheapest megawatts in the whole plan.",
  },
  {
    key: "reserveMarginPct",
    label: "Reserve margin",
    unit: "%",
    what: "Spare capacity held above peak requirement so an outage is not a blackout.",
    in_the_model: "Required capacity is scaled up by the margin after converting generation to capacity.",
    sources: "System operator planning codes; 15–25% is common practice.",
    moving_it: "More margin costs capital but buys reliability; too little and the plan meets demand only on paper.",
  },
  {
    key: "availabilityPct",
    label: "Fleet availability",
    unit: "%",
    what: "The share of installed capacity that actually delivers, across outages, maintenance and gas supply.",
    in_the_model: "Required installed capacity = needed dependable capacity ÷ availability.",
    sources: "NERC generation performance data; Nigeria's fleet has run well below nameplate.",
    moving_it: "Low availability inflates the build: the same demand needs more steel on the ground.",
  },
  {
    key: "suppressedDemandPct",
    label: "Suppressed demand",
    unit: "%",
    what: "Consumption that today's meters cannot see because supply is short — generators, rationing, businesses that never opened.",
    in_the_model: "Added on top of measured base demand, so the plan serves what Nigeria needs, not what the broken grid managed to sell.",
    sources: "Estimated from generator-fleet studies and PENA's supply-hours data; genuinely uncertain, and the register says so.",
    moving_it: "Set it to zero and the plan quietly assumes the queue for power does not exist.",
  },
];

export const MIX_DOC = {
  what: "The target shares of generation by technology at the horizon year. Shares always normalise to 100.",
  in_the_model: "The system glides from today's observed mix to the target; each technology carries its own capital cost, capacity factor and emission factor from the assumptions register.",
  caveat: "Capital cost assumptions are international planning figures, not Nigerian tender outcomes — the reference price series exists to replace them with measured ones.",
};

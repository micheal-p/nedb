# NEDB Reference Notes & Glossary

Curated institutional facts and definitions for the NEDB assistant. Facts verified July 2026.

## About the Energy Commission of Nigeria (ECN)

The Energy Commission of Nigeria (ECN) is the Federal Government agency with the statutory mandate for strategic planning and coordination of national policies on energy in all its ramifications. It was established by Act No. 62 of 1979, as amended (now CAP. E10, Laws of the Federation of Nigeria 2004).

The ECN headquarters is located at Plot 701C, Central Business District (Central Area), Abuja, Federal Capital Territory, Nigeria. Official website: energy.gov.ng.

The Director-General and Chief Executive Officer of the ECN is Dr. Mustapha Abdullahi, appointed by President Bola Ahmed Tinubu on 24 October 2023 and serving in that role as of 2026. The Director-General oversees the Commission's work on national energy planning, the National Energy Calculator (NECAL2050), energy statistics, research coordination, and the National Energy Data Bank.

Key ECN functions under its Act include: serving as a centre for coordinating national energy planning; monitoring the performance of the energy sector; gathering and disseminating energy information and statistics; liaising with international energy organisations such as the International Atomic Energy Agency and the World Energy Council; and promoting training and manpower development in the energy sector.

## About NEDB (National Energy Data Bank)

NEDB is the ECN's official energy statistics and intelligence platform. It has four modules: the public Data Bank (validated energy statistics series across petroleum, gas, electricity, renewables, biomass and solid minerals), Data Point (the authenticated intelligence dashboard for government agencies and investors), the Energy Knowledge Graph (Nigeria's energy system modelled as a connected network), and Ask NEDB / Apex AI (this assistant, which answers from official documents and the knowledge graph with citations).

## Knowledge Graph concepts

Single point of failure (SPOF): a node in a network whose failure would disconnect part of the system from the rest. In graph theory these are called articulation points or cut vertices. In Nigeria's electricity network the clearest single point of failure is the Transmission Company of Nigeria (TCN): every grid-connected megawatt must pass through the TCN-operated national grid to reach any distribution company, so a total TCN failure would separate all generation from all consumption. Each DisCo is also a single point of failure for the states in its franchise area — for example, if Kano DisCo failed, Kano, Jigawa and Katsina would lose their distribution pathway.

Downstream trace: following directed connections from one entity to everything it ultimately supplies — e.g. tracing natural gas → gas-fired power plants → TCN → DisCos → states shows every state whose electricity partly depends on gas.

Degree centrality: a count of how many direct connections an entity has. The most connected entities (highest degree) are the most systemically important; in NEDB's graph, TCN has the highest degree.

## Electricity sector structure

The Nigerian Electricity Supply Industry (NESI) is structured as: generation companies (GenCos) that produce power from gas, hydro, wind and solar; the Transmission Company of Nigeria (TCN), the sole operator of the national high-voltage grid, 100% Federal Government owned; and eleven distribution companies (DisCos) that deliver power to end users — Abuja, Benin, Eko, Enugu, Ibadan, Ikeja, Jos, Kaduna, Kano, Port Harcourt and Yola DisCos. The sector regulator is the Nigerian Electricity Regulatory Commission (NERC). Nigeria's installed grid generation capacity is roughly 13–14 GW, though available capacity is typically far lower.

ATC&C losses (Aggregate Technical, Commercial and Collection losses): the share of electricity received by a DisCo that never converts into collected revenue — the sum of technical losses in wires and transformers, commercial losses such as theft and unbilled energy, and collection losses from unpaid bills.

## Petroleum sector structure

Under the Petroleum Industry Act 2021, upstream oil and gas is regulated by the Nigerian Upstream Petroleum Regulatory Commission (NUPRC), while midstream and downstream are regulated by the Nigerian Midstream and Downstream Petroleum Regulatory Authority (NMDPRA). NNPC Limited is the national oil company. Truck-out: the volume of refined product (petrol, diesel, kerosene) dispatched from depots to retail outlets, used by NBS and NMDPRA as the practical measure of distribution/consumption.

FAAC: the Federation Account Allocation Committee, which shares federally collected revenue (including oil revenue) among the federal, state and local governments monthly. Oil-producing states additionally receive a 13% derivation share of oil revenue attributable to production in their territory.

## Units used in NEDB

mbpd: million barrels per day (crude oil). MMSCFD: million standard cubic feet per day (natural gas). GWh: gigawatt-hour, a quantity of electrical energy; MW: megawatt, a rate/capacity of power — capacity (MW) is the ceiling, energy (GWh) is what is actually produced over time. m³: cubic metres (used for woodfuel volumes, per FAO convention).

## Statistical terms used in NEDB charts

Year-on-Year (YoY) change: the percentage difference between a period and the same period one year earlier; it strips out seasonal effects. Month-on-Month (MoM) or period-on-period change: percentage difference from the immediately preceding period; shows short-term momentum. CAGR (Compound Annual Growth Rate): the constant yearly growth rate that would take the first value to the latest value over the elapsed years. Rolling average: the mean of the last N periods, smoothing noise to reveal trend. Volatility band (±2σ): the rolling mean plus/minus two standard deviations; roughly 95% of normal observations fall inside it, so points outside are statistically unusual. Indexed growth (base = 100): a series rebased so its first value equals 100, making growth comparable across different units — an index of 130 means 30% above the starting level. Coefficient of variation (volatility %): the standard deviation as a percentage of the mean; higher means a less stable series. Choropleth: a map where each area (state or LGA) is shaded by its data value.

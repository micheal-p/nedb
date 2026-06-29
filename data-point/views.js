const VIEWS = {
    overview: `
<!-- Executive Header -->
<div class="page-header reveal overview-head">
    <div style="flex: 1; min-width: 0;">
        <div class="badge badge-green" style="margin-bottom: 1rem;">
            <span class="live-dot" style="background: var(--green);"></span> SECURE NATIONAL NEXUS
        </div>
        <h2 class="page-title" id="dashTitle">
            National Downstream<br>
            <em>Intel Command Center.</em>
            <i class="fas fa-info-circle info-btn" title="Quick System Overview" onclick="showPageInfo('overview')"></i>
        </h2>
        <p class="page-subtitle" id="dashSubtitle" style="max-width: 540px; margin-top: 0.75rem;">
            Unified analytical substrate for verified petroleum distribution and IoT telemetry across the 36 states.
        </p>
    </div>
    <div class="overview-heartbeat">
        <div class="overview-heartbeat-label">Network heartbeat</div>
        <div class="overview-heartbeat-value mono" id="lastUpdated">—</div>
        <div class="overview-heartbeat-tag"><span class="live-dot" style="background: var(--green);"></span> Synced via NEDB mesh</div>
    </div>
</div>

<!-- High-Impact Metrics -->
<div class="metrics-grid reveal" style="gap: 1.25rem;">
    <div class="metric-card overview-metric">
        <div class="overview-metric-rail"></div>
        <div class="metric-label"><span>PMS Volume (L)</span><i class="fas fa-gas-pump"></i></div>
        <div class="metric-value" id="pmsMetric">—</div>
        <div class="metric-trend up"><i class="fas fa-arrow-up-right"></i> +2.1% <span class="trend-sub">Velocity</span></div>
    </div>
    <div class="metric-card overview-metric">
        <div class="metric-label"><span>AGO Equivalence</span><i class="fas fa-truck"></i></div>
        <div class="metric-value" id="agoMetric">—</div>
        <div class="metric-trend down"><i class="fas fa-arrow-down-right"></i> -0.8% <span class="trend-sub">Demand shift</span></div>
    </div>
    <div class="metric-card overview-metric overview-metric-dark">
        <div class="metric-label"><span>Attributed Revenue</span><i class="fas fa-coins"></i></div>
        <div class="metric-value" id="revMetric">—</div>
        <div class="metric-trend up"><i class="fas fa-shield-check"></i> NEDB verified</div>
    </div>
    <div class="metric-card overview-metric">
        <div class="metric-label"><span>Active IoT Nodes</span><i class="fas fa-microchip"></i></div>
        <div class="metric-value" id="iotMetric">—</div>
        <div class="metric-trend neutral"><i class="fas fa-circle-nodes"></i> Real-time mesh</div>
    </div>
</div>

<!-- Throughput Chart -->
<div class="chart-block reveal overview-chart-block">
    <div class="chart-header">
        <div>
            <h3 class="overview-chart-title">Throughput intelligence</h3>
            <div class="chart-desc">PMS &amp; AGO distribution cycles · temporal projection mode</div>
        </div>
        <div class="overview-chart-controls">
            <div class="pill-tabs">
                <button class="pill-tab active" data-range="daily">24H</button>
                <button class="pill-tab" data-range="weekly">7D</button>
                <button class="pill-tab" data-range="monthly">30D</button>
            </div>
            <button class="topbar-action" id="filterBtn">
                <i class="fas fa-sliders-h"></i> <span>Series</span>
            </button>
        </div>
    </div>
    <div class="chart-canvas-wrap" style="height: 360px;">
        <canvas id="mixChart"></canvas>
    </div>
</div>

<!-- Operators + Product Split -->
<div class="overview-split reveal">
    <div class="chart-block iot-card">
        <div class="iot-card-head">
            <div>
                <h3>Top operators</h3>
                <div class="chart-desc">Verified volume sold this fiscal year.</div>
            </div>
            <span class="iot-pill"><i class="fas fa-ranking-star"></i> By volume</span>
        </div>
        <div id="overviewOperators" class="overview-operators"></div>
    </div>

    <div class="chart-block iot-card">
        <div class="iot-card-head">
            <div>
                <h3>Sales by product</h3>
                <div class="chart-desc">PMS vs AGO share of attributed volume.</div>
            </div>
            <span class="iot-pill"><i class="fas fa-droplet"></i> Mix</span>
        </div>
        <div id="overviewProductMix" class="overview-product-mix"></div>
    </div>
</div>

<!-- Recent activity -->
<div class="chart-block reveal iot-card" style="margin-top: 1.5rem;">
    <div class="iot-card-head">
        <div>
            <h3>Recent activity</h3>
            <div class="chart-desc">Latest verified transactions across the network.</div>
        </div>
        <span class="iot-pill"><span class="live-dot" style="background: var(--green);"></span> Streaming</span>
    </div>
    <div id="overviewActivity" class="overview-activity"></div>
</div>
`,

    nodemap: `
<div class="page-header reveal nodemap-head">
    <div style="flex: 1; min-width: 0;">
        <h2 class="page-title">Live Node Map<br><em>&amp; National Asset Tracker.</em></h2>
        <p class="page-subtitle">Real-time positions of pumps, fleets, refineries, and extraction sites across Nigeria.</p>
    </div>
    <div class="nodemap-chips">
        <div class="nodemap-chip">
            <div class="nodemap-chip-label">Total</div>
            <div class="nodemap-chip-value mono" id="totalNodesCount">—</div>
        </div>
        <div class="nodemap-chip">
            <div class="nodemap-chip-label">Active</div>
            <div class="nodemap-chip-value mono nodemap-chip-active" id="activeNodesCount">—</div>
        </div>
        <div class="nodemap-chip">
            <div class="nodemap-chip-label">Alerts</div>
            <div class="nodemap-chip-value mono nodemap-chip-alert" id="alertNodesCount">—</div>
        </div>
    </div>
</div>

<div class="nodemap-controls reveal">
    <div class="nodemap-filters" id="nodemapFilters">
        <button class="nodemap-filter active" data-filter="all"><i class="fas fa-globe"></i> All</button>
        <button class="nodemap-filter active" data-filter="pump"><i class="fas fa-gas-pump"></i> Pumps</button>
        <button class="nodemap-filter active" data-filter="truck"><i class="fas fa-truck"></i> Trucks</button>
        <button class="nodemap-filter active" data-filter="refinery"><i class="fas fa-industry"></i> Refineries</button>
        <button class="nodemap-filter active" data-filter="well"><i class="fas fa-oil-well"></i> Wells</button>
    </div>
    <div class="nodemap-search-wrap">
        <i class="fas fa-magnifying-glass"></i>
        <input type="text" id="nodemapSearch" placeholder="Search node, ID, or location…">
    </div>
</div>

<div class="nodemap-layout reveal">
    <div class="nodemap-map-wrap">
        <div id="iotMap"></div>
        <div class="nodemap-legend">
            <div class="nodemap-legend-title">Legend</div>
            <div class="nodemap-legend-row"><i class="fas fa-location-dot" style="color:var(--ink);"></i> Active node</div>
            <div class="nodemap-legend-row"><i class="fas fa-location-dot" style="color:var(--red);"></i> Alert</div>
            <div class="nodemap-legend-row"><span class="nodemap-legend-mono">NG-XXX-##</span> Node ID format</div>
        </div>
    </div>
    <aside class="nodemap-side">
        <div class="nodemap-side-head">
            <h4>Nodes <span id="nodemapVisibleCount" class="nodemap-side-count">0</span></h4>
            <span class="chart-desc" style="font-size: 0.7rem;">Click a row to centre the map.</span>
        </div>
        <div id="nodemapList" class="nodemap-list"></div>
    </aside>
</div>
`,

    revenue: `
<div class="page-header reveal">
    <div>
        <h2 class="page-title">Revenue <em>Portal.</em></h2>
        <p class="page-subtitle">Volume sold per company, in liters, traced back to the IoT locations that produced each figure.</p>
    </div>
</div>

<div class="metrics-grid reveal" id="revenueTopMetrics">
    <!-- Rendered via JS -->
</div>

<div class="chart-block reveal">
    <div class="chart-header">
        <div>
            <h3>Company Sales Registry</h3>
            <div class="chart-desc" style="color: var(--text-secondary);">Verified downstream operators with attributed volume in liters and IoT location count.</div>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
            <div class="search-wrap" style="background: rgba(0,0,0,0.03); padding: 5px 12px; border-radius: var(--r-sm); border: 1px solid var(--border);">
                <i class="fas fa-magnifying-glass" style="font-size: 0.8rem; color: var(--text-muted);"></i>
                <input type="text" id="revenueSearch" placeholder="Filter company..." style="background: none; border: none; color: var(--text-dark); font-size: 0.85rem; outline: none;">
            </div>
        </div>
    </div>

    <!-- Revenue List UI -->
    <div class="revenue-list" id="revenueList">
        <!-- Rendered via JS -->
    </div>
</div>

<!-- Detailed Revenue Modal -->
<div id="revDetailOverlay" class="sidebar-overlay" style="z-index: 2000;"></div>
<div id="revDetailPanel" class="rev-detail-panel" style="background: #fff; border-radius: 20px;">
    <div class="rev-close" id="closeRevDetail" style="color: var(--text-dark);">
        <i class="fas fa-xmark"></i>
    </div>
    <div id="revDetailContent"></div>
</div>
`,

    iot: `
<div class="page-header reveal" style="margin-bottom: 2rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 1rem; flex-wrap: wrap;">
        <div>
            <h2 class="page-title">IoT Node <em>Network.</em></h2>
            <p class="page-subtitle">12,402 hardware nodes streaming tamper-proof consumption data across all regions.</p>
        </div>
        <div class="iot-heartbeat">
            <div class="iot-heartbeat-label">Last Updated</div>
            <div class="iot-heartbeat-value mono" id="iotTimestamp">18:52:25</div>
            <div class="iot-heartbeat-tag"><span class="live-dot" style="background:var(--green);"></span> Live mesh sync</div>
        </div>
    </div>
</div>

<div class="metrics-grid reveal" id="iotMetricsGrid"></div>

<div class="iot-split reveal">
    <div class="chart-block iot-card">
        <div class="iot-card-head">
            <div>
                <h3>Nodes by Type</h3>
                <div class="chart-desc">Hardware composition across the national mesh.</div>
            </div>
            <span class="iot-pill"><i class="fas fa-microchip"></i> Composition</span>
        </div>
        <div id="iotTypeBreakdown" class="iot-type-list"></div>
    </div>

    <div class="chart-block iot-card">
        <div class="iot-card-head">
            <div>
                <h3>Health Distribution</h3>
                <div class="chart-desc">Live status across deployment zones.</div>
            </div>
            <span class="iot-pill"><i class="fas fa-heart-pulse"></i> 99.68% uptime</span>
        </div>
        <div class="iot-donut-wrap">
            <canvas id="iotStatusDonut"></canvas>
        </div>
        <div id="iotStatusLegend" class="iot-donut-legend"></div>
    </div>
</div>

<div class="iot-split reveal" style="grid-template-columns: 1.4fr 1fr;">
    <div class="chart-block iot-card">
        <div class="iot-card-head">
            <div>
                <h3>Active Alerts</h3>
                <div class="chart-desc">Nodes and zones currently flagged for review.</div>
            </div>
            <span class="iot-pill iot-pill-amber" id="iotAlertCount"><i class="fas fa-triangle-exclamation"></i> 0</span>
        </div>
        <div id="iotAlertList" class="iot-alert-list"></div>
    </div>

    <div class="chart-block iot-card">
        <div class="iot-card-head">
            <div>
                <h3>Live Telemetry</h3>
                <div class="chart-desc">Latest packets received from the mesh.</div>
            </div>
            <span class="iot-pill"><span class="live-dot" style="background:var(--green);"></span> Streaming</span>
        </div>
        <div id="iotTelemetryFeed" class="iot-telemetry-feed"></div>
    </div>
</div>

<div class="chart-block reveal iot-card" style="margin-top: 1.5rem;">
    <div class="iot-card-head" style="border-bottom: 1px solid var(--border-light); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
        <div>
            <h3>Node Health by Region</h3>
            <div class="chart-desc">Online status, alert count, and uptime for all deployment zones.</div>
        </div>
        <div class="iot-region-filters">
            <button class="iot-region-filter active" data-status="all">All</button>
            <button class="iot-region-filter" data-status="Optimal">Optimal</button>
            <button class="iot-region-filter" data-status="Alert">Alert</button>
            <button class="iot-region-filter" data-status="Critical">Critical</button>
        </div>
    </div>

    <div id="regionHealthGrid" class="iot-region-grid"></div>
</div>
`,

    comingsoon: `
<div class="page-header reveal">
    <div>
        <h2 class="page-title" id="sectorTitle">Sector Intelligence<br><em>Expansion Link.</em></h2>
        <p class="page-subtitle" style="color: var(--text-secondary);">National technical architecture expansion in progress — Node onboarding phase.</p>
    </div>
</div>

<div class="log-block  reveal" style="padding: 4.5rem !important; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--surface-raised); border: 1px solid var(--border); box-shadow: var(--shadow-elevated);">
    <div style="width: 90px; height: 90px; background: rgba(5, 150, 105, 0.1); border: 1px solid rgba(5, 150, 105, 0.2); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 2.5rem; position: relative;">
        <i class="fas fa-satellite-dish" id="sectorIcon" style="font-size: 2.5rem; color: var(--green);"></i>
        <div style="position: absolute; inset: -15px; border: 2px solid rgba(5, 150, 105, 0.1); border-radius: 30px; animation: marker-pulse-inner 3s linear infinite;"></div>
    </div>
    
    <h3 style="color: var(--ink); font-size: 1.8rem; margin-bottom: 1.25rem; font-weight: 700; letter-spacing: -0.02em;">Telemetry Link Pending</h3>
    <p style="max-width: 500px; margin: 0 auto 3rem; color: var(--text-muted); font-size: 1rem; line-height: 1.6;">
        The <b id="sectorLabel" style="color: var(--ink);">Sector</b> data pipeline is currently being integrated into the National Energy Data Bank framework. 
        <br>
        <span style="display: inline-block; margin-top: 15px; padding: 4px 10px; background: var(--border-light); border-radius: 6px; font-family: var(--mono); font-size: 0.8rem; color: #64748b;">MAPPING STATUS: ONBOARDING_ACTIVE</span>
    </p>

    <div style="display: inline-flex; gap: 0.75rem; background: rgba(5, 150, 105, 0.1); color: var(--green); border: 1px solid rgba(5, 150, 105, 0.2); padding: 0.8rem 1.75rem; border-radius: var(--r-pill); font-weight: 700; font-size: 0.8rem; letter-spacing: 0.05em; text-transform: uppercase;">
        <span class="live-dot" style="background: var(--green);"></span>
        Phase 2 Integration Phase
    </div>
</div>
`
};

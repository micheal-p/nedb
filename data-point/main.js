// Data Point — Downstream Intelligence Logic Engine (Modular & High Density)

// --- GLOBAL STATE ---
let currentPage = 'overview';
let currentKey = 'national';
let currentCompany = 'National Aggregate';
let mixChart = null;
let iotMap = null;
let mapInstance;
let mapMarkers = [];

// --- DATA STORES ---
const companyData = {
    national: {
        name: 'National Aggregate',
        logo: '../assets/fgn_logo_small.png',
        pms: 62000000, ago: 89400, revenue: 148.6, nodes: 12402,
        mix: {
            daily: { pms: [420, 540, 680, 590, 610, 550, 480], ago: [150, 210, 280, 240, 250, 230, 210], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            weekly: { pms: [3100, 3800, 4200, 3900, 4100, 3700, 3500], ago: [1200, 1500, 1700, 1600, 1650, 1550, 1400], labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7'] },
            monthly: { pms: [15000, 17200, 18800, 16900, 19200, 18400, 20100], ago: [5800, 6400, 7100, 6600, 7400, 7000, 7800], labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] }
        },
        remissions: [
            { date: '2026-03-12', txid: 'CBN-NAT-892', type: 'VAT/Edu', amount: 12.4, status: 'Verified' },
            { date: '2026-02-10', txid: 'CBN-NAT-771', type: 'VAT/Edu', amount: 11.8, status: 'Verified' },
            { date: '2026-01-15', txid: 'CBN-NAT-665', type: 'VAT/Edu', amount: 14.1, status: 'Verified' }
        ]
    },
    oando: {
        name: 'OANDO PLC',
        logo: '../assets/oando-hd-logo.png',
        pms: 12420000, ago: 18500, revenue: 24.4, nodes: 1402,
        mix: { 
            daily: { pms: [450, 520, 610, 580, 590, 540, 480], ago: [210, 240, 280, 260, 270, 240, 220], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            weekly: { pms: [650, 720, 810, 780, 790, 740, 680], ago: [310, 340, 380, 360, 370, 340, 320], labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7'] }
        },
        remissions: [
            { date: '2026-03-05', txid: 'CBN-OAN-102', type: 'VAT/Edu', amount: 1.8, status: 'Verified' },
            { date: '2026-02-04', txid: 'CBN-OAN-098', type: 'VAT/Edu', amount: 1.6, status: 'Verified' }
        ]
    },
    nnpc: {
        name: 'NNPC Retail Ltd',
        logo: '../assets/nnpc-logo.77c29e8.png',
        pms: 22500000, ago: 34200, revenue: 55.8, nodes: 4210,
        mix: { 
            daily: { pms: [1200, 1400, 1680, 1590, 1610, 1550, 1480], ago: [610, 640, 780, 760, 770, 740, 720], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            weekly: { pms: [8200, 8400, 9680, 9590, 9610, 8550, 8480], ago: [4610, 4640, 4780, 4760, 4770, 4740, 4720], labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7'] }
        },
        remissions: [
            { date: '2026-03-01', txid: 'CBN-NNP-772', type: 'VAT/Edu', amount: 4.2, status: 'Verified' },
            { date: '2026-02-01', txid: 'CBN-NNP-661', type: 'VAT/Edu', amount: 4.0, status: 'Verified' }
        ]
    },
    total: {
        name: 'TotalEnergies',
        logo: '../assets/total energies.jpeg',
        pms: 10800000, ago: 18400, revenue: 36.2, nodes: 1840,
        mix: { 
            daily: { pms: [580, 640, 880, 790, 810, 750, 680], ago: [310, 340, 480, 460, 470, 440, 420], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            weekly: { pms: [4100, 4300, 4900, 4800, 4500, 4400, 4200], ago: [2100, 2200, 2400, 2300, 2200, 2100, 2000], labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7'] }
        },
        remissions: [
            { date: '2026-03-08', txid: 'CBN-TOT-441', type: 'VAT/Edu', amount: 2.7, status: 'Verified' }
        ]
    },
    mrs: {
        name: 'MRS Oil',
        logo: '../assets/mrs.png',
        pms: 3900000, ago: 5100, revenue: 15.4, nodes: 612,
        mix: { 
            daily: { pms: [210, 240, 280, 250, 260, 240, 220], ago: [70, 90, 110, 100, 105, 95, 85], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            weekly: { pms: [1400, 1500, 1800, 1700, 1600, 1500, 1400], ago: [510, 540, 580, 560, 570, 540, 520], labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7'] }
        },
        remissions: [
            { date: '2026-03-10', txid: 'CBN-MRS-551', type: 'VAT/Edu', amount: 1.1, status: 'Verified' }
        ]
    }
};

const iotNodes = [
    { id: "NG-LAG-01", lat: 6.4589, lng: 3.4265, company: "oando", type: "pump", label: "Victoria Island Station 4", status: "Optimal" },
    { id: "NG-LAG-02", lat: 6.5244, lng: 3.3792, company: "total", type: "truck", label: "Fleet Mobile Unit TX-92", status: "Moving" },
    { id: "NG-ABU-01", lat: 9.0765, lng: 7.3986, company: "nnpc", type: "pump", label: "Maitama Central Station", status: "Optimal" },
    { id: "NG-PHC-01", lat: 4.8156, lng: 7.0498, company: "total", type: "refinery", label: "PH Midstream Terminal", status: "Optimal" },
    { id: "NG-DEL-01", lat: 5.5442, lng: 5.7601, company: "oando", type: "well", label: "OML-42 Extraction Site", status: "Active" },
    { id: "NG-KAD-01", lat: 10.5105, lng: 7.4165, company: "nnpc", type: "refinery", label: "Kaduna Refining Complex", status: "Alert" },
    { id: "NG-KAN-01", lat: 12.0022, lng: 8.5920, company: "mrs", type: "truck", label: "Kano Supply Convoy B", status: "Moving" },
    { id: "NG-IBD-01", lat: 7.3775, lng: 3.9470, company: "mrs", type: "pump", label: "Ibadan Distribution Node", status: "Optimal" }
];

const regionHealth = [
    { name: "Lagos Hub", nodes: 4201, uptime: 99.8, status: "Optimal", color: "var(--green)" },
    { name: "Abuja Nexus", nodes: 2140, uptime: 99.4, status: "Optimal", color: "var(--green)" },
    { name: "PH Refining Zone", nodes: 1840, uptime: 97.2, status: "Alert", color: "var(--amber)" },
    { name: "Kano Cluster", nodes: 1210, uptime: 99.1, status: "Optimal", color: "var(--green)" },
    { name: "Ibadan Mesh", nodes: 840, uptime: 99.6, status: "Optimal", color: "var(--green)" },
    { name: "Kaduna Substrate", nodes: 640, uptime: 88.5, status: "Critical", color: "var(--red)" },
    { name: "Warri Extraction", nodes: 520, uptime: 98.2, status: "Optimal", color: "var(--green)" },
    { name: "Enugu Regional", nodes: 480, uptime: 99.2, status: "Optimal", color: "var(--green)" },
    { name: "Benin Grid", nodes: 320, uptime: 99.9, status: "Optimal", color: "var(--green)" }
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    loadState();
    initShell();
    initDropdowns();
    initGlobalSearch();
    renderPage(currentPage);
});

async function renderPage(pageId) {
    // Handle Coming Soon Routing
    const soonSectors = ['upstream', 'midstream', 'power', 'renewable', 'bioenergy'];
    let actualViewId = pageId;
    let sectorName = '';

    if (soonSectors.includes(pageId)) {
        actualViewId = 'comingsoon';
        sectorName = pageId.charAt(0).toUpperCase() + pageId.slice(1);
        if (pageId === 'upstream' || pageId === 'midstream') sectorName = `Oil & Gas / ${sectorName}`;
    }

    // Map 'downstream' to the primary overview/dashboard for this phase
    if (pageId === 'downstream') {
        actualViewId = 'overview';
    }

    // Legacy redirect: settlements page has been folded into the revenue portal
    if (pageId === 'settlements') {
        pageId = 'revenue';
        actualViewId = 'revenue';
    }

    currentPage = pageId;
    saveState();
    
    const container = document.getElementById('viewContainer');
    
    if (!VIEWS[actualViewId]) {
        console.error("View not found:", actualViewId);
        container.innerHTML = `<div class="error-wrap"><h3>Intelligence Link Severed</h3><p>View [${actualViewId}] is not available in the nexus.</p></div>`;
        return;
    }

    container.innerHTML = VIEWS[actualViewId];

    // Inject Sector Name for Coming Soon
    if (actualViewId === 'comingsoon') {
        const label = document.getElementById('sectorLabel');
        if (label) label.textContent = sectorName;
        const icon = document.getElementById('sectorIcon');
        if (icon) {
            if (pageId === 'power') icon.className = 'fas fa-bolt';
            if (pageId === 'renewable') icon.className = 'fas fa-sun';
            if (pageId === 'bioenergy') icon.className = 'fas fa-leaf';
        }
    }
    
    // Modules Logic
    if (actualViewId === 'overview') {
        initChart('daily');
        initPillTabs();
        initChartFilters();
        renderOverviewOperators();
        renderOverviewProductMix();
        renderOverviewActivity();
    } else if (actualViewId === 'nodemap') {
        initMap();
        initNodemapControls();
    } else if (actualViewId === 'revenue') {
        initRevenuePortal();
    } else if (actualViewId === 'iot') {
        initIoTAnalytics();
    }
    
    syncUI(currentKey);
    updateSidebarActive(pageId);
    
    // Trigger animations
    setTimeout(() => {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    }, 10);
}

function initShell() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebarClose = document.getElementById('sidebarClose');

    if (!menuToggle || !sidebar || !overlay) return;

    const openMenu = () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock scroll
    };

    const closeMenu = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scroll
    };

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu();
    });

    if (sidebarClose) {
        sidebarClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMenu();
        });
    }

    overlay.addEventListener('click', closeMenu);

    // Document-level escape and click-outside safety
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    // Link Routing
    document.querySelectorAll('.sidebar-link[id^="side"], .sub-link[id^="side"]').forEach(l => {
        l.addEventListener('click', (e) => {
            const id = l.id.replace('side','').toLowerCase();
            renderPage(id);
            if (window.innerWidth <= 1024) closeMenu();
        });
    });
}

function initDropdowns() {
    document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
        trigger.onclick = (e) => {
            e.stopPropagation();
            trigger.classList.toggle('open');
        };
    });
}

function syncUI(key) {
    initTimestamp();
    initMetrics(key);
    const data = companyData[key];
    const chip = document.getElementById('chipLabel');
    if (chip) chip.textContent = data.name;
    const targets = document.querySelectorAll('.entity-logo');
    targets.forEach(t => t.src = data.logo);
}

function initMetrics(key) {
    const d = companyData[key];
    if (!d) return;
    const attributedRev = d.pms * PMS_PRICE_PER_L + d.ago * 1000 * AGO_PRICE_PER_L;
    const targets = {
        pmsMetric: fmtLiters(d.pms),
        agoMetric: fmtLiters(d.ago * 1000),
        revMetric: fmtNaira(attributedRev),
        iotMetric: d.nodes.toLocaleString()
    };
    Object.keys(targets).forEach(tid => { const el = document.getElementById(tid); if (el) el.textContent = targets[tid]; });
}

function initChart(range = 'daily') {
    const ctx = document.getElementById('mixChart');
    if (!ctx) return;
    if (mixChart) mixChart.destroy();

    const companyMix = companyData[currentKey].mix;
    const data = companyMix[range] || companyMix['daily'];

    const ctx2d = ctx.getContext('2d');
    const gradient = ctx2d.createLinearGradient(0, 0, 0, 360);
    gradient.addColorStop(0, 'rgba(14, 122, 60, 0.18)');
    gradient.addColorStop(1, 'rgba(14, 122, 60, 0.02)');

    mixChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'PMS',
                    data: data.pms,
                    borderColor: '#0E7A3C',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#0E7A3C',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                    borderWidth: 2.4
                },
                {
                    label: 'AGO',
                    data: data.ago,
                    borderColor: '#0A0A0A',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#0A0A0A',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true, position: 'top', align: 'end',
                    labels: { boxWidth: 10, boxHeight: 10, font: { size: 11, family: 'Inter' }, color: '#5C5650', usePointStyle: true, pointStyle: 'rectRounded' }
                },
                tooltip: {
                    backgroundColor: '#0A0A0A', padding: 10, cornerRadius: 8,
                    titleFont: { size: 11, family: 'Inter', weight: '600' },
                    bodyFont: { size: 12, family: 'JetBrains Mono' },
                    displayColors: false
                }
            },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: '#8E867B' } }
            }
        }
    });
}

// --- Overview helpers ---
function renderOverviewOperators() {
    const el = document.getElementById('overviewOperators');
    if (!el) return;
    const ops = Object.keys(companyData)
        .filter(k => k !== 'national')
        .map(k => {
            const d = companyData[k];
            const liters = companyTotalLiters(k);
            const revenue = d.pms * PMS_PRICE_PER_L + d.ago * 1000 * AGO_PRICE_PER_L;
            return { key: k, name: d.name, logo: d.logo, liters, revenue };
        })
        .sort((a, b) => b.liters - a.liters);

    const max = ops[0] ? ops[0].liters : 1;

    el.innerHTML = ops.map((o, i) => `
        <button class="overview-op-row" onclick="selectCompany('${o.key}'); renderPage('revenue');">
            <div class="overview-op-rank">${String(i + 1).padStart(2, '0')}</div>
            <img src="${o.logo}" class="overview-op-logo" alt="${o.name}">
            <div class="overview-op-main">
                <div class="overview-op-name">${o.name}</div>
                <div class="overview-op-bar"><div class="overview-op-bar-fill" style="width: ${Math.round((o.liters / max) * 100)}%;"></div></div>
            </div>
            <div class="overview-op-figures">
                <div class="overview-op-vol">${fmtLiters(o.liters)}</div>
                <div class="overview-op-rev mono">${fmtNaira(o.revenue)}</div>
            </div>
        </button>
    `).join('');
}

function renderOverviewProductMix() {
    const el = document.getElementById('overviewProductMix');
    if (!el) return;
    const totals = Object.keys(companyData).filter(k => k !== 'national').reduce((acc, k) => {
        acc.pms += companyData[k].pms;
        acc.ago += companyData[k].ago * 1000;
        return acc;
    }, { pms: 0, ago: 0 });

    const total = totals.pms + totals.ago;
    const pmsPct = total ? (totals.pms / total) * 100 : 0;
    const agoPct = total ? (totals.ago / total) * 100 : 0;
    const pmsRev = totals.pms * PMS_PRICE_PER_L;
    const agoRev = totals.ago * AGO_PRICE_PER_L;

    el.innerHTML = `
        <div class="overview-mix-bar">
            <div class="overview-mix-seg overview-mix-pms" style="flex: ${pmsPct};" title="PMS"></div>
            <div class="overview-mix-seg overview-mix-ago" style="flex: ${agoPct};" title="AGO"></div>
        </div>
        <div class="overview-mix-rows">
            <div class="overview-mix-row">
                <span class="overview-mix-dot pms"></span>
                <div class="overview-mix-label">PMS · Premium Motor Spirit</div>
                <div class="overview-mix-figures">
                    <div class="overview-mix-vol">${fmtLiters(totals.pms)}</div>
                    <div class="overview-mix-rev mono">${fmtNaira(pmsRev)}</div>
                </div>
                <div class="overview-mix-pct">${pmsPct.toFixed(1)}%</div>
            </div>
            <div class="overview-mix-row">
                <span class="overview-mix-dot ago"></span>
                <div class="overview-mix-label">AGO · Automotive Gas Oil</div>
                <div class="overview-mix-figures">
                    <div class="overview-mix-vol">${fmtLiters(totals.ago)}</div>
                    <div class="overview-mix-rev mono">${fmtNaira(agoRev)}</div>
                </div>
                <div class="overview-mix-pct">${agoPct.toFixed(1)}%</div>
            </div>
        </div>`;
}

function renderOverviewActivity() {
    const el = document.getElementById('overviewActivity');
    if (!el) return;
    const products = ['PMS', 'AGO'];
    const items = [];
    for (let i = 0; i < 6; i++) {
        const n = iotNodes[Math.floor(Math.random() * iotNodes.length)];
        const c = companyData[n.company];
        const product = products[Math.floor(Math.random() * products.length)];
        const liters = Math.floor(Math.random() * 9000 + 500);
        const rate = product === 'PMS' ? PMS_PRICE_PER_L : AGO_PRICE_PER_L;
        const minsAgo = i * 4 + Math.floor(Math.random() * 3);
        items.push({ company: (c && c.name) || 'Unknown', node: n.label, id: n.id, product, liters, revenue: liters * rate, when: minsAgo });
    }
    el.innerHTML = items.map(it => `
        <div class="overview-act-row">
            <div class="overview-act-icon ${it.product.toLowerCase()}"><i class="fas fa-${it.product === 'PMS' ? 'gas-pump' : 'truck'}"></i></div>
            <div class="overview-act-main">
                <div class="overview-act-title">${it.company} · <span class="overview-act-product">${it.product}</span> · ${fmtLiters(it.liters)}</div>
                <div class="overview-act-meta"><span class="mono">${it.id}</span> · ${it.node}</div>
            </div>
            <div class="overview-act-side">
                <div class="overview-act-rev mono">${fmtNaira(it.revenue)}</div>
                <div class="overview-act-time">${it.when === 0 ? 'just now' : it.when + 'm ago'}</div>
            </div>
        </div>
    `).join('');
}

function selectCompany(key) {
    if (!companyData[key]) return;
    currentKey = key;
    currentCompany = companyData[key].name;
    saveState();
}

let iotStatusChart = null;
let iotTelemetryTimer = null;

const TYPE_META = {
    pump:     { icon: 'fa-gas-pump',   label: 'Pump stations' },
    truck:    { icon: 'fa-truck',      label: 'Fleet trucks' },
    refinery: { icon: 'fa-industry',   label: 'Refineries' },
    well:     { icon: 'fa-oil-well',   label: 'Extraction wells' }
};

function initIoTAnalytics() {
    if (iotTelemetryTimer) { clearInterval(iotTelemetryTimer); iotTelemetryTimer = null; }
    renderIotMetrics();
    renderIotTypeBreakdown();
    renderIotStatusDonut();
    renderIotAlerts();
    renderIotTelemetry();
    renderIotRegions('all');
    initIotRegionFilters();
    initIotTimestamp();
}

function initIotTimestamp() {
    const el = document.getElementById('iotTimestamp');
    if (!el) return;
    const tick = () => { el.textContent = new Date().toLocaleTimeString('en-NG', { hour12: false }); };
    tick();
    setInterval(tick, 1000);
}

function renderIotMetrics() {
    const grid = document.getElementById('iotMetricsGrid');
    if (!grid) return;
    const totalRegionNodes = regionHealth.reduce((s, r) => s + r.nodes, 0);
    const avgUptime = (regionHealth.reduce((s, r) => s + r.uptime, 0) / regionHealth.length).toFixed(2);
    const alertZones = regionHealth.filter(r => r.status !== 'Optimal').length;
    const alertNodes = iotNodes.filter(n => n.status === 'Alert').length;

    grid.innerHTML = `
        <div class="metric-card">
            <div class="metric-label">Total Nodes Deployed</div>
            <div class="metric-value">12,402</div>
            <div class="metric-trend up"><i class="fas fa-arrow-up"></i> 64 added this week</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Currently Online</div>
            <div class="metric-value" style="color: var(--green);">${totalRegionNodes.toLocaleString()}</div>
            <div class="metric-trend up" style="color: var(--green);"><i class="fas fa-check-circle"></i> ${avgUptime}% avg uptime</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Active Alerts</div>
            <div class="metric-value" style="color: var(--amber);">${(alertNodes + 32).toString()}</div>
            <div class="metric-trend" style="color: var(--red);"><i class="fas fa-triangle-exclamation"></i> Across ${alertZones} zone${alertZones === 1 ? '' : 's'}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Avg Data Latency</div>
            <div class="metric-value">1.2s</div>
            <div class="metric-trend" style="color: var(--text-muted);"><i class="fas fa-signal"></i> Within SLA</div>
        </div>
    `;
}

function renderIotTypeBreakdown() {
    const el = document.getElementById('iotTypeBreakdown');
    if (!el) return;

    // Real deployed counts are much larger than the 8-node sample — scale visible counts
    const scale = { pump: 1180, truck: 96, refinery: 6, well: 215 };
    const counts = {};
    Object.keys(TYPE_META).forEach(t => { counts[t] = (iotNodes.filter(n => n.type === t).length) * scale[t]; });
    const max = Math.max(...Object.values(counts));

    el.innerHTML = Object.keys(TYPE_META).map(t => {
        const meta = TYPE_META[t];
        const count = counts[t];
        const pct = max > 0 ? Math.round((count / max) * 100) : 0;
        return `
            <div class="iot-type-row">
                <div class="iot-type-icon"><i class="fas ${meta.icon}"></i></div>
                <div class="iot-type-main">
                    <div class="iot-type-row-head">
                        <span class="iot-type-label">${meta.label}</span>
                        <span class="iot-type-count">${count.toLocaleString()}</span>
                    </div>
                    <div class="iot-type-bar"><div class="iot-type-bar-fill" style="width:${pct}%;"></div></div>
                </div>
            </div>`;
    }).join('');
}

function renderIotStatusDonut() {
    const canvas = document.getElementById('iotStatusDonut');
    if (!canvas || typeof Chart === 'undefined') return;
    if (iotStatusChart) iotStatusChart.destroy();

    const optimal = regionHealth.filter(r => r.status === 'Optimal').reduce((s, r) => s + r.nodes, 0);
    const alert   = regionHealth.filter(r => r.status === 'Alert').reduce((s, r) => s + r.nodes, 0);
    const critical = regionHealth.filter(r => r.status === 'Critical').reduce((s, r) => s + r.nodes, 0);

    const segments = [
        { label: 'Optimal',  value: optimal,  color: '#0E7A3C' },
        { label: 'Alert',    value: alert,    color: '#f59e0b' },
        { label: 'Critical', value: critical, color: '#ef4444' }
    ];

    iotStatusChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: segments.map(s => s.label),
            datasets: [{
                data: segments.map(s => s.value),
                backgroundColor: segments.map(s => s.color),
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            cutout: '68%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { padding: 10, displayColors: false } }
        }
    });

    const total = segments.reduce((s, x) => s + x.value, 0);
    const legend = document.getElementById('iotStatusLegend');
    if (legend) {
        legend.innerHTML = segments.map(s => `
            <div class="iot-legend-row">
                <span class="iot-legend-dot" style="background:${s.color};"></span>
                <span class="iot-legend-label">${s.label}</span>
                <span class="iot-legend-value">${s.value.toLocaleString()} <em>(${total ? Math.round((s.value/total)*100) : 0}%)</em></span>
            </div>
        `).join('');
    }
}

function renderIotAlerts() {
    const list = document.getElementById('iotAlertList');
    const counter = document.getElementById('iotAlertCount');
    if (!list) return;

    const alerts = [];
    iotNodes.filter(n => n.status === 'Alert').forEach(n => {
        const c = companyData[n.company];
        alerts.push({ kind: 'node', name: n.label, meta: `${n.id} · ${(c && c.name) || 'Unknown operator'}`, severity: 'high' });
    });
    regionHealth.filter(r => r.status !== 'Optimal').forEach(r => {
        alerts.push({
            kind: 'region',
            name: r.name,
            meta: `${r.nodes.toLocaleString()} nodes · ${r.uptime}% uptime`,
            severity: r.status === 'Critical' ? 'critical' : 'high'
        });
    });

    if (counter) counter.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${alerts.length}`;

    if (alerts.length === 0) {
        list.innerHTML = `<div class="iot-empty"><i class="fas fa-circle-check"></i> All zones reporting nominal.</div>`;
        return;
    }

    list.innerHTML = alerts.map(a => `
        <div class="iot-alert-row sev-${a.severity}">
            <div class="iot-alert-icon"><i class="fas ${a.kind === 'region' ? 'fa-map-location-dot' : 'fa-microchip'}"></i></div>
            <div class="iot-alert-main">
                <div class="iot-alert-name">${a.name}</div>
                <div class="iot-alert-meta">${a.meta}</div>
            </div>
            <span class="iot-alert-sev">${a.severity === 'critical' ? 'CRITICAL' : 'ALERT'}</span>
        </div>
    `).join('');
}

function renderIotTelemetry() {
    const feed = document.getElementById('iotTelemetryFeed');
    if (!feed) return;

    const pushPacket = () => {
        const n = iotNodes[Math.floor(Math.random() * iotNodes.length)];
        const c = companyData[n.company];
        const variants = [
            { msg: 'Flow meter packet received', metric: `${(Math.random()*450+50).toFixed(1)} L/min` },
            { msg: 'Telemetry heartbeat OK',     metric: `${(Math.random()*0.8+0.4).toFixed(2)}s rtt` },
            { msg: 'Tank level sample',          metric: `${(Math.random()*95+5).toFixed(1)}% full` },
            { msg: 'Pressure reading',           metric: `${(Math.random()*2+0.8).toFixed(2)} bar` }
        ];
        const v = variants[Math.floor(Math.random() * variants.length)];
        const time = new Date().toLocaleTimeString('en-NG', { hour12: false });
        const row = document.createElement('div');
        row.className = 'iot-tel-row';
        row.innerHTML = `
            <span class="iot-tel-time mono">${time}</span>
            <span class="iot-tel-id mono">${n.id}</span>
            <span class="iot-tel-msg">${v.msg} <em>· ${(c && c.name) || ''}</em></span>
            <span class="iot-tel-metric mono">${v.metric}</span>
        `;
        feed.prepend(row);
        while (feed.children.length > 12) feed.removeChild(feed.lastChild);
    };

    feed.innerHTML = '';
    for (let i = 0; i < 6; i++) pushPacket();
    iotTelemetryTimer = setInterval(pushPacket, 2200);
}

function renderIotRegions(filter) {
    const grid = document.getElementById('regionHealthGrid');
    if (!grid) return;
    const items = (filter && filter !== 'all') ? regionHealth.filter(r => r.status === filter) : regionHealth;

    if (items.length === 0) {
        grid.innerHTML = `<div class="iot-empty" style="grid-column: 1 / -1;">No zones match this filter.</div>`;
        return;
    }

    grid.innerHTML = items.map(r => `
        <div class="iot-region-card status-${r.status.toLowerCase()}">
            <div class="iot-region-head">
                <div class="iot-region-name">${r.name}</div>
                <span class="iot-region-badge">${r.status}</span>
            </div>
            <div class="iot-region-nodes"><strong>${r.nodes.toLocaleString()}</strong> nodes online</div>
            <div class="iot-region-foot">
                <span class="iot-region-uptime mono">${r.uptime}%<em> uptime</em></span>
                <div class="iot-region-bar"><div class="iot-region-bar-fill" style="width:${r.uptime}%;"></div></div>
            </div>
        </div>
    `).join('');
}

function initIotRegionFilters() {
    document.querySelectorAll('.iot-region-filter').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.iot-region-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderIotRegions(btn.dataset.status);
        };
    });
}

function initTimestamp() { const el = document.getElementById('lastUpdated'); if (el) el.textContent = new Date().toLocaleTimeString(); }
// CBN FX widget removed — sidebar now shows verified volume directly in markup.
function saveState() { localStorage.setItem('dp_page', currentPage); localStorage.setItem('dp_key', currentKey); }
function loadState() { currentPage = localStorage.getItem('dp_page') || 'overview'; currentKey = localStorage.getItem('dp_key') || 'national'; }

function updateSidebarActive(id) { 
    document.querySelectorAll('.sidebar-link, .sub-link').forEach(l => l.classList.remove('active'));
    const link = document.getElementById('side' + id.charAt(0).toUpperCase() + id.slice(1));
    if (link) link.classList.add('active');
}

function initPillTabs() {
    document.querySelectorAll('.pill-tab').forEach(t => {
        t.onclick = () => {
            document.querySelectorAll('.pill-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            const range = t.getAttribute('data-range') || 'daily';
            initChart(range);
        };
    });
}

// --- Revenue helpers ---
// PMS retail ≈ ₦665/L, AGO retail ≈ ₦1,180/L (FY 2026 reference figures used in this mock data set)
const PMS_PRICE_PER_L = 665;
const AGO_PRICE_PER_L = 1180;

function fmtLiters(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M L';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K L';
    return Math.round(n).toLocaleString() + ' L';
}

function fmtNaira(n) {
    if (n >= 1_000_000_000_000) return '₦' + (n / 1_000_000_000_000).toFixed(2) + 'T';
    if (n >= 1_000_000_000) return '₦' + (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(2) + 'M';
    return '₦' + Math.round(n).toLocaleString();
}

function companyTotalLiters(key) {
    const d = companyData[key];
    if (!d) return 0;
    // dataset stores AGO in equivalence units (not raw liters) — scale to litres for parity with PMS
    return d.pms + d.ago * 1000;
}

function companyLocations(key) {
    return iotNodes.filter(n => n.company === key);
}

function distributeAcrossLocations(key) {
    // Spread company's PMS/AGO across its IoT locations using a stable hash on node id
    const d = companyData[key];
    const nodes = companyLocations(key);
    if (!d || nodes.length === 0) return [];

    const weights = nodes.map(n => {
        const h = Array.from(n.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        return 0.6 + ((h % 80) / 100); // 0.60 – 1.39
    });
    const sumW = weights.reduce((a, b) => a + b, 0);

    return nodes.map((n, i) => {
        const share = weights[i] / sumW;
        const pmsL = Math.round(d.pms * share);
        const agoL = Math.round(d.ago * 1000 * share);
        const revenue = pmsL * PMS_PRICE_PER_L + agoL * AGO_PRICE_PER_L;
        return { node: n, pmsL, agoL, totalL: pmsL + agoL, revenue };
    });
}

function initRevenuePortal() {
    const list = document.getElementById('revenueList');
    const search = document.getElementById('revenueSearch');
    const metricsEl = document.getElementById('revenueTopMetrics');
    if (!list) return;

    if (metricsEl) {
        const companies = Object.keys(companyData).filter(k => k !== 'national');
        const totalL = companies.reduce((sum, k) => sum + companyTotalLiters(k), 0);
        const totalRev = companies.reduce((sum, k) => {
            const d = companyData[k];
            return sum + d.pms * PMS_PRICE_PER_L + d.ago * 1000 * AGO_PRICE_PER_L;
        }, 0);
        const totalLocations = companies.reduce((sum, k) => sum + companyLocations(k).length, 0);

        metricsEl.innerHTML = `
            <div class="metric-card">
                <div class="metric-label">Volume Sold (FY 2026)</div>
                <div class="metric-value">${fmtLiters(totalL)}</div>
                <div class="metric-trend up"><i class="fas fa-arrow-up"></i> Across ${companies.length} operators</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Attributed Revenue</div>
                <div class="metric-value">${fmtNaira(totalRev)}</div>
                <div class="metric-trend up"><i class="fas fa-shield-check"></i> IoT verified</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Reporting IoT Locations</div>
                <div class="metric-value">${totalLocations}</div>
                <div class="metric-trend neutral"><i class="fas fa-microchip"></i> Streaming live</div>
            </div>
        `;
    }

    function renderList(filter = '') {
        list.innerHTML = '';
        Object.keys(companyData).forEach(key => {
            if (key === 'national') return;
            const d = companyData[key];
            if (!d.name.toLowerCase().includes(filter.toLowerCase())) return;

            const liters = companyTotalLiters(key);
            const locs = companyLocations(key);
            const revenue = d.pms * PMS_PRICE_PER_L + d.ago * 1000 * AGO_PRICE_PER_L;
            const locPreview = locs.slice(0, 3).map(n => n.label.split(' ')[0]).join(' · ') + (locs.length > 3 ? ` +${locs.length - 3}` : '');

            const avgRate = liters > 0 ? Math.round(revenue / liters) : 0;

            const item = document.createElement('div');
            item.className = 'rev-item reveal active';
            item.innerHTML = `
                <div class="rev-info">
                    <img src="${d.logo}" class="rev-logo">
                    <div>
                        <div style="font-weight:700;">${d.name}</div>
                        <div class="rev-loc-preview"><i class="fas fa-location-dot"></i> ${locs.length} location${locs.length === 1 ? '' : 's'} · ${locPreview || 'No active nodes'}</div>
                    </div>
                </div>
                <div class="rev-figures">
                    <div class="rev-fig">
                        <div class="rev-fig-label">Volume</div>
                        <div class="rev-fig-value">${fmtLiters(liters)}</div>
                    </div>
                    <div class="rev-fig">
                        <div class="rev-fig-label">Avg ₦/L</div>
                        <div class="rev-fig-value mono">₦${avgRate.toLocaleString()}</div>
                    </div>
                    <div class="rev-fig">
                        <div class="rev-fig-label">Revenue</div>
                        <div class="rev-fig-value mono">${fmtNaira(revenue)}</div>
                    </div>
                </div>`;
            item.onclick = () => showRevDetail(key);
            list.appendChild(item);
        });
    }

    if (search) search.oninput = (e) => renderList(e.target.value);
    renderList();
}

function showRevDetail(key) {
    const d = companyData[key];
    const panel = document.getElementById('revDetailPanel');
    const overlay = document.getElementById('revDetailOverlay');
    const content = document.getElementById('revDetailContent');
    if (!panel || !d) return;

    const breakdown = distributeAcrossLocations(key);
    const totalL = breakdown.reduce((s, b) => s + b.totalL, 0);
    const totalRev = breakdown.reduce((s, b) => s + b.revenue, 0);
    const totalPmsL = breakdown.reduce((s, b) => s + b.pmsL, 0);
    const totalAgoL = breakdown.reduce((s, b) => s + b.agoL, 0);

    const avgRate = totalL > 0 ? Math.round(totalRev / totalL) : 0;

    const locationsHtml = breakdown.length === 0
        ? `<tr><td colspan="6" style="padding:24px; text-align:center; color:var(--text-secondary);">No IoT locations attributed to this operator yet.</td></tr>`
        : breakdown.map(b => {
            const locAvg = b.totalL > 0 ? Math.round(b.revenue / b.totalL) : 0;
            return `
            <tr class="loc-row">
                <td style="padding:14px 16px;">
                    <div style="font-weight:700; color:var(--ink);">${b.node.label}</div>
                    <div style="font-family:var(--mono); font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${b.node.id}</div>
                </td>
                <td><span class="loc-type-tag">${b.node.type}</span></td>
                <td style="font-family:var(--mono); font-weight:600;">${fmtLiters(b.pmsL)}</td>
                <td style="font-family:var(--mono); font-weight:600;">${fmtLiters(b.agoL)}</td>
                <td style="font-family:var(--mono); font-weight:600;">₦${locAvg.toLocaleString()}</td>
                <td style="text-align:right; padding-right:16px; font-family:var(--mono); font-weight:700; color:var(--ink);">${fmtNaira(b.revenue)}</td>
            </tr>`;
        }).join('');

    const today = new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
    const certNo = 'NEDB-' + key.toUpperCase() + '-' + Date.now().toString().slice(-6);

    content.innerHTML = `
        <div class="rev-detail-inner" id="revDetailPrintable">
            <header class="rev-detail-head">
                <img src="${d.logo}" class="rev-detail-logo" alt="${d.name}">
                <div style="flex:1; min-width:0;">
                    <h2 class="rev-detail-name">${d.name}</h2>
                    <p class="rev-detail-sub">Sales attribution by IoT location · FY 2026</p>
                </div>
                <div class="rev-detail-meta">
                    <div class="rev-meta-label">Ref</div>
                    <div class="rev-meta-value">${certNo}</div>
                    <div class="rev-meta-label" style="margin-top:6px;">Generated</div>
                    <div class="rev-meta-value">${today}</div>
                </div>
            </header>

            <div class="rev-rates-bar">
                <div class="rev-rate"><span>PMS rate</span><strong>₦${PMS_PRICE_PER_L.toLocaleString()} / L</strong></div>
                <div class="rev-rate"><span>AGO rate</span><strong>₦${AGO_PRICE_PER_L.toLocaleString()} / L</strong></div>
                <div class="rev-rate"><span>Blended avg.</span><strong>₦${avgRate.toLocaleString()} / L</strong></div>
            </div>

            <div class="rev-detail-stats">
                <div class="rev-stat">
                    <div class="rev-stat-label">Total Volume Sold</div>
                    <div class="rev-stat-value">${fmtLiters(totalL)}</div>
                    <div class="rev-stat-sub">PMS ${fmtLiters(totalPmsL)} · AGO ${fmtLiters(totalAgoL)}</div>
                </div>
                <div class="rev-stat">
                    <div class="rev-stat-label">Attributed Revenue</div>
                    <div class="rev-stat-value">${fmtNaira(totalRev)}</div>
                    <div class="rev-stat-sub">Derived from verified pump telemetry</div>
                </div>
                <div class="rev-stat">
                    <div class="rev-stat-label">IoT Locations</div>
                    <div class="rev-stat-value">${breakdown.length}</div>
                    <div class="rev-stat-sub">Reporting nodes</div>
                </div>
            </div>

            <div class="rev-detail-section">
                <div class="rev-section-head">
                    <h3>Per-location breakdown</h3>
                    <span class="rev-section-tag"><i class="fas fa-microchip"></i> IoT-verified</span>
                </div>
                <div class="table-responsive rev-loc-table-wrap">
                    <table class="rev-loc-table">
                        <thead>
                            <tr>
                                <th>IoT Location</th>
                                <th>Type</th>
                                <th>PMS (litres)</th>
                                <th>AGO (litres)</th>
                                <th>Amount / L</th>
                                <th style="text-align:right; padding-right:16px;">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>${locationsHtml}</tbody>
                    </table>
                </div>
            </div>

            <footer class="rev-detail-footer">
                <div>National Energy Data Bank · Revenue Portal</div>
                <div>This document is an IoT-verified extract of downstream sales attribution.</div>
            </footer>
        </div>
        <div class="rev-detail-actions no-print">
            <button class="topbar-action" id="revDetailDownload"><i class="fas fa-file-arrow-down"></i> Download PDF</button>
        </div>`;

    panel.classList.add('active');
    overlay.classList.add('active');

    document.getElementById('closeRevDetail').onclick = () => {
        panel.classList.remove('active');
        overlay.classList.remove('active');
    };

    document.getElementById('revDetailDownload').onclick = () => downloadRevDetail(d.name);
}

function downloadRevDetail(companyName) {
    const node = document.getElementById('revDetailPrintable');
    if (!node) return;
    const cleanName = companyName.replace(/[^a-z0-9]/gi, '_').toUpperCase();

    // Collect existing stylesheets so the print window matches the dashboard look
    const styles = Array.from(document.styleSheets).map(sheet => {
        try {
            const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
            return `<style>${rules}</style>`;
        } catch {
            return sheet.href ? `<link rel="stylesheet" href="${sheet.href}">` : '';
        }
    }).join('\n');

    const win = window.open('', '_blank', 'width=920,height=760');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${cleanName}_Revenue_Attribution_FY2026</title>
    ${styles}
    <style>
        body { background: #fff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 32px; color: #0a0a0a; }
        .rev-detail-inner { padding: 0 !important; }
        .rev-detail-actions, .no-print { display: none !important; }
        @media print {
            body { margin: 0; padding: 18mm; }
            .rev-detail-stats { break-inside: avoid; }
            .rev-loc-table-wrap { break-inside: avoid; }
        }
    </style>
</head>
<body>
    ${node.outerHTML}
    <script>
        window.addEventListener('load', () => {
            setTimeout(() => { window.print(); window.close(); }, 400);
        });
    <\/script>
</body>
</html>`);
    win.document.close();
}

let nodemapTypeFilter = 'all';
let nodemapSearch = '';

function initMap() {
    const mapContainer = document.getElementById('iotMap');
    if (!mapContainer) return;

    mapInstance = new maplibregl.Map({
        container: 'iotMap',
        style: 'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [8.6753, 9.0820],
        zoom: 5.7,
        pitch: 0,
        bearing: 0,
        antialias: true
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    mapInstance.on('load', () => {
        renderMapNodes();
        renderNodemapList();
        setTimeout(() => mapInstance.resize(), 300);
    });
}

function getFilteredNodes() {
    const q = nodemapSearch.trim().toLowerCase();
    return iotNodes.filter(node => {
        const typeMatch = (nodemapTypeFilter === 'all' || node.type === nodemapTypeFilter);
        if (!typeMatch) return false;
        if (!q) return true;
        return node.id.toLowerCase().includes(q)
            || node.label.toLowerCase().includes(q)
            || (companyData[node.company] && companyData[node.company].name.toLowerCase().includes(q));
    });
}

function renderMapNodes() {
    if (!mapInstance) return;

    mapMarkers.forEach(m => m.remove());
    mapMarkers = [];

    const filtered = getFilteredNodes();
    let activeTotal = 0;
    let alertTotal = 0;

    filtered.forEach(node => {
        const el = document.createElement('div');
        el.className = `marker ${node.type}`;
        const icon = { truck: 'fa-truck', pump: 'fa-gas-pump', refinery: 'fa-industry', well: 'fa-oil-well' }[node.type] || 'fa-microchip';
        const isAlert = node.status === 'Alert';
        if (isAlert) alertTotal++; else activeTotal++;

        el.innerHTML = `
            <div class="marker-pin-classic" style="color:${isAlert ? 'var(--red)' : 'var(--ink)'};">
                <i class="fas fa-map-marker-alt" style="font-size: 1.8rem;"></i>
                <div class="marker-icon-overlay" style="color: #fff;">
                    <i class="fas ${icon}" style="font-size: 0.6rem;"></i>
                </div>
            </div>
        `;

        const company = companyData[node.company];
        const marker = new maplibregl.Marker(el)
            .setLngLat([node.lng, node.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 })
                .setHTML(`
                    <div class="map-popup" style="padding:14px; min-width: 220px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                            <span class="map-popup-tag ${isAlert ? 'alert' : 'ok'}">${node.type} · ${node.status}</span>
                        </div>
                        <h3 style="font-size:0.95rem; margin:0 0 4px; font-weight: 700; color: var(--ink);">${node.label}</h3>
                        <div style="font-family: var(--mono); font-size: 0.72rem; color: var(--text-muted); margin-bottom: 10px;">${node.id}${company ? ' · ' + company.name : ''}</div>
                        <button class="popup-btn" onclick="mapInstance.flyTo({center: [${node.lng}, ${node.lat}], zoom: 14, duration: 1200})">Centre view</button>
                    </div>
                `))
            .addTo(mapInstance);
        mapMarkers.push(marker);
    });

    const totalEl = document.getElementById('totalNodesCount');
    const activeEl = document.getElementById('activeNodesCount');
    const alertEl = document.getElementById('alertNodesCount');
    if (totalEl) totalEl.textContent = filtered.length;
    if (activeEl) activeEl.textContent = activeTotal;
    if (alertEl) alertEl.textContent = alertTotal;
}

function renderNodemapList() {
    const list = document.getElementById('nodemapList');
    const counter = document.getElementById('nodemapVisibleCount');
    if (!list) return;
    const filtered = getFilteredNodes();
    if (counter) counter.textContent = filtered.length;

    if (filtered.length === 0) {
        list.innerHTML = `<div class="iot-empty">No nodes match this filter.</div>`;
        return;
    }

    const iconMap = { truck: 'fa-truck', pump: 'fa-gas-pump', refinery: 'fa-industry', well: 'fa-oil-well' };
    list.innerHTML = filtered.map(n => {
        const c = companyData[n.company];
        const isAlert = n.status === 'Alert';
        return `
            <button class="nodemap-row${isAlert ? ' is-alert' : ''}" data-lng="${n.lng}" data-lat="${n.lat}">
                <div class="nodemap-row-icon"><i class="fas ${iconMap[n.type] || 'fa-microchip'}"></i></div>
                <div class="nodemap-row-main">
                    <div class="nodemap-row-name">${n.label}</div>
                    <div class="nodemap-row-meta"><span class="mono">${n.id}</span>${c ? ' · ' + c.name : ''}</div>
                </div>
                <span class="nodemap-row-status ${isAlert ? 'alert' : 'ok'}">${n.status}</span>
            </button>`;
    }).join('');

    list.querySelectorAll('.nodemap-row').forEach(btn => {
        btn.onclick = () => {
            if (!mapInstance) return;
            const lng = parseFloat(btn.dataset.lng);
            const lat = parseFloat(btn.dataset.lat);
            mapInstance.flyTo({ center: [lng, lat], zoom: 12.5, duration: 1200 });
        };
    });
}

function initNodemapControls() {
    nodemapTypeFilter = 'all';
    nodemapSearch = '';

    document.querySelectorAll('.nodemap-filter').forEach(btn => {
        btn.onclick = () => {
            const f = btn.dataset.filter;
            nodemapTypeFilter = f;
            document.querySelectorAll('.nodemap-filter').forEach(b => b.classList.toggle('active', b === btn || (f === 'all')));
            renderMapNodes();
            renderNodemapList();
        };
    });

    const search = document.getElementById('nodemapSearch');
    if (search) {
        search.oninput = (e) => {
            nodemapSearch = e.target.value;
            renderMapNodes();
            renderNodemapList();
        };
    }
}

function showPageInfo(view) {
    const info = {
        overview: "Executive summary of national petroleum throughput and distribution health across all 36 states.",
        iot: "Tactical engineering substrate monitoring real-time pressure, signal integrity, and location telemetry for 12,000+ national mesh nodes."
    };
    alert(`[NEDB INTELLIGENCE OVERVIEW]\n\n${info[view] || "Sector documentation is currently restricted to cleared operators."}`);
}

function initGlobalSearch() {
    const searchInput = document.getElementById('companySearch');
    const resultsContainer = document.getElementById('searchResults');
    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            resultsContainer.innerHTML = '';
            return;
        }

        // Filter matches
        const matches = Object.keys(companyData).filter(key => {
            const data = companyData[key];
            return key.toLowerCase().includes(query) || data.name.toLowerCase().includes(query);
        });

        resultsContainer.classList.add('active');
        if (matches.length > 0) {
            resultsContainer.innerHTML = matches.map(key => {
                const data = companyData[key];
                return `
                    <div class="search-result-item" onclick="selectCompanySearch('${key}')">
                        <img src="${data.logo}">
                        <span style="font-weight: 700;">${data.name}</span>
                    </div>
                `;
            }).join('');
        } else {
            resultsContainer.innerHTML = `
                <div class="search-no-match">
                    <i class="fas fa-circle-exclamation"></i> 
                    Entry not found in National Ledger.<br>
                    <b>Please contact System Administrator.</b>
                </div>
            `;
        }
    });

    // Close results on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('active');
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchInput.blur();
    });
}

function selectCompanySearch(key) {
    const data = companyData[key];
    if (!data) return;

    currentKey = key;
    currentCompany = data.name;
    saveState();
    syncUI(currentKey);

    // Take user to the Revenue page
    renderPage('revenue');

    // Clean up
    const searchInput = document.getElementById('companySearch');
    const resultsContainer = document.getElementById('searchResults');
    if (searchInput) searchInput.value = '';
    if (resultsContainer) resultsContainer.classList.remove('active');
}

function initChartFilters() {
    const filterBtn = document.getElementById('filterBtn');
    if (!filterBtn) return;
    
    filterBtn.onclick = () => {
        if (!mixChart) return;
        const datasets = mixChart.data.datasets;
        const pmsHidden = datasets[0].hidden;
        const agoHidden = datasets[1].hidden;
        
        if (!pmsHidden && !agoHidden) {
            datasets[1].hidden = true;
        } else if (!pmsHidden && agoHidden) {
            datasets[0].hidden = true;
            datasets[1].hidden = false;
        } else {
            datasets[0].hidden = false;
            datasets[1].hidden = false;
        }
        mixChart.update();
    };
}
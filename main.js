/* ============================================================
   NEDB — National Energy Data Bank
   main.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initCursorGradient();
    initMobileMenu();
    initFAQ();
    initNavDropdowns();
    initMobileAccordion();
    initCursorGradient();
    initMobileMenu();
    initFAQ();
    initNavDropdowns();
    initMobileAccordion();
    initCrudeOilFilters();
    initExportFunctionality();
});

/* ---------- 1. CURSOR GRADIENT ---------- */
function initCursorGradient() {
    const container = document.getElementById('cursor-gradient-container');
    const gradient = document.getElementById('cursor-gradient');
    if (!container || !gradient) return;

    document.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        gradient.style.transform =
            `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -50%)`;
    });
}

/* ---------- 2. MOBILE MENU ---------- */
function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('mobileOverlay');
    const close = document.getElementById('mobileCloseBtn');

    if (!btn || !overlay) return;

    btn.addEventListener('click', () => overlay.classList.add('open'));
    close && close.addEventListener('click', () => overlay.classList.remove('open'));

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
    });
}


/* ---------- 3. FAQ ACCORDION ---------- */
function initFAQ() {
    const items = document.querySelectorAll('.faq-item');

    items.forEach(item => {
        const btn = item.querySelector('.faq-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            // Close all
            items.forEach(i => i.classList.remove('open'));
            // Toggle clicked
            if (!isOpen) item.classList.add('open');
        });
    });
}

/* ---------- 4. NAV DROPDOWNS (keyboard / click support) ---------- */
function initNavDropdowns() {
    const dropItems = document.querySelectorAll('.nav-item.dropdown');

    dropItems.forEach(item => {
        const menu = item.querySelector('.drop-menu');
        if (!menu) return;

        // Already handled via CSS :hover; add click for touch
        item.addEventListener('click', (e) => {
            const isVisible = menu.style.display === 'block';
            // Close all others
            document.querySelectorAll('.drop-menu').forEach(m => m.style.display = '');
            menu.style.display = isVisible ? '' : 'block';
            e.stopPropagation();
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.drop-menu').forEach(m => m.style.display = '');
    });
}

/* ---------- 5. SCROLL ANIMATIONS ---------- */
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .adv-item, .suite-card-link').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
});

document.addEventListener('DOMContentLoaded', () => {
    // Re-run after a tick so initial styles apply
    setTimeout(() => {
        document.querySelectorAll('.visible').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 100);
});

// Patch observer to actually apply the styles
const realObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .adv-item, .suite-card-link').forEach(el => {
    realObserver.observe(el);
});

/* ---------- 6. MOBILE ACCORDION ---------- */
function initMobileAccordion() {
    const headers = document.querySelectorAll('.mobile-dropdown-header');

    headers.forEach(header => {
        header.addEventListener('click', (e) => {
            e.preventDefault();
            const parent = header.closest('.mobile-nav-item');

            // Toggle current
            parent.classList.toggle('open');

            // Close others (optional, but cleaner)
            document.querySelectorAll('.mobile-nav-item').forEach(item => {
                if (item !== parent) item.classList.remove('open');
            });
        });
    });
}


/* ---------- 8. DATA-TABLE FILTERS (Product + Year range) ---------- */
function initCrudeOilFilters() {
    const filterBtn = document.getElementById('filterBtn');
    const productEl = document.getElementById('filterProduct');
    const yearFromEl = document.getElementById('filterYearFrom');
    const yearToEl = document.getElementById('filterYearTo');
    const tbody = document.querySelector('.data-table tbody');
    if (!filterBtn || !productEl || !yearFromEl || !yearToEl || !tbody) return;

    // ---- Step 1: scan the table once and build sets of descriptions + years ----
    const descSet = new Set();
    const yearSet = new Set();
    tbody.querySelectorAll('tr').forEach(row => {
        if (row.id === 'no-data-row') return;
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return;
        const desc = cells[1].textContent.trim();
        const yearText = cells[2].textContent.trim();
        if (desc) descSet.add(desc);
        // capture every 4-digit year token in the year cell (handles "2023", "2014–2023", "1 Jan 2024")
        (yearText.match(/\d{4}/g) || []).forEach(y => yearSet.add(parseInt(y, 10)));
    });

    // ---- Step 2: replace the placeholder Product dropdown with the actual descriptions ----
    const sortedDescs = [...descSet].sort((a, b) => a.localeCompare(b));
    productEl.innerHTML =
        '<option value="all">All Descriptions (' + sortedDescs.length + ')</option>' +
        sortedDescs.map(d => `<option value="${d.replace(/"/g, '&quot;')}">${d}</option>`).join('');

    // ---- Step 3: replace the year dropdowns with only years that exist in the data ----
    if (yearSet.size > 0) {
        const sortedYears = [...yearSet].sort((a, b) => b - a); // newest first
        const yearOpts = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
        yearFromEl.innerHTML = yearOpts;
        yearToEl.innerHTML = yearOpts;
        // sensible defaults: From = oldest, To = newest
        yearFromEl.value = sortedYears[sortedYears.length - 1];
        yearToEl.value = sortedYears[0];
    }

    // ---- Step 4: ensure a "no results" row exists ----
    let noDataRow = document.getElementById('no-data-row');
    if (!noDataRow) {
        noDataRow = document.createElement('tr');
        noDataRow.id = 'no-data-row';
        noDataRow.style.display = 'none';
        noDataRow.innerHTML = '<td colspan="5" style="text-align:center; padding: 20px; color: #666; font-style: italic;">No records match your filter — try widening the year range or selecting "All Descriptions".</td>';
        tbody.appendChild(noDataRow);
    }

    // ---- Step 4b: insert a "Showing X of Y rows" counter just above the table ----
    const totalRows = tbody.querySelectorAll('tr').length - 1; // minus the no-data row
    const tableContainer = document.querySelector('.table-container');
    let counterEl = document.getElementById('filter-count');
    if (!counterEl && tableContainer) {
        counterEl = document.createElement('div');
        counterEl.id = 'filter-count';
        counterEl.className = 'filter-count';
        tableContainer.parentElement.insertBefore(counterEl, tableContainer);
    }
    function renderCount(visible) {
        if (!counterEl) return;
        counterEl.innerHTML = visible === totalRows
            ? `Showing all <strong>${totalRows}</strong> records.`
            : `Showing <strong>${visible}</strong> of <strong>${totalRows}</strong> records.`;
    }

    // ---- Step 5: filter routine (runs on click + on any select change for live filtering) ----
    function applyFilter() {
        const product = productEl.value;
        const yearFrom = parseInt(yearFromEl.value, 10);
        const yearTo = parseInt(yearToEl.value, 10);
        const lo = Math.min(yearFrom, yearTo);
        const hi = Math.max(yearFrom, yearTo);

        let visibleCount = 0;
        tbody.querySelectorAll('tr').forEach(row => {
            if (row.id === 'no-data-row') return;
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            const desc = cells[1].textContent.trim();
            const yearText = cells[2].textContent.trim();
            const yearMatches = yearText.match(/\d{4}/g);

            const matchProduct = (product === 'all') || (desc === product);
            // a row matches the year filter if ANY 4-digit year in its year cell falls in range
            // (this handles ranges like "2014–2023" and aggregates like "1 Jan 2024")
            const matchYear = !yearMatches || yearMatches.length === 0 ||
                yearMatches.some(y => {
                    const yi = parseInt(y, 10);
                    return yi >= lo && yi <= hi;
                });

            if (matchProduct && matchYear) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        noDataRow.style.display = visibleCount === 0 ? 'table-row' : 'none';
        renderCount(visibleCount);
    }

    // Wire up: button click + live filtering on any change (no need to click "Filter" each time)
    filterBtn.addEventListener('click', applyFilter);
    productEl.addEventListener('change', applyFilter);
    yearFromEl.addEventListener('change', applyFilter);
    yearToEl.addEventListener('change', applyFilter);

    // Initial render — show count for the unfiltered table
    renderCount(totalRows);
}

/* ---------- 9. EXPORT REPORT FUNCTIONALITY ---------- */
function initExportFunctionality() {
    const exportBtn = document.getElementById('exportBtn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. Get the data table and page title
        const table = document.querySelector('.data-table');
        const pageTitle = document.querySelector('.page-header h1')?.innerText || 'Report';

        if (!table) {
            alert('No data to export!');
            return;
        }

        // 2. Open a new window for printing
        const printWindow = window.open('', '', 'height=800,width=1000');

        // 3. Construct the HTML for the print window
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Export ${pageTitle}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #000; }
                    .header { text-align: left; margin-bottom: 30px; border-bottom: 2px solid #16a34a; padding-bottom: 20px; display: flex; align-items: center; gap: 15px; }
                    .logo { height: 60px; width: auto; }
                    .header-text { display: flex; flex-direction: column; }
                    .site-name { font-size: 1.2rem; font-weight: 700; color: #0a0a0a; letter-spacing: 1px; text-transform: uppercase; }
                    .report-title { font-size: 1.5rem; font-weight: 600; margin: 20px 0; color: #0a0a0a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9rem; }
                    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
                    th { background-color: #f9fafb; font-weight: 600; color: #374151; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                    .footer { margin-top: 40px; font-size: 0.8rem; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="assets/ecnlogo.png" alt="ECN Logo" class="logo">
                    <div class="header-text">
                        <span class="site-name">National Energy Data Bank</span>
                        <span style="font-size: 0.9rem; color: #666;">Energy Commission of Nigeria</span>
                    </div>
                </div>
                
                <h2 class="report-title">${pageTitle}</h2>
                <div style="font-size: 0.9rem; margin-bottom: 20px; color: #555;">Generated on: ${new Date().toLocaleDateString()}</div>

                ${table.outerHTML}

                <div class="footer">
                    &copy; ${new Date().getFullYear()} National Energy Data Bank. All rights reserved.
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        }
                    }
                </script>
            </body>
            </html>
        `;

        // 4. Write content to the new window
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    });
}


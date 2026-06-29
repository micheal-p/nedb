import re

path = '/Users/aniebietpius/Downloads/testsite-main/energy-databank/data-point/views.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove glass-card
content = content.replace('glass-card', '')

# Fix overview title
content = re.sub(
    r'<h2 class="page-title"[^>]*>\s*National Downstream<br>\s*<span[^>]*>Intel Command Center\.</span>',
    r'<h2 class="page-title" id="dashTitle">\n            National Downstream<br>\n            <em>Intel Command Center.</em>',
    content
)

# Fix dark card in overview
content = content.replace('background: #111827; color: #fff;', 'background: var(--ink); color: var(--surface-raised);')
content = content.replace('color: rgba(255,255,255,0.6);', 'color: rgba(251,250,246,0.8);')
content = content.replace('id="revMetric" style="color: #fff;', 'id="revMetric" style="color: var(--surface-raised);')

# Fix nodemap title
content = content.replace('<h2 class="page-title">Live Node Map<br><span>& National Asset Tracker.</span></h2>', '<h2 class="page-title">Live Node Map<br><em>& National Asset Tracker.</em></h2>')

# Fix revenue title
content = content.replace('<h2 class="page-title" style="font-weight: 300;">Revenue <span style="font-weight:700;">Portal.</span></h2>', '<h2 class="page-title">Revenue <em>Portal.</em></h2>')

# Fix settlements title
content = content.replace('<h2 class="page-title" style="font-weight: 300;">Transaction <span style="font-weight:700;">Ledger.</span></h2>', '<h2 class="page-title">Transaction <em>Ledger.</em></h2>')

# Fix iot title
content = content.replace('<h2 class="page-title" style="font-weight: 300;">IoT Node <span style="font-weight:700; color: var(--green);">Network.</span></h2>', '<h2 class="page-title">IoT Node <em>Network.</em></h2>')

# Fix comingsoon title and dark background
content = content.replace('<h2 class="page-title" id="sectorTitle" style="color: #fff;">Sector Intelligence<br><span style="color: var(--green);">Expansion Link.</span></h2>', '<h2 class="page-title" id="sectorTitle">Sector Intelligence<br><em>Expansion Link.</em></h2>')
content = content.replace('style="color: #94a3b8;"', 'style="color: var(--text-secondary);"')
content = content.replace('background: #0f172a; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 40px 80px rgba(0,0,0,0.4);', 'background: var(--surface-raised); border: 1px solid var(--border); box-shadow: var(--shadow-elevated);')
content = content.replace('style="color: #fff; font-size: 1.8rem; margin-bottom: 1.25rem; font-weight: 700; letter-spacing: -0.02em;"', 'style="color: var(--ink); font-size: 1.8rem; margin-bottom: 1.25rem; font-weight: 700; letter-spacing: -0.02em;"')
content = content.replace('color: #94a3b8; font-size: 1rem; line-height: 1.6;', 'color: var(--text-muted); font-size: 1rem; line-height: 1.6;')
content = content.replace('id="sectorLabel" style="color: #fff;"', 'id="sectorLabel" style="color: var(--ink);"')
content = content.replace('background: rgba(255,255,255,0.05);', 'background: var(--border-light);')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated views.js")

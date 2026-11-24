import { MONTHS, LABELS, formatPercent, riskLevel } from './core.js';
import { computeGrant } from './grant.js';
import { buildReviewDetail, generateReviewActions } from './review.js';
import { renderMeetingPage } from './pages/meeting.js';
import { renderGrantPage } from './pages/grant-panel.js';
import { renderQualityPage } from './pages/quality.js';
import { renderChalkProgram } from './pages/program-chalk.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
const fmt = (n) => n.toLocaleString('en-IN');
const titleCase = (v) => v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1);
const root = document.getElementById('app');
let schoolRows = [];
let grantRows = [];
let finance = [];
let media = [];
let quality = null;
let page = 'review', by = 'district', sortBy = 'priority', ascending = false, tablePage = 0;
let selectedGrant = 'GRANT_AA_2025', showSources = true, showMedia = true;
let gridMonth = '2025-09', focusedBlock = null, showTable = false;
let tableSearch = '', statusFilter = 'all', aiRequested = false, aiOutput = null, aiStatus = 'Deterministic narrative is ready; AI is off.';
const params = new URLSearchParams(location.search);
let f = { month: (MONTHS.includes(params.get('month')) ? params.get('month') : '2025-09'), district: params.get('district') || '', block: params.get('block') || '', grade: (['6', '7', '8'].includes(params.get('grade') || '') ? params.get('grade') : 'all'), subject: (['science', 'math'].includes(params.get('subject') || '') ? params.get('subject') : 'all') };
function syncURL() {
    const p = new URLSearchParams();
    p.set('month', f.month);
    for (const key of ['district', 'block', 'grade', 'subject'])
        if (f[key] && f[key] !== 'all')
            p.set(key, f[key]);
    history.replaceState({}, '', `${location.pathname}?${p.toString()}`);
}
const statusClass = (s) => ({ 'On Track': 'good', 'Behind': 'behind', 'At Risk': 'risk', 'Critical': 'critical', 'No Data': 'nodata' }[s]);
function pill(s) { return `<span class="status-word"><i class="status-square ${statusClass(s)}"></i>${esc(s)}</span>`; }
function opt(value, label, selected) { return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`; }
function selectors() {
    const districts = Array.from(new Set(schoolRows.filter(r => r.month === f.month).map(r => r.district))).sort();
    const blocks = Array.from(new Set(schoolRows.filter(r => r.month === f.month && (!f.district || r.district === f.district)).map(r => r.block))).sort();
    const active = [f.district && ['district', f.district], f.block && ['block', f.block], f.grade !== 'all' && ['grade', `Class ${f.grade}`], f.subject !== 'all' && ['subject', titleCase(f.subject)]].filter(Boolean);
    return `
<section class="filters" aria-label="Program filters">
    
<div class="filter-fields">
    
<label>Month<select data-filter="month">${MONTHS.map(m => opt(m, LABELS[m], f.month)).join('')}</select></label>
    
<label>District<select data-filter="district">${opt('', 'All districts', f.district)}${districts.map(v => opt(v, v, f.district)).join('')}</select></label>
    
<label>Block<select data-filter="block">${opt('', 'All blocks', f.block)}${blocks.map(v => opt(v, v, f.block)).join('')}</select></label>
    
<label>Class<select data-filter="grade">${['all', '6', '7', '8'].map(g => opt(g, g === 'all' ? 'All classes' : `Class ${g}`, f.grade)).join('')}</select></label>
    
<label>Subject<select data-filter="subject">${['all', 'science', 'math'].map(v => opt(v, v === 'all' ? 'Both subjects' : titleCase(v), f.subject)).join('')}</select></label>
    <button data-action="reset" class="reset-filter">Reset</button></div>
    ${active.length ? `
<div class="active-filters"><span>IN VIEW</span>${active.map(([key, value]) => `<button data-remove-filter="${key}">${esc(value)} ×</button>`).join('')}</div>` : ''}
    </section>`;
}
function header() {
    return `
<div class="app-shell">
    <header class="masthead">
<div class="masthead-inner">
<div class="masthead-top">
      
<div class="masthead-brand"><img class="chalkline-wordmark" src="brand/chalkline-wordmark-dark.svg" alt="Chalkline — PBL review and grant reporting" width="300" height="64"/><span class="chalkline-tagline">Mark where to act.</span></div>
      
<div class="masthead-note">INDEPENDENT PBL CASE STUDY <i></i> SYNTHETIC DATA ONLY</div>
    </div><nav class="masthead-nav" aria-label="Main navigation">
      <button data-page="review" class="${page === 'review' ? 'active' : ''}" aria-current="${page === 'review' ? 'page' : 'false'}">Program review</button>
      <button data-page="meeting" class="${page === 'meeting' ? 'active' : ''}" aria-current="${page === 'meeting' ? 'page' : 'false'}">Meeting pack</button>
      <button data-page="grants" class="${page === 'grants' ? 'active' : ''}" aria-current="${page === 'grants' ? 'page' : 'false'}">Grant reporting</button>
      <button data-page="quality" class="${page === 'quality' ? 'active' : ''}" aria-current="${page === 'quality' ? 'page' : 'false'}">Data notes</button>
    </nav></div></header>
<main class="paper">
<div class="paper-inner">`;
}
function footer() {
    return `</div>
<footer class="paper-footer"><span>CHALKLINE / INDEPENDENT PBL CASE STUDY</span><span>All school, grant, finance and evidence records are synthetic · Numbers from deterministic code.</span></footer></main></div>`;
}
function tableData(rows) {
    let copy = rows.filter(x => (statusFilter === 'all' || x.risk.level === statusFilter) && (!tableSearch || x.name.toLowerCase().includes(tableSearch.toLowerCase())));
    const getter = (x) => sortBy === 'name' ? x.name : sortBy === 'participation' ? x.metrics.participationRate ?? -1 : sortBy === 'evidence' ? x.metrics.evidenceRate ?? -1 : sortBy === 'attendance' ? x.metrics.attendanceRate ?? -1 : x.priority;
    copy.sort((a, b) => { const va = getter(a), vb = getter(b); const cmp = typeof va === 'string' ? String(va).localeCompare(String(vb)) : Number(va) - Number(vb); return ascending ? cmp : -cmp; });
    const max = Math.ceil(copy.length / 15);
    tablePage = Math.min(tablePage, Math.max(0, max - 1));
    return { copy, show: copy.slice(tablePage * 15, (tablePage + 1) * 15), max };
}
function indicatorCell(value) { return `<span class="metric-inline"><span class="indicator-dot ${statusClass(riskLevel(value))}"></span>${formatPercent(value)}</span>`; }
function performanceTable(rows) {
    const { show, max, copy } = tableData(rows);
    const head = (key, label) => `<button class="th-btn" data-sort="${key}">${label}${sortBy === key ? (ascending ? ' ↑' : ' ↓') : ''}</button>`;
    return `
<div class="table-controls">
<label>Find a place <input type="search" data-table-search="true" value="${esc(tableSearch)}" placeholder="District or block name" /></label>
<div class="status-chip-row">${['all', 'On Track', 'Behind', 'At Risk', 'Critical'].map(x => `<button class="status-chip ${statusFilter === x ? 'selected' : ''}" data-status="${x}">${x === 'all' ? 'All statuses' : esc(x)}</button>`).join('')}</div></div>
 
<div class="table-wrap">
<table>
<thead>
<tr>
<th>${head('name', by === 'district' ? 'District' : 'Block')}</th>
<th>${head('participation', 'Participation')}</th>
<th>${head('evidence', 'Evidence')}</th>
<th>${head('attendance', 'Attendance')}</th>
<th>Overall</th>
<th>${head('priority', 'Priority gap')}</th></tr></thead>
<tbody>
 ${show.map(x => `
<tr>
<td><strong>${esc(x.name)}</strong><small>${fmt(x.metrics.schools)} schools</small></td>
<td>${indicatorCell(x.metrics.participationRate)}</td>
<td>${indicatorCell(x.metrics.evidenceRate)}</td>
<td>${indicatorCell(x.metrics.attendanceRate)}</td>
<td>${pill(x.risk.level)}</td>
<td class="priority">${fmt(Math.round(x.priority))}</td></tr>`).join('') || '<tr><td colspan="6">No matching geographies</td></tr>'}</tbody></table></div>
 
<div class="table-footer"><span>Showing ${copy.length ? tablePage * 15 + 1 : 0}–${Math.min((tablePage + 1) * 15, copy.length)} of ${copy.length}</span>
<div><button class="icon-button" data-action="prev-page" ${tablePage === 0 ? 'disabled' : ''}>← Previous</button><span>Page ${tablePage + 1} / ${Math.max(1, max)}</span><button class="icon-button" data-action="next-page" ${tablePage >= max - 1 ? 'disabled' : ''}>Next →</button></div></div>`;
}
function program() { return renderChalkProgram({ schools: schoolRows, filters: f, header, footer, selectors, esc, fmt, performanceTable, gridMonth, focusedBlock, showTable, by }); }
function currentReviewDetail() {
    const r = buildReviewDetail(schoolRows, f);
    const warnings = finance.filter(x => x.reporting_month === f.month && x.approved > 0 && Math.abs(100 * x.cumulative / x.approved - 100 * x.sourceRate) > 0.1).map(x => `${x.grant_id}: ${x.budget_line}`);
    r.actions = generateReviewActions(schoolRows, f, warnings);
    return r;
}
function meetingPage() { return renderMeetingPage({ f, r: currentReviewDetail(), header, selectors, footer, esc, fmt, pill, statusClass }); }
function reviewMarkdown() {
    const r = currentReviewDetail(), m = r.metrics;
    return `# PBL Monthly Review — ${LABELS[f.month]}

Scope: ${f.district || 'All districts'} / ${f.block || 'All blocks'} / ${f.grade === 'all' ? 'All grades' : `Grade ${f.grade}`} / ${f.subject === 'all' ? 'Both subjects' : f.subject}

## Performance
- Participation: ${fmt(m.participating)} of ${fmt(m.schools)} schools (${formatPercent(m.participationRate)})
- Evidence: ${fmt(m.evidenceCount)} schools (${formatPercent(m.evidenceRate)})
- Enrollment: ${fmt(m.enrollment)}
- Attendance: ${fmt(m.attendance)} / ${fmt(m.possibleSessions)} (${formatPercent(m.attendanceRate)})
- Overall status: ${r.overall.level} — ${r.overall.reason}

## Achievements
${r.achievements.map(x => `- ${x}`).join('\n')}

## Month-over-month changes
${r.changes.map(x => `- ${x.label}: ${formatPercent(x.previous)} → ${formatPercent(x.current)} (${x.delta === null ? 'no earlier period' : `${x.delta >= 0 ? '+' : ''}${x.delta.toFixed(1)} pp`})`).join('\n')}

## Priority districts
${r.priorityDistricts.map(x => `- ${x.name}: ${x.risk.reason}, ${x.metrics.schools} schools`).join('\n')}

## Priority blocks
${r.priorityBlocks.map(x => `- ${x.name}: ${x.risk.reason}, ${x.metrics.enrollment} enrolled`).join('\n')}

## Proposed actions
${r.actions.map(x => `- [${x.id}] ${x.action}; owner: ${x.owner}; due: ${x.dueDate}; linked metric: ${x.linkedMetric}; ${x.status}`).join('\n')}

## Discussion prompts
${r.prompts.map(x => `- ${x}`).join('\n')}

All records synthetic; proposed owners and dates are illustrative, not confirmed. Metrics are deterministic.
`;
}
function download(text, name) { const b = new Blob([text], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
function renderCitations(paragraph) {
    return esc(paragraph).replace(/\[(F\d+)\]/g, (_, id) => `<button type="button" class="fact-citation" data-fact="${id}" title="Jump to source fact ${id}">[${id}]</button>`);
}
async function requestAINarrative() {
    aiRequested = true;
    aiOutput = null;
    aiStatus = 'Checking optional AI service…';
    // GitHub Pages and other static hosts cannot provide a server-side LLM endpoint.
    // Do not issue a request to the hosting provider's unrelated /api path.
    if (location.hostname.endsWith('.github.io')) {
        aiStatus = 'AI service is not connected on GitHub Pages. Verified deterministic narrative remains available.';
        render();
        return;
    }
    const requestedGrant = selectedGrant, requestedMonth = f.month;
    render();
    try {
        const response = await fetch('/api/narrative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant: selectedGrant, month: f.month }) });
        if (!response.ok)
            throw new Error('Optional AI endpoint unavailable');
        const result = await response.json();
        if (selectedGrant !== requestedGrant || f.month !== requestedMonth || !aiRequested)
            return;
        aiOutput = result.mode === 'ai' ? result.narrative : null;
        aiStatus = result.mode === 'ai' ? 'AI text validated; numbers and citations checked' : `Deterministic fallback: ${result.reason || 'No validated AI output'}`;
    }
    catch {
        aiStatus = 'AI service is not connected. Verified deterministic narrative remains available.';
    }
    render();
}
function grantPage() { return renderGrantPage({ grantRows, selectedGrant, f, gr: currentGrant(), header, footer, opt, fmt, esc, pill, showMedia, showSources, aiRequested, aiOutput, aiStatus, renderCitations }); }
function qualityPage() { return renderQualityPage({ q: quality, finance, header, footer, fmt, esc }); }
function render() { root.innerHTML = page === 'review' ? program() : page === 'meeting' ? meetingPage() : page === 'grants' ? grantPage() : qualityPage(); }
function notify(message) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = message; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }
async function copy(value) {
    try {
        await navigator.clipboard.writeText(value);
        notify('Copied to clipboard');
    }
    catch {
        notify('Clipboard unavailable. Use export instead.');
    }
}
function currentGrant() { return computeGrant(schoolRows, grantRows, finance, media, selectedGrant, f.month); }
document.addEventListener('change', e => {
    const target = e.target;
    if (!(target instanceof HTMLSelectElement))
        return;
    const k = target.dataset.filter;
    if (k) {
        f[k] = target.value;
        if (k === 'district' || k === 'month')
            f.block = '';
        if (k === 'month')
            gridMonth = f.month;
        focusedBlock = null;
        syncURL();
        tablePage = 0;
        aiOutput = null;
        render();
    }
    else if (target.dataset.grant) {
        selectedGrant = target.value;
        aiOutput = null;
        render();
    }
});
document.addEventListener('change', e => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.dataset.tableSearch) {
        tableSearch = target.value;
        tablePage = 0;
        render();
    }
});
document.addEventListener('click', e => {
    const el = e.target.closest('button');
    if (!el)
        return;
    const remove = el.dataset.removeFilter;
    if (remove) {
        f[remove] = remove === 'grade' || remove === 'subject' ? 'all' : '';
        if (remove === 'district')
            f.block = '';
        focusedBlock = null;
        syncURL();
        render();
        return;
    }
    if (el.dataset.gridMonth) {
        gridMonth = el.dataset.gridMonth;
        focusedBlock = null;
        render();
        return;
    }
    if (el.dataset.gridBlock || el.dataset.priorityBlock) {
        focusedBlock = el.dataset.gridBlock || el.dataset.priorityBlock || null;
        if (el.dataset.priorityBlock)
            gridMonth = f.month;
        render();
        if (el.dataset.priorityBlock)
            document.getElementById('block-map-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    if (el.dataset.focusDistrict) {
        f.district = el.dataset.focusDistrict;
        f.block = '';
        focusedBlock = null;
        syncURL();
        render();
        return;
    }
    if (el.dataset.page) {
        page = el.dataset.page;
        render();
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
    }
    if (el.dataset.fact) {
        showSources = true;
        render();
        const fact = document.getElementById(`fact-${el.dataset.fact}`);
        fact?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        fact?.classList.add('fact-highlight');
        return;
    }
    if (el.dataset.status) {
        statusFilter = el.dataset.status;
        tablePage = 0;
        render();
        return;
    }
    if (el.dataset.by) {
        by = el.dataset.by;
        sortBy = 'priority';
        ascending = false;
        tablePage = 0;
        render();
        return;
    }
    if (el.dataset.sort) {
        if (sortBy === el.dataset.sort)
            ascending = !ascending;
        else {
            sortBy = el.dataset.sort;
            ascending = sortBy === 'name';
        }
        tablePage = 0;
        render();
        return;
    }
    const action = el.dataset.action;
    if (action === 'toggle-table') {
        showTable = !showTable;
        render();
        return;
    }
    if (action === 'close-block') {
        focusedBlock = null;
        render();
        return;
    }
    if (action === 'reset') {
        f = { month: f.month, district: '', block: '', grade: 'all', subject: 'all' };
        syncURL();
        render();
    }
    if (action === 'prev-page') {
        tablePage = Math.max(0, tablePage - 1);
        render();
    }
    if (action === 'next-page') {
        tablePage++;
        render();
    }
    if (action === 'copy-review')
        void copy(reviewMarkdown());
    if (action === 'download-review')
        download(reviewMarkdown(), `pbl-review-${f.month}.md`);
    if (action === 'copy-grant')
        void copy(currentGrant().markdown);
    if (action === 'download-grant')
        download(currentGrant().markdown, `grant-${selectedGrant}-${f.month}.md`);
    if (action === 'toggle-sources') {
        showSources = !showSources;
        render();
    }
    if (action === 'toggle-media') {
        showMedia = !showMedia;
        render();
    }
    if (action === 'ai-on')
        void requestAINarrative();
    if (action === 'ai-off') {
        aiRequested = false;
        aiOutput = null;
        aiStatus = 'Deterministic mode active; AI is off.';
        render();
    }
    if (action === 'print')
        window.print();
});
async function init() {
    try {
        const [schools, grants, fin, assets, checks] = await Promise.all(['schools.json', 'grants.json', 'finance.json', 'media.json', 'quality.json'].map(async (file) => {
            const response = await fetch(`data/${file}`);
            if (!response.ok)
                throw new Error(`Could not load ${file}`);
            return response.json();
        }));
        schoolRows = schools;
        grantRows = grants;
        finance = fin;
        media = assets;
        quality = checks;
        render();
    }
    catch (err) {
        root.innerHTML = `
<div class="boot-error">
<h2>Could not load programme data</h2>
<p>${esc(err.message)}</p>
<p>Run <code>npm run dev</code> from the project folder. Opening index.html directly will not work because the app uses fetch.</p></div>`;
    }
}
void init();
// SVG plot markers select their district with the same filter logic as the select control.
document.addEventListener('click', e => {
    const plot = e.target.closest('[data-plot-district]');
    if (!plot)
        return;
    f.district = plot.dataset.plotDistrict || '';
    f.block = '';
    focusedBlock = null;
    syncURL();
    render();
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ')
        return;
    const plot = e.target.closest('[data-plot-district]');
    if (plot) {
        e.preventDefault();
        plot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
});
document.addEventListener('mouseover', e => {
    const cite = e.target.closest('[data-fact]');
    const id = cite?.dataset.fact;
    if (id)
        document.getElementById(`fact-${id}`)?.classList.add('fact-highlight');
});
document.addEventListener('mouseout', e => {
    const cite = e.target.closest('[data-fact]');
    const id = cite?.dataset.fact;
    if (id)
        document.getElementById(`fact-${id}`)?.classList.remove('fact-highlight');
});

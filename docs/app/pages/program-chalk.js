/** Chalkline program page. Visualizations use only metrics from the deterministic core. */
import { MONTHS, LABELS, THRESHOLDS, availableRows, calcMetrics, comparePoints, formatPercent, geography, previousMetrics, rankStrongest, risk, } from '../core.js';
const levelClass = {
    'On Track': 'good', Behind: 'behind', 'At Risk': 'risk', Critical: 'critical', 'No Data': 'nodata',
};
function statusMark(level) {
    return `<span class="status-word"><i class="status-square ${levelClass[level]}"></i>${level}</span>`;
}
function fmtDelta(current, previous) {
    const delta = comparePoints(current, previous);
    return delta === null ? 'No earlier month' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pp vs previous`;
}
/** Compact bullet chart: policy bands, current marker, previous-month marker and target. */
function bullet(label, value, previous, context) {
    const clamped = Math.max(0, Math.min(100, value ?? 0));
    const leftPrev = previous === null ? '' : `<span class="bullet-prev" style="left:${Math.max(0, Math.min(100, previous))}%" title="Previous month: ${formatPercent(previous)}"></span>`;
    return `<div class="bullet-row">
    <div class="bullet-name"><strong>${label}</strong><small>${context}</small></div>
    <div class="bullet-chart-wrap"><div class="bullet-chart" role="img" aria-label="${label}: ${formatPercent(value)}, target ${THRESHOLDS.ON_TRACK} percent, previous ${formatPercent(previous)}">
      <div class="bullet-bands"><span class="seg-critical"></span><span class="seg-risk"></span><span class="seg-behind"></span><span class="seg-good"></span></div>
      <span class="bullet-actual" style="left:${clamped}%"></span>
      <span class="bullet-target" style="left:${THRESHOLDS.ON_TRACK}%" title="Target: ${THRESHOLDS.ON_TRACK}%"></span>${leftPrev}
    </div><div class="bullet-axis"><span>0</span><span>35</span><span>60</span><span>75 target</span><span>100%</span></div></div>
    <div class="bullet-figure"><strong>${formatPercent(value)}</strong><small>${fmtDelta(value, previous)}</small></div>
  </div>`;
}
function matrix(schools, f, gridMonth, focus, esc, fmt) {
    const scope = { ...f, month: gridMonth };
    const severity = { Critical: 0, 'At Risk': 1, Behind: 2, 'On Track': 3, 'No Data': 4 };
    const groups = geography(availableRows(schools, scope), 'block', f.grade, f.subject).sort((a,b) => a.name.split(' - Block ')[0].localeCompare(b.name.split(' - Block ')[0],undefined,{numeric:true}) || severity[a.risk.level] - severity[b.risk.level] || a.name.localeCompare(b.name,undefined,{numeric:true}));
    const levels = ['Critical', 'At Risk', 'Behind', 'On Track', 'No Data'];
    const counts = Object.fromEntries(levels.map(level => [level, groups.filter(g => g.risk.level === level).length]));
    const selected = focus === '__closed__' ? null : (groups.find(g => g.name === focus) || [...groups].sort((a,b)=>b.priority-a.priority)[0] || null);
    const focusedTrend = selected ? MONTHS.map(month => ({ month, geo: geography(availableRows(schools, { ...f, month }), 'block', f.grade, f.subject).find(g => g.name === focus) })) : [];
    return `<section class="register-section" aria-labelledby="block-map-title">
    <div class="register-head"><div><h2 id="block-map-title">${counts.Critical} of ${groups.length} blocks are critical in ${LABELS[gridMonth].split(" ")[0]}</h2><p>Grouped by district, with critical blocks first. Select a square for the monthly record.</p></div>
      <div class="month-switch" role="group" aria-label="Block map month">${MONTHS.map(month => `<button data-grid-month="${month}" class="${gridMonth === month ? 'selected' : ''}" aria-pressed="${gridMonth === month}">${LABELS[month].split(' ')[0]}</button>`).join('')}</div></div>
    <div class="matrix-layout"><div>
      <div class="matrix-counter"><strong>${fmt(groups.length)}</strong> blocks in view <span>· ${esc(LABELS[gridMonth])}</span></div>
      <div class="district-matrix">${[...new Set(groups.map(g => g.name.split(" - Block ")[0]))].map(district => `<div class="district-matrix-row"><strong class="district-matrix-label">${esc(district)}</strong><div class="block-grid" role="group" aria-label="${esc(district)} blocks">${groups.filter(g => g.name.startsWith(district + ' - Block ')).map(g => `<button type="button" class="block-tile ${levelClass[g.risk.level]} ${focus === g.name ? 'selected' : ''}" data-grid-block="${esc(g.name)}" aria-label="${esc(g.name)}: ${g.risk.level}, ${formatPercent(g.risk.value)} ${g.risk.name.toLowerCase()}, ${g.metrics.schools} schools" title="${esc(g.name)} • ${g.risk.level} • ${g.risk.name} ${formatPercent(g.risk.value)}"></button>`).join('')}</div></div>`).join("")}</div>
      <div class="matrix-legend">${levels.filter(l => l !== 'No Data' || counts[l] > 0).map(level => `<span><i class="status-square ${levelClass[level]}"></i>${level} <b>${counts[level]}</b></span>`).join('')}</div>
    </div><aside class="focus-panel">${selected ? `<div class="focus-top"><span>BLOCK RECORD</span><button data-action="close-block" aria-label="Close block details">×</button></div><h3>${esc(selected.name)}</h3>${statusMark(selected.risk.level)}<div class="focus-stat"><strong>${formatPercent(selected.risk.value)}</strong><small>Weakest indicator: ${esc(selected.risk.name)}</small></div><p><b>${fmt(selected.metrics.schools)}</b> schools · <b>${fmt(selected.metrics.enrollment)}</b> enrolled</p><div class="focus-timeline"><h4>Three-month attendance</h4>${focusedTrend.map(x => `<div><span>${LABELS[x.month].split(' ')[0]}</span><span class="mini-track"><i style="width:${Math.max(0, Math.min(100, x.geo?.metrics.attendanceRate ?? 0))}%"></i></span><strong>${formatPercent(x.geo?.metrics.attendanceRate ?? null)}</strong></div>`).join('')}</div><button data-focus-district="${esc(selected.name.split(' - Block ')[0])}" class="text-action">Open this district →</button>` : `<div class="focus-empty"><span class="focus-glyph">▤</span><h3>Choose a square.</h3><p>You'll see the block's status, enrollment and attendance trend here. All values come from the school records.</p></div>`}</aside></div>
  </section>`;
}
function stripPlot(districts, esc, fmt) {
    const width = 860, height = 235, pad = 60;
    const x = (v) => pad + (width - pad * 2) * Math.max(0, Math.min(100, v)) / 100;
    const bands = [
        { start: 0, end: 35, color: '#f2d8d5' }, { start: 35, end: 60, color: '#f6e1d2' },
        { start: 60, end: 75, color: '#f6e9c5' }, { start: 75, end: 100, color: '#dce9dc' },
    ];
    const graph = `<svg class="district-strip" viewBox="0 0 ${width} ${height}" role="img" aria-label="District attendance distribution from zero to one hundred percent, dot size represents school count">
    ${bands.map(b => `<rect x="${x(b.start)}" y="26" width="${x(b.end) - x(b.start)}" height="${height - 65}" fill="${b.color}"/>`).join('')}
    ${[0, 35, 60, 75, 100].map(v => `<line x1="${x(v)}" y1="26" x2="${x(v)}" y2="${height - 39}" stroke="#b6b6a9" stroke-width=".7"/><text x="${x(v)}" y="${height - 15}" text-anchor="middle" fill="#65716c" font-family="monospace" font-size="13">${v}%</text>`).join('')}
    ${districts.filter(g => g.metrics.attendanceRate !== null).map((g, i) => {
        const xx = x(g.metrics.attendanceRate), yy = 37 + (i % 7) * 23, rr = Math.max(4, Math.min(12, 3.5 + Math.sqrt(g.metrics.schools) / 1.5));
        return `<g role="button" tabindex="0" class="district-marker" data-plot-district="${esc(g.name)}" aria-label="${esc(g.name)}, attendance ${formatPercent(g.metrics.attendanceRate)}, ${g.metrics.schools} schools"><circle cx="${xx}" cy="${yy}" r="${rr + 2}" fill="transparent"/><circle cx="${xx}" cy="${yy}" r="${rr}" fill="#2b4c9b" stroke="#f3f2ec" stroke-width="2" fill-opacity=".8"><title>${esc(g.name)}: attendance ${formatPercent(g.metrics.attendanceRate)}, ${fmt(g.metrics.schools)} schools</title></circle></g>`;
    }).join('')}
  </svg>`;
    const largest = [...districts].sort((a, b) => b.metrics.schools - a.metrics.schools).slice(0, 3);
    return `<section class="register-section" aria-labelledby="district-plot-title"><div class="register-head"><div><p class="overline">Across districts</p><h2 id="district-plot-title">Where attendance stands.</h2><p>Horizontal position shows attendance; larger dots mean more schools. Select a dot to filter.</p></div><span class="section-count">${districts.length} districts</span></div><div class="strip-panel">${graph}<div class="strip-caption"><span>Below 35% · critical</span><span>35–60% · at risk</span><span>60–75% · behind</span><span>75%+ · on track</span></div><div class="strip-footnote">Largest district samples: ${largest.map(g => `${esc(g.name)} (${fmt(g.metrics.schools)})`).join(' · ')}. Small samples remain visible; strongest rankings require at least 10 schools.</div></div></section>`;
}
export function renderChalkProgram({ schools, filters: f, header, footer, selectors, esc, fmt, performanceTable, gridMonth, focusedBlock, showTable, by }) {
    const rows = availableRows(schools, f), metrics = calcMetrics(rows, f.grade, f.subject), previous = previousMetrics(schools, f), overall = risk(metrics);
    const districts = geography(rows, 'district', f.grade, f.subject), blocks = geography(rows, 'block', f.grade, f.subject);
    const strongest = rankStrongest(districts, 10), priorities = [...blocks].sort((a, b) => b.priority - a.priority).slice(0, 5);
    const underTarget = [{ label: 'participation', rate: metrics.participationRate }, { label: 'evidence', rate: metrics.evidenceRate }, { label: 'attendance', rate: metrics.attendanceRate }].filter(x => x.rate !== null && x.rate < THRESHOLDS.ON_TRACK);
    const verdict = underTarget.length === 0 ? 'All three indicators meet target.' : underTarget.length === 1 ? `${underTarget[0].label[0].toUpperCase() + underTarget[0].label.slice(1)} (${formatPercent(underTarget[0].rate)}) is the only indicator below the ${THRESHOLDS.ON_TRACK}% target.` : `${underTarget.map(x => `${x.label} ${formatPercent(x.rate)}`).join(', ')} are below the ${THRESHOLDS.ON_TRACK}% target.`;
    const first = priorities[0];
    return `${header()}<section class="paper-title"><div class="title-meta"><span>PBL / MONTHLY REGISTER</span><span>${esc(LABELS[f.month])}</span></div><h1>Program review</h1><p>Decisions from school records, not from generated claims.</p></section>
  ${selectors()}
  <section class="verdict-sheet"><div class="verdict-index">THE FINDING</div><div><div class="verdict-status">${statusMark(overall.level)} <span>· ${esc(LABELS[f.month])}</span></div><p class="verdict-sentence">${esc(verdict)}</p><p class="verdict-aside">Risk is determined by the weakest indicator. All metrics are reproducible from source attendance and school responses.</p></div></section>
  <section class="register-section bulletin" aria-labelledby="indicators-title"><div class="register-head"><div><p class="overline">01 / Measurement</p><h2 id="indicators-title">Three indicators. One target.</h2><p>Dark marker = current month; fine marker = previous month; dashed line = ${THRESHOLDS.ON_TRACK}% target.</p></div><span class="section-count">${fmt(metrics.schools)} schools</span></div>
    <div class="bullet-ledger">
    ${bullet('Participation', metrics.participationRate, previous?.participationRate ?? null, `${fmt(metrics.participating)} of ${fmt(metrics.schools)} schools`)}
    ${bullet('Evidence', metrics.evidenceRate, previous?.evidenceRate ?? null, `${fmt(metrics.evidenceCount)} schools with evidence`)}
    ${bullet('Attendance', metrics.attendanceRate, previous?.attendanceRate ?? null, `${fmt(metrics.attendance)} / ${fmt(metrics.possibleSessions)} session attendances`)}
    </div><div class="ledger-foot">${fmt(metrics.enrollment)} enrolled learners · ${fmt(metrics.attendance)} recorded attendances · one learner can attend both Math and Science sessions.</div>
  </section>
  ${matrix(schools, f, gridMonth, focusedBlock, esc, fmt)}
  ${stripPlot(districts, esc, fmt)}
  <section class="register-section action-ledger"><div class="register-head"><div><p class="overline">Where to act</p><h2>Start with these blocks.</h2><p>Priority weights the shortfall from target by enrollment, not just percentage.</p></div><button data-page="meeting" class="ink-link">Open the meeting pack →</button></div><div class="action-rows">${priorities.map((g, i) => `<button class="action-row" data-priority-block="${esc(g.name)}"><span class="action-number">${String(i + 1).padStart(2, '0')}</span><strong>${esc(g.name)}</strong>${statusMark(g.risk.level)}<span class="mono">${formatPercent(g.risk.value)}</span><span class="mono">${fmt(Math.round(g.priority))} weighted gap</span><span>→</span></button>`).join('') || '<p>No priority gaps found for this selection.</p>'}</div>
  <div class="rank-foot">${strongest.some(x => x.risk.level === 'On Track') ? 'Some districts are on track.' : 'No eligible district is on track; closest to target:'} ${strongest.slice(0, 2).map(x => `${esc(x.name)} (${formatPercent(x.risk.value)})`).join(' · ') || 'Insufficient sample sizes'}</div></section>
  <section class="register-section" aria-labelledby="full-table-title"><div class="register-head"><div><p class="overline">Reference table</p><h2 id="full-table-title">District and block register</h2><p>Search, sort and inspect the complete underlying performance table.</p></div><button data-action="toggle-table" class="outline-action" aria-expanded="${showTable}">${showTable ? 'Hide register −' : 'Show table +'}</button></div>${showTable ? `<div class="table-view-switch"><button data-by="district" class="${by === 'district' ? 'selected' : ''}">Districts</button><button data-by="block" class="${by === 'block' ? 'selected' : ''}">Blocks</button></div>${performanceTable(geography(rows, by, f.grade, f.subject))}` : ''}</section>
  <p class="methods-link">How were these figures calculated? <button data-page="quality">Read the data and methods notes →</button></p>${footer()}`;
}

import { THRESHOLDS } from "../core.js";
export function renderQualityPage({ q, finance, header, footer, fmt, esc, }) {
    const mismatches = finance.filter((x) => x.approved > 0 &&
        Math.abs((100 * x.cumulative) / x.approved - 100 * x.sourceRate) > 0.1).length;
    const notes = [
        [
            "01",
            "Survey answers conflict with session attendance",
            `${fmt(q.gradeSurveyContradictions ?? 0)} school-month responses report attendance for grades not selected in the corresponding survey answer; ${fmt(q.subjectSurveyContradictions ?? 0)} report attendance for unselected subjects. The recorded session cells are used for grade and subject filtering, and the original answers are retained.`,
        ],
        [
            "02",
            "Finance utilization does not always reconcile",
            `${fmt(mismatches)} of ${fmt(finance.length)} finance lines differ by more than 0.1 percentage points when the reported cumulative units are divided by the approved amount. The source values are displayed alongside the computed ratio; no silent rewrite occurs.`,
        ],
        [
            "03",
            "Running totals do not match source monthly spend",
            `${fmt(q.financeRunningTotalMismatch ?? 0)} reported cumulative lines disagree with the sum of monthly spending up to that month. A source correction cannot be chosen from these files alone.`,
        ],
        [
            "04",
            "Draft donor narrative is not treated as evidence",
            "The report draft column contains contradictory statements. Reports are regenerated using the fact ledger, computed school indicators, finance figures and indexed media, never by quoting the supplied donor prose.",
        ],
    ];
    return `${header()}
<section class="paper-title">
<div class="title-meta"><span>PBL / METHODOLOGY</span><span>RESEARCH NOTE • 2025 SERIES</span></div>
<h1>Data and methods</h1>
<p>What the source files say, what they do not say, and the assumptions behind every number.</p></section>
 
<section class="methods-intro">
<p class="overline">Data provenance</p>
<p>This case study uses <strong>${fmt(q.rows)} school-month responses</strong> from <strong>${fmt(q.schools)} synthetic schools</strong>, across <strong>${q.districts} districts</strong> and <strong>${q.blocks} blocks</strong> (July–September 2025). All entities, grant finances and indexed media are synthetic. No findings should be presented as real field evidence.</p></section>
 
<section class="register-section methods-list">
<div class="register-head">
<div>
<p class="overline">Four notes from the audit</p>
<h2>Where source records disagree.</h2>
<p>The discrepancies are made visible instead of being guessed away.</p></div></div>${notes
        .map(([id, name, description]) => `
<article class="method-note"><span>${id}</span>
<div>
<h3>${esc(name)}</h3>
<p>${esc(description)}</p></div></article>`)
        .join("")}</section>
 
<section class="register-section">
<div class="register-head">
<div>
<p class="overline">Metric dictionary</p>
<h2>How the programme is measured.</h2></div></div><dl class="method-definitions">
 
<div><dt>Participation</dt><dd>School-level PBL conducted = Yes / eligible schools. When a specific grade or subject is selected, recorded positive attendance is the participation proxy, not the contradictory survey answer.</dd></div>
 
<div><dt>Evidence rate</dt><dd>Schools with evidence = Yes / all eligible schools. Evidence is a school-level flag, not a grade- or subject-specific record.</dd></div>
 
<div><dt>Session attendance</dt><dd>Recorded grade × subject attendance / (selected grades' enrollment × selected subjects). Both Math and Science means two possible attendances per learner.</dd></div>
 
<div><dt>Geography status</dt><dd>Weakest of participation, evidence and attendance. On track ≥ ${THRESHOLDS.ON_TRACK}%, behind ${THRESHOLDS.BEHIND}–${THRESHOLDS.ON_TRACK}%, at risk ${THRESHOLDS.AT_RISK}–${THRESHOLDS.BEHIND}%, critical below ${THRESHOLDS.AT_RISK}%.</dd></div>
 
<div><dt>Priority</dt><dd>The gap below ${THRESHOLDS.ON_TRACK}% in the weakest indicator, multiplied by selected enrollment ÷ 100. This prioritizes larger affected populations.</dd></div>
 
<div><dt>Grant facts</dt><dd>Grant performance is recomputed from covered districts and cross-checked against the supplied grant aggregates. Budget units are not assigned an invented currency.</dd></div>
 </dl></section>
 
<section class="method-bottom">
<h3>What a real deployment would need</h3>
<p>Secure data ingestion, validation and approvals, authenticated district-scoped access, a database with immutable source history, document retention controls, and human sign-off on financial discrepancies. Optional AI wording is subordinate to the fact ledger and always falls back to deterministic text.</p>
<p class="micro-note">See the README for import commands, formulas, test coverage, production architecture and limitations.</p></section>${footer()}`;
}

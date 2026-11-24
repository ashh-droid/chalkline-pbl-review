/** Grant report displayed as an annotated document, not a generic dashboard. */
import { formatPercent, MONTHS, LABELS, type Filters, type Level } from '../core.js';
import type { GrantSource, GrantReport } from '../grant.js';
interface GrantPageContext {
    grantRows: GrantSource[];
    selectedGrant: string;
    f: Filters;
    gr: GrantReport;
    header: () => string;
    footer: () => string;
    opt: (value: string, label: string, selected: string) => string;
    fmt: (value: number) => string;
    esc: (value: unknown) => string;
    pill: (value: Level) => string;
    showMedia: boolean;
    showSources: boolean;
    aiRequested: boolean;
    aiOutput: string | null;
    aiStatus: string;
    renderCitations: (p: string) => string;
}
export function renderGrantPage({ grantRows, selectedGrant, f, gr, header, footer, opt, fmt, esc, pill, showMedia, showSources, aiRequested, aiOutput, aiStatus, renderCitations }: GrantPageContext): string {
    const opts = Array.from(new Map(grantRows.map(x => [x.grant_id, x.grant_name])).entries());
    const m = gr.metrics;
    const util = gr.financeTotals.derivedUtilization;
    const periodEnded = f.month >= gr.source.period_end_date.slice(0, 7);
    const sourceText = (aiOutput && aiRequested) ? aiOutput : gr.narrative;
    const label = aiOutput && aiRequested ? 'AI wording, structure and numbers checked' : aiRequested ? 'Deterministic fallback' : 'Deterministic narrative · AI off';
    return `${header()}
<section class="paper-title">
<div class="title-meta"><span>PBL / GRANT REPORTING</span><span>ANNOTATED DOCUMENT</span></div>
<h1>Grant reporting</h1>
<p>Calculated figures at left. Report wording at right. Every claim has a source.</p></section>
 
<section class="grant-selector">
<label>Choose grant<select data-grant="true">${opts.map(([k, v]) => opt(k, v, selectedGrant)).join('')}</select></label>
<label>Reporting period<select data-filter="month">${MONTHS.map(month => opt(month, LABELS[month], f.month)).join('')}</select></label><span>ALL FACTS FROM SOURCE DATA · AI OPTIONAL</span></section>
 
<section class="grant-lead">
<div>
<p class="overline">${esc(gr.source.grant_id)} / ${esc(LABELS[f.month])}</p>
<h2>${esc(gr.source.grant_name)}</h2>
<p>${esc(gr.districts.join(' · '))}</p></div>
<div class="grant-meta"><span>${pill(gr.risk.level)}</span><small>${gr.verification.ok ? '✓ School counts reconciled with source' : '! Source counts differ'}</small></div></section>
 
<section class="grant-observation" aria-label="Grant performance overview">
 
<div><small>Participation</small><strong>${formatPercent(m.participationRate)}</strong><span>${fmt(m.participating)} / ${fmt(m.schools)} schools</span></div>
 
<div><small>Evidence</small><strong>${formatPercent(m.evidenceRate)}</strong><span>${fmt(m.evidenceCount)} schools</span></div>
 
<div><small>Session attendance</small><strong>${formatPercent(m.attendanceRate)}</strong><span>${fmt(m.attendance)} recorded</span></div>
 
<div><small>Reported budget utilized</small><strong>${util.toFixed(1)}%</strong><span>Approved ${fmt(gr.financeTotals.approved)} units</span></div>
 </section>
 
<div class="grant-warningline ${gr.warnings.length ? 'warn' : ''}"><strong>${gr.warnings.length ? 'Reconciliation needs attention' : 'Performance figures reconciled'}</strong><span>${gr.warnings.length ? `${gr.warnings.length} finance/source warnings; original published figures preserved.` : 'No mismatches in checked source totals.'} ${periodEnded ? `The grant period ended ${esc(gr.source.period_end_date)}; ${(100 - util).toFixed(1)} percentage points remain below full reported utilization.` : `Grant period ends ${esc(gr.source.period_end_date)}.`}</span></div>
 
<section class="register-section grant-document">
<div class="register-head">
<div>
<p class="overline">Review-ready material</p>
<h2>The report, with its footnotes.</h2>
<p>Move over a citation to find its matching fact. Click to open the full fact.</p></div>
<div class="narrative-modes" role="group" aria-label="Narrative generation mode"><button data-action="ai-off" class="${!aiRequested ? 'active' : ''}" aria-pressed="${!aiRequested}">AI off</button><button data-action="ai-on" class="${aiRequested ? 'active' : ''}" aria-pressed="${aiRequested}">Optional AI</button></div></div>
 
<div class="narrative-status"><span class="small-square ${aiOutput && aiRequested ? 'good' : 'behind'}"></span><strong>${label}</strong><span>${esc(aiStatus)}</span></div>
 
<div class="document-columns">
<div class="report-paper">
<div class="report-paper-head"><span class="report-brand"><img src="brand/chalkline-wordmark-light.svg" alt="Chalkline" width="111" height="24"/> MONTHLY REPORT DRAFT</span><span>${esc(LABELS[f.month])}</span></div>
<h3>${esc(gr.source.grant_name)}</h3>${sourceText.split('\n\n').map(p => `
<p>${renderCitations(p)}</p>`).join('')}
<div class="report-legal">Synthetic demonstration material. Reports require human review before operational use.</div>
<div class="report-actions"><button data-action="copy-grant" class="solid-action">Copy report</button><button data-action="download-grant" class="outline-action">Export Markdown</button><button data-action="print" class="outline-action">Print / PDF</button></div></div>
 <aside class="fact-margin">
<div class="fact-margin-heading"><span>THE FACT MARGIN</span><button data-action="toggle-sources">${showSources ? 'Show fewer' : 'Show all'} ${showSources ? '−' : '+'}</button></div>${gr.facts.slice(0, showSources ? 99 : 8).map(x => `
<div class="margin-fact" id="fact-${esc(x.id)}"><span class="fact-id">${esc(x.id)}</span>
<div><strong>${esc(x.label)}</strong>
<p>${esc(x.value)}</p><small>${esc(x.source)}</small></div></div>`).join('')}${!showSources ? `
<p class="micro-note">${gr.facts.length - 8} more facts available.</p>` : ''}</aside></div>
 </section>
 
<section class="register-section finance-ledger">
<div class="register-head">
<div>
<p class="overline">Finance register</p>
<h2>Budget use, by line.</h2>
<p>Figures are budget units, not a named currency. Published cumulative amounts are preserved.</p></div><strong class="finance-total">${util.toFixed(1)}% utilized</strong></div>
<div class="finance-rows">
<div class="finance-headers"><span>Budget line</span><span>Reported spend</span><span>Used / approved</span><span>Source check</span></div>${gr.finance.map(x => `
<div class="finance-row">
<div><strong>${esc(x.budget_line)}</strong><small>${fmt(x.monthly)} units this month</small></div><span class="mono">${fmt(x.cumulative)} / ${fmt(x.approved)}</span>
<div><strong class="mono">${x.utilization.toFixed(1)}%</strong>
<div class="finance-track"><i style="width:${Math.max(0, Math.min(100, x.utilization))}%"></i><span style="left:100%"></span></div></div><span class="${x.rateMismatch || x.cumulativeMismatch ? 'flagged' : 'ok'}">${x.rateMismatch || x.cumulativeMismatch ? '! Check source' : '✓ Reconciled'}</span></div>`).join('')}
<div class="finance-row finance-footer"><strong>TOTAL</strong><span class="mono">${fmt(gr.financeTotals.reportedCumulative)} / ${fmt(gr.financeTotals.approved)}</span><strong>${util.toFixed(1)}%</strong><span>${periodEnded ? `${fmt(gr.financeTotals.approved - gr.financeTotals.reportedCumulative)} units not reported as utilized` : 'Within reporting period'}</span></div></div>
 ${gr.warnings.length ? `<details class="finance-discrepancies"><summary>View ${gr.warnings.length} finance/source discrepancies</summary>
<ul>${gr.warnings.map(w => `
<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}</section>
 
<section class="register-section grant-milestones">
<div class="register-head">
<div>
<p class="overline">Milestones</p>
<h2>What the source records.</h2></div></div>
<div class="milestone-list">${gr.milestones.map(x => `
<div><strong>${esc(x.name)}</strong><span>${esc(x.owner)}</span><em>${esc(x.status)}</em></div>`).join('')}</div></section>
 
<section class="register-section">
<div class="register-head">
<div>
<p class="overline">Evidence index</p>
<h2>Linked synthetic material.</h2>
<p>Only items indexed to this grant and reporting month appear here.</p></div><button data-action="toggle-media" class="outline-action">${showMedia ? 'Hide images' : 'Show images'}</button></div>${showMedia ? (gr.assets.length ? `
<div class="evidence-grid">${gr.assets.map(x => `<figure><img loading="lazy" src="${esc(x.url)}" alt="${esc(x.summary_or_caption)}"/><figcaption><strong>${esc(x.title)}</strong><small>${esc(x.record_id)} · ${esc(x.district)} · SYNTHETIC</small>
<p>${esc(x.summary_or_caption)}</p></figcaption></figure>`).join('')}</div>` : '<p class="no-evidence">No media is indexed for this grant and month. None has been invented.</p>') : ''}</section>${footer()}`;
}


/** Printable monthly meeting agenda assembled from deterministic review facts. */
import { formatPercent, LABELS, } from "../core.js";
export function renderMeetingPage({ f, r, header, selectors, footer, esc, fmt, pill, statusClass, grant, }) {
    const agenda = [
        ["01", "5 min", "Wins & progress"],
        ["02", "5 min", "Changes since last month"],
        ["03", "15 min", "Where to act"],
        ["04", "5 min", "Grant and evidence check"],
        ["05", "5 min", "Decisions, owners and dates"],
    ];
    const totalBlocks = (x) => Object.values(x.counts).reduce((n, v) => n + v, 0);
    return `${header()}
<section class="paper-title">
<div class="title-meta"><span>PBL / MEETING NOTES</span><span>${esc(LABELS[f.month])}</span></div>
<h1>Monthly meeting pack</h1>
<p>A printable agenda with facts, proposed next steps and open questions.</p></section>${selectors()}
 
<div class="meeting-actions"><span>${pill(r.overall.level)} · ${esc(r.overall.name)} ${formatPercent(r.overall.value)} is the weakest indicator</span>
<div><button data-action="copy-review" class="outline-action">Copy notes</button><button data-action="download-review" class="outline-action">Export Markdown</button><button data-action="print" class="solid-action">Print / PDF ↗</button></div></div>
 
<section class="meeting-sheet" id="print-sheet">
 
<div class="sheet-heading">
<div>
<p class="overline">Monthly school programme review</p>
<h2>${esc(LABELS[f.month])}</h2>
<p>${esc(f.district || "All districts")} · ${esc(f.block || "All blocks")} · ${f.grade === "all" ? "Classes 6–8" : `Class ${f.grade}`} · ${f.subject === "all" ? "Math + Science" : esc(f.subject)}</p></div>
<div class="sheet-stamp">REVIEW COPY<br/><strong>35 MIN</strong></div></div>
 
<div class="agenda-strip">${agenda
        .map(([n, t, label]) => `
<div><small>${n} / ${t}</small><strong>${label}</strong></div>`)
        .join("")}</div>
 
<div class="meeting-columns">
 
<section class="agenda-item"><span class="agenda-num">01 <em>5 minutes</em></span>
<h3>Wins worth noting</h3>
<ul>${r.achievements
        .map((x) => `
<li>${esc(x)}</li>`)
        .join("")}</ul></section>
 
<section class="agenda-item"><span class="agenda-num">02 <em>5 minutes</em></span>
<h3>What moved</h3>
<table class="paper-table change-table">
<thead>
<tr>
<th>Measure</th>
<th>Previous</th>
<th>Now</th>
<th>Change</th></tr></thead>
<tbody>${r.changes
        .map((x) => `
<tr>
<td>${esc(x.label)}</td>
<td>${formatPercent(x.previous)}</td>
<td><b>${formatPercent(x.current)}</b></td>
<td>${x.delta === null ? "—" : `${x.delta >= 0 ? "+" : "−"}${Math.abs(x.delta).toFixed(1)} pp`}</td></tr>`)
        .join("")}</tbody></table>
<p class="micro-note">Percentage-point changes, not relative percent changes.</p></section>
 
<section class="agenda-item"><span class="agenda-num">03 <em>15 minutes</em></span>
<h3>Where to act first</h3>
<div class="priority-pair">
<div>
<h4>Priority districts</h4>${r.priorityDistricts
        .slice(0, 3)
        .map((x) => `
<div class="agenda-place"><strong>${esc(x.name)}</strong><span>${formatPercent(x.risk.value)} ${esc(x.risk.name.toLowerCase())}</span></div>`)
        .join("")}</div>
<div>
<h4>Priority blocks</h4>${r.priorityBlocks
        .slice(0, 3)
        .map((x) => `
<div class="agenda-place"><strong>${esc(x.name)}</strong><span>${formatPercent(x.risk.value)} · ${fmt(x.metrics.enrollment)} enrolled</span></div>`)
        .join("")}</div></div></section>
 
<section class="agenda-item"><span class="agenda-num">04 <em>5 minutes</em></span>
<h3>Grant & evidence check</h3>
<p>Verify finance reconciliation flags and the supporting evidence before donor reporting. View grant details in the separate <button class="inline-text-link" data-page="grants">grant reporting register ↗</button>.</p>
<div class="grant-agenda-summary"><p><strong>${esc(grant.source.grant_name)}</strong> · ${pill(grant.risk.level)}</p>
 <p><b>${fmt(grant.financeTotals.reportedCumulative)}</b> of <b>${fmt(grant.financeTotals.approved)}</b> reported budget units utilized (${grant.financeTotals.derivedUtilization.toFixed(1)}%).</p>
 <p>${grant.warnings.length} source/finance warnings need checking. ${fmt(Math.max(0, grant.financeTotals.approved - grant.financeTotals.reportedCumulative))} units not reported as utilized.</p>
 <p class="micro-note">Source records are synthetic. Finance differences are verification flags, not confirmed misuse.</p></div></section>
 </div>
 
<section class="agenda-item agenda-actions"><span class="agenda-num">05 <em>5 minutes</em></span>
<h3>Decisions, owners and dates</h3>
<p class="micro-note">These are rule-generated proposals, not confirmed assignments.</p>
<div class="action-table-wrap">
<table class="paper-table actions-table">
<thead>
<tr>
<th>Next action</th>
<th>Proposed owner</th>
<th>Priority</th>
<th>Due</th></tr></thead>
<tbody>${r.actions
        .map((x) => `
<tr>
<td>${esc(x.action)}<small>${esc(x.linkedMetric)}</small></td>
<td>${esc(x.owner)}</td>
<td>${esc(x.priority)}</td>
<td>${esc(new Date(x.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}</td></tr>`)
        .join("")}</tbody></table></div></section>
 
<section class="agenda-item prompt-sheet">
<h3>Questions for the room</h3>
<ol>${r.prompts
        .map((x) => `
<li>${esc(x)}</li>`)
        .join("")}</ol></section>
 
<div class="sheet-footer"><span class="sheet-footer-brand"><img src="brand/chalkline-wordmark-light.svg" alt="Chalkline" width="108" height="23"/> CHALKLINE CASE STUDY · SYNTHETIC</span><span>Page 1 / meeting pack</span></div>
 </section>${footer()}`;
}

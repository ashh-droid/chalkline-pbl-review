/** Concise two-job view: monthly decisions first, details on demand. */
import {
  MONTHS, LABELS, THRESHOLDS, availableRows, calcMetrics, comparePoints,
  formatPercent, geography, previousMetrics, risk, riskLevel,
  type Filters, type GeoRow, type SchoolRow, type Level
} from "../core.js";

interface ThisMonthContext {
  schools: SchoolRow[];
  filters: Filters;
  header: () => string;
  footer: () => string;
  esc: (value: unknown) => string;
  fmt: (n: number) => string;
  focusedBlock: string | null;
  methodOpen: boolean;
  showDistrictTable: boolean;
}
const levels: Level[] = ["Critical", "At Risk", "Behind", "On Track", "No Data"];
const statusClass: Record<Level, string> = {
  Critical: "critical", "At Risk": "risk", Behind: "behind",
  "On Track": "good", "No Data": "nodata"
};
const safeWidth = (rate: number | null) => Math.max(0, Math.min(100, rate ?? 0));
const shortMonth = (month: string) => LABELS[month as keyof typeof LABELS].split(" ")[0];

function metricTile(
  label: string, value: number | null, previous: number | null, scope: string,
): string {
  const difference = comparePoints(value, previous);
  const targetDelta = value === null ? null : value - THRESHOLDS.ON_TRACK;
  const comparison = difference === null ? "No earlier comparison" :
    `${difference > 0 ? "+" : difference < 0 ? "−" : ""}${Math.abs(difference).toFixed(1)} points since last month`;
  const explanation = targetDelta === null ? "No eligible records" :
    targetDelta < 0 ? `${Math.abs(targetDelta).toFixed(1)} points short of target` :
    `${targetDelta.toFixed(1)} points above the target`;
  return `<article class="month-metric">
    <div class="month-metric-label">${label}<button class="info-trigger" data-action="open-methods" aria-label="How is ${label.toLowerCase()} calculated?">ⓘ</button></div>
    <strong class="month-metric-value">${formatPercent(value)}</strong>
    <div class="month-metric-change">${comparison}</div>
    <div class="month-meter" role="img" aria-label="${label} ${formatPercent(value)}, target 75 percent">
      <span class="month-meter-bar ${statusClass[riskLevel(value)]}" style="width:${safeWidth(value)}%"></span>
      <span class="month-meter-target" aria-hidden="true"></span>
    </div>
    <p>${explanation} <span>· ${scope}</span></p>
  </article>`;
}
function blockHistory(
  schools: SchoolRow[], f: Filters, selected: GeoRow, esc: ThisMonthContext["esc"], fmt: ThisMonthContext["fmt"]
): string {
  const district=selected.name.split(" - Block ")[0];
  const history=MONTHS.map(month=>{
    const data=geography(availableRows(schools,{...f,month,district,block:selected.name}),"block",f.grade,f.subject)[0];
    return {month, data};
  });
  return `<div class="record-overlay" data-action="close-block" aria-hidden="true"></div>
    <aside class="record-drawer" role="dialog" aria-modal="true" aria-labelledby="record-title">
      <div class="drawer-top"><span>Block record</span><button class="drawer-close" data-action="close-block" aria-label="Close block record">×</button></div>
      <h2 id="record-title">${esc(selected.name)}</h2>
      <p class="record-status"><i class="status-square ${statusClass[selected.risk.level]}"></i>${selected.risk.level}</p>
      <strong class="record-number">${formatPercent(selected.risk.value)}</strong>
      <p>Weakest measure: ${esc(selected.risk.name)} · ${fmt(selected.metrics.schools)} schools · ${fmt(selected.metrics.enrollment)} learners</p>
      <h3>Three-month attendance</h3>
      <div class="record-attendance">${history.map(({month,data})=>`
        <div class="record-attendance-row">
          <span>${shortMonth(month)}</span>
          <div class="record-track"><i style="width:${safeWidth(data?.metrics.attendanceRate ?? null)}%"></i></div>
          <strong>${formatPercent(data?.metrics.attendanceRate ?? null)}</strong>
        </div>`).join("")}</div>
      <h3>Monthly measures</h3>
      <div class="table-wrap"><table class="record-table"><thead><tr><th>Month</th><th>Participation</th><th>Evidence</th><th>Attendance</th></tr></thead>
       <tbody>${history.map(({month,data})=>`<tr><th scope="row">${shortMonth(month)}</th>
         ${[data?.metrics.participationRate,data?.metrics.evidenceRate,data?.metrics.attendanceRate].map(v=>`<td class="record-cell ${statusClass[riskLevel(v ?? null)]}">${formatPercent(v ?? null)}</td>`).join("")}
       </tr>`).join("")}</tbody></table></div>
      <p class="drawer-note">Shading follows the 75% target. All figures come from synthetic school response records.</p>
      <button data-focus-district="${esc(district)}" class="drawer-district-link">View ${esc(district)} in the district list ↗</button>
    </aside>`;
}
function methodsDrawer(): string {
  return `<div class="record-overlay" data-action="close-methods" aria-hidden="true"></div>
    <aside class="record-drawer methods-drawer" role="dialog" aria-modal="true" aria-labelledby="methods-title">
      <div class="drawer-top"><span>Data notes</span><button class="drawer-close" data-action="close-methods" aria-label="Close calculation notes">×</button></div>
      <h2 id="methods-title">How is this calculated?</h2>
      <dl>
        <dt>Participation</dt><dd>Schools recording PBL activity divided by eligible schools. With class or subject filters, positive session attendance is the documented activity proxy.</dd>
        <dt>Evidence</dt><dd>Eligible schools with an evidence flag divided by eligible schools.</dd>
        <dt>Attendance</dt><dd>Recorded session attendances divided by available session places for the chosen class and subjects. Each learner may attend both Math and Science.</dd>
        <dt>Status</dt><dd>Based on the lowest of the three measures: on track at 75% or above; behind 60–74.9%; at risk 35–59.9%; critical below 35%.</dd>
        <dt>Priority order</dt><dd>Measured percentage-point shortfall below 75%, multiplied by the number of enrolled learners. This is a ranking measure, not a count of absent learners.</dd>
      </dl>
      <p>Source records and recalculations use the supplied synthetic school and grant dataset. Missing denominators show as unavailable, not zero.</p>
      <a href="https://github.com/ashh-droid/chalkline-pbl-review#data-quality-is-visible" target="_blank" rel="noopener noreferrer">Read the source and data-quality documentation ↗</a>
    </aside>`;
}
export function renderThisMonth({
  schools, filters:f, header, footer, esc, fmt, focusedBlock, methodOpen, showDistrictTable
}: ThisMonthContext): string {
  const scoped=availableRows(schools,f);
  const metrics=calcMetrics(scoped,f.grade,f.subject);
  const previous=previousMetrics(schools,f);
  const overall=risk(metrics);
  const indicators=[
    ["Participation",metrics.participationRate,previous?.participationRate ?? null,`${fmt(metrics.participating)} of ${fmt(metrics.schools)} schools`],
    ["Evidence",metrics.evidenceRate,previous?.evidenceRate ?? null,`${fmt(metrics.evidenceCount)} schools`],
    ["Attendance",metrics.attendanceRate,previous?.attendanceRate ?? null,`${fmt(metrics.attendance)} session attendances`],
  ] as const;
  const needs=indicators.filter(item=>item[1]!==null && item[1]<THRESHOLDS.ON_TRACK);
  const measureSummary=needs.length===0 ? "All three measures meet the 75% target" :
    needs.length===1 ? `${needs[0][0]} is the only measure below target` :
    `${needs.map(item=>item[0].toLowerCase()).join(", ")} are below target`;
  const monthlyStatus=MONTHS.map(month=>{
    const blocks=geography(availableRows(schools,{...f,month}),"block",f.grade,f.subject);
    const counts=levels.map(level=>blocks.filter(b=>b.risk.level===level).length);
    return {month,counts,total:blocks.length};
  });
  const first=monthlyStatus[0].counts[0], now=monthlyStatus[MONTHS.indexOf(f.month)].counts[0];
  const criticalStory=f.month===MONTHS[0] ? `${now} blocks are critical in July` :
    first>now ? `critical blocks fell from ${first} to ${now} since July` :
    now>first ? `critical blocks rose from ${first} to ${now} since July` :
    `critical blocks stayed at ${now} since July`;
  const districts=geography(scoped,"district",f.grade,f.subject).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  const blocks=geography(scoped,"block",f.grade,f.subject);
  const byDistrict=new Map<string,GeoRow[]>();
  for(const b of blocks){
    const d=b.name.split(" - Block ")[0];
    if(!byDistrict.has(d))byDistrict.set(d,[]);
    byDistrict.get(d)!.push(b);
  }
  for(const districtBlocks of byDistrict.values())districtBlocks.sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name,undefined,{numeric:true}));
  const priorities=[...blocks].filter(b=>b.priority>0).sort((a,b)=>b.priority-a.priority).slice(0,5);
  const selected=focusedBlock ? blocks.find(b=>b.name===focusedBlock) : null;
  const chips=[f.grade!=="all" ? `Class ${f.grade}`:"",f.subject!=="all" ? (f.subject==="math"?"Math":"Science"):"",f.block||""].filter(Boolean);
  return `${header()}
   <div class="month-content">
     <section class="month-summary" aria-label="Current programme status">
       <div class="month-status-line"><span class="month-status ${statusClass[overall.level]}"><i></i>${overall.level}</span><span>${esc(f.district || "All districts")} · ${shortMonth(f.month)} 2025</span></div>
       <div class="month-lead"><h1>${esc(measureSummary)}; ${esc(criticalStory)}.</h1>
         <button class="print-action" data-action="print-meeting" type="button">Print meeting pack <span aria-hidden="true">↗</span></button>
       </div>
       <div class="summary-subline"><span>${fmt(metrics.schools)} schools · ${fmt(metrics.enrollment)} learners</span>
         <button class="info-link" data-action="open-methods" aria-label="Read how these results are calculated">ⓘ How is this calculated?</button></div>
       ${chips.length?`<div class="active-filters" aria-label="Active filters">${chips.map((c,i)=>`<button data-remove-filter="${i===0&&f.grade!=="all"?"grade":i===0||i===1&&f.grade!=="all"?"subject":"block"}">${esc(c)} ×</button>`).join("")}</div>`:""}
     </section>
     <section class="month-metrics" aria-label="Three programme measures">
        ${indicators.map(item=>metricTile(...item)).join("")}
     </section>
     <div class="month-card-grid">
       <section class="month-card act-card" aria-labelledby="act-heading">
         <div class="month-card-heading"><h2 id="act-heading">Where should we act first?</h2><span>Ranked by shortfall and learners</span></div>
         <div class="top-blocks">${priorities.length ? priorities.map((b,i)=>`
           <button data-open-block="${esc(b.name)}" class="priority-mini-row">
             <span class="priority-index">${String(i+1).padStart(2,"0")}</span>
             <strong>${esc(b.name)}</strong>
             <span class="priority-stats">${formatPercent(b.metrics.attendanceRate)} attendance <small>· ${fmt(b.metrics.enrollment)} learners</small></span>
             <span aria-hidden="true">↗</span>
           </button>`).join("") : "<p>No blocks below target in this selection.</p>"}</div>
       </section>
       <section class="month-card movement-card" aria-labelledby="movement-heading">
         <div class="month-card-heading"><h2 id="movement-heading">How have blocks changed since July?</h2></div>
         <div class="status-stacks">${monthlyStatus.map(({month,counts,total})=>`
           <div class="status-stack-row"><strong>${shortMonth(month)}</strong>
             <div class="stack-bar" role="img" aria-label="${shortMonth(month)}: ${levels.map((level,i)=>`${counts[i]} ${level.toLowerCase()}`).join(", ")}">
               ${counts.map((count,i)=>`<span class="stack-segment ${statusClass[levels[i]]}" style="width:${total?100*count/total:0}%" title="${levels[i]}: ${count} blocks"></span>`).join("")}
             </div><b>${counts[0]} critical</b>
           </div>`).join("")}</div>
         <p class="movement-note">${first>now ? `${first-now} fewer critical blocks` : now>first ? `${now-first} more critical blocks` : "No change in critical block count"} between July and ${shortMonth(f.month)} in the selected area.</p>
         <div class="stack-key" aria-label="Status colours">${levels.slice(0,4).map(level=>`<span><i class="status-square ${statusClass[level]}"></i>${level}</span>`).join("")}</div>
       </section>
     </div>
     <section class="district-register" aria-labelledby="district-title">
        <div class="district-header"><div><h2 id="district-title">${f.district ? "Blocks in "+esc(f.district) : "All districts"}</h2><p>Select a district to see its blocks. Colours show the weakest measure.</p></div>
          <div class="district-data-actions"><button data-action="toggle-district-table" aria-pressed="${showDistrictTable}">${showDistrictTable?"List":"Table"}</button><span>·</span><button data-chart-export="all-blocks">CSV ↓</button></div></div>
        ${showDistrictTable ? `<div class="table-wrap"><table class="district-data-table"><thead><tr><th scope="col">District</th><th scope="col">Schools</th><th scope="col">Learners</th><th scope="col">Attendance</th><th scope="col">Status</th></tr></thead><tbody>
          ${districts.map(d=>`<tr><th scope="row">${esc(d.name)}</th><td>${fmt(d.metrics.schools)}</td><td>${fmt(d.metrics.enrollment)}</td><td>${formatPercent(d.metrics.attendanceRate)}</td><td>${d.risk.level}</td></tr>`).join("")}</tbody></table></div>` :
        `<div class="district-list">${districts.map(d=>{
          const items=byDistrict.get(d.name)||[];
          return `<details class="district-entry"><summary><span class="district-name">${esc(d.name)}</span>
            <span class="district-squares" aria-label="${items.length} blocks; ${items.filter(b=>b.risk.level==="Critical").length} critical">
              ${items.map(b=>`<i class="district-square ${statusClass[b.risk.level]}" title="${esc(b.name)}: ${b.risk.level}"></i>`).join("")}
            </span><span class="district-attendance">${formatPercent(d.metrics.attendanceRate)}</span><span class="district-schools">${fmt(d.metrics.schools)} schools</span>
            <span class="district-chevron" aria-hidden="true">⌄</span></summary>
            <div class="district-block-items">${items.map(b=>`<button class="district-block" data-open-block="${esc(b.name)}"><span class="status-square ${statusClass[b.risk.level]}"></span>
              <strong>${esc(b.name)}</strong><span>${formatPercent(b.metrics.attendanceRate)} attendance</span><span>${fmt(b.metrics.enrollment)} learners</span><span aria-hidden="true">↗</span></button>`).join("")}</div>
          </details>`;
        }).join("")}</div>`}
     </section>
   </div>${footer()}
   ${selected ? blockHistory(schools,f,selected,esc,fmt):""}
   ${methodOpen ? methodsDrawer() : ""}`;
}

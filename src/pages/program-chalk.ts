/** Chalkline program page. Visualizations use only metrics from the deterministic core. */
import {
  MONTHS,
  LABELS,
  THRESHOLDS,
  availableRows,
  calcMetrics,
  comparePoints,
  formatPercent,
  geography,
  previousMetrics,
  rankStrongest,
  risk,
  riskLevel,
  trend,
  type SchoolRow,
  type Filters,
  type GeoRow,
  type Metrics,
  type Month,
  type Level,
} from "../core.js";
interface ProgramContext {
  schools: SchoolRow[];
  filters: Filters;
  header: () => string;
  footer: () => string;
  selectors: () => string;
  esc: (value: unknown) => string;
  fmt: (n: number) => string;
  performanceTable: (rows: GeoRow[]) => string;
  gridMonth: Month;
  focusedBlock: string | null;
  showTable: boolean;
  by: "district" | "block";
  gridView: string;
  plotView: string;
}
const levelClass: Record<Level, string> = {
  "On Track": "good",
  Behind: "behind",
  "At Risk": "risk",
  Critical: "critical",
  "No Data": "nodata",
};
function statusMark(level: Level): string {
  return `<span class="status-word"><i class="status-square ${levelClass[level]}"></i>${level}</span>`;
}
function fmtDelta(current: number | null, previous: number | null): string {
  const delta = comparePoints(current, previous);
  return delta === null
    ? "No earlier month"
    : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} pp vs previous`;
}
/** Compact bullet chart: policy bands, current marker, previous-month marker and target. */
function bullet(
  label: string,
  value: number | null,
  previous: number | null,
  context: string,
): string {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const leftPrev =
    previous === null
      ? ""
      : `<span class="bullet-prev" style="left:${Math.max(0, Math.min(100, previous))}%" title="Previous month: ${formatPercent(previous)}"></span>`;
  return `<div class="bullet-row">
    <div class="bullet-name"><strong>${label}</strong><small>${context}</small></div>
    <div class="bullet-chart-wrap"><div class="bullet-chart" role="img" aria-label="${label}: ${formatPercent(value)}, target ${THRESHOLDS.ON_TRACK} percent, previous ${formatPercent(previous)}">
      <div class="bullet-bands"><span class="seg-critical"></span><span class="seg-risk"></span><span class="seg-behind"></span><span class="seg-good"></span></div>
      <span class="bullet-actual" style="left:${clamped}%"></span>
      <span class="bullet-target" style="left:${THRESHOLDS.ON_TRACK}%" title="Target: ${THRESHOLDS.ON_TRACK}%"></span>${leftPrev}
    </div><div class="bullet-axis"><span>0</span><span>35</span><span>60</span><span>75%</span><span>100%</span></div></div>
    <div class="bullet-figure"><strong>${formatPercent(value)}</strong><small>${fmtDelta(value, previous)}</small><small class="bullet-takeaway">${value === null ? "No recorded measure" : value < THRESHOLDS.ON_TRACK ? `${(THRESHOLDS.ON_TRACK - value).toFixed(1)} points short of target` : `${(value - THRESHOLDS.ON_TRACK).toFixed(1)} points above target`}</small></div>
  </div>`;
}
function matrix(
  schools: SchoolRow[],
  f: Filters,
  gridMonth: Month,
  focus: string | null,
  esc: ProgramContext["esc"],
  fmt: ProgramContext["fmt"],
): string {
  const scope = { ...f, month: gridMonth };
  const severity = {
    Critical: 0,
    "At Risk": 1,
    Behind: 2,
    "On Track": 3,
    "No Data": 4,
  };
  const groups = geography(
    availableRows(schools, scope),
    "block",
    f.grade,
    f.subject,
  ).sort(
    (a, b) =>
      a.name
        .split(" - Block ")[0]
        .localeCompare(b.name.split(" - Block ")[0], undefined, {
          numeric: true,
        }) ||
      severity[a.risk.level] - severity[b.risk.level] ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const levels: Level[] = [
    "Critical",
    "At Risk",
    "Behind",
    "On Track",
    "No Data",
  ];
  const counts = Object.fromEntries(
    levels.map((level) => [
      level,
      groups.filter((g) => g.risk.level === level).length,
    ]),
  );
  const selected =
    focus === "__closed__"
      ? null
      : groups.find((g) => g.name === focus) ||
        [...groups].sort((a, b) => b.priority - a.priority)[0] ||
        null;
  const focusedTrend = selected
    ? MONTHS.map((month) => ({
        month,
        geo: geography(
          availableRows(schools, {
            ...f,
            month,
            district: selected.name.split(" - Block ")[0],
            block: selected.name,
          }),
          "block",
          f.grade,
          f.subject,
        ).find((g) => g.name === selected.name),
      }))
    : [];
  const registerIndicators = [
    { label: "Participation", key: "participationRate" },
    { label: "Evidence", key: "evidenceRate" },
    { label: "Attendance", key: "attendanceRate" },
  ] as const;
  const registerRows = registerIndicators
    .map(
      (indicator) =>
        `<tr><th scope="row">${indicator.label}</th>${focusedTrend
          .map((x) => {
            const value = x.geo?.metrics[indicator.key] ?? null;
            return `<td><span aria-label="${indicator.label} for ${LABELS[x.month]}: ${formatPercent(value)}" title="${formatPercent(value)}" class="register-mark ${value === null ? "nodata" : value >= THRESHOLDS.ON_TRACK ? "good" : "critical"}">${value === null ? "—" : value >= THRESHOLDS.ON_TRACK ? "✓" : "×"}</span></td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="register-section" aria-labelledby="block-map-title">
    <div class="register-head"><div><h2 id="block-map-title">${counts.Critical} of ${groups.length} blocks are critical in ${LABELS[gridMonth].split(" ")[0]}</h2><p>Grouped by district, with critical blocks first. Select a square for the monthly record.</p></div>
      <div class="month-switch" role="group" aria-label="Block map month">${MONTHS.map((month) => `<button data-grid-month="${month}" class="${gridMonth === month ? "selected" : ""}" aria-pressed="${gridMonth === month}">${LABELS[month].split(" ")[0]}</button>`).join("")}</div></div>
    <div class="matrix-layout"><div>
      <div class="matrix-counter"><strong>${fmt(groups.length)}</strong> blocks in view <span>· ${esc(LABELS[gridMonth])}</span></div>
      <div class="district-matrix">${[
        ...new Set(groups.map((g) => g.name.split(" - Block ")[0])),
      ]
        .map(
          (district) =>
            `<div class="district-matrix-row"><strong class="district-matrix-label">${esc(district)}</strong><div class="block-grid" role="group" aria-label="${esc(district)} blocks">${groups
              .filter((g) => g.name.startsWith(district + " - Block "))
              .map(
                (g) =>
                  `<button type="button" class="block-tile ${levelClass[g.risk.level]} ${focus === g.name ? "selected" : ""}" data-grid-block="${esc(g.name)}" aria-label="${esc(g.name)}: ${g.risk.level}, ${formatPercent(g.risk.value)} ${g.risk.name.toLowerCase()}, ${g.metrics.schools} schools" title="${esc(g.name)} • ${g.risk.level} • ${g.risk.name} ${formatPercent(g.risk.value)}"></button>`,
              )
              .join("")}</div></div>`,
        )
        .join("")}</div>
      <div class="matrix-legend">${levels
        .filter((l) => l !== "No Data" || counts[l] > 0)
        .map(
          (level) =>
            `<span><i class="status-square ${levelClass[level]}"></i>${level} <b>${counts[level]}</b></span>`,
        )
        .join("")}</div>
    </div><aside class="focus-panel">${selected ? `<div class="focus-top"><span>BLOCK RECORD</span><button data-action="close-block" aria-label="Close block details">×</button></div><h3>${esc(selected.name)}</h3>${statusMark(selected.risk.level)}<div class="focus-stat"><strong>${formatPercent(selected.risk.value)}</strong><small>Weakest indicator: ${esc(selected.risk.name)}</small></div><p><b>${fmt(selected.metrics.schools)}</b> schools · <b>${fmt(selected.metrics.enrollment)}</b> enrolled</p><div class="focus-timeline"><h4>Three-month attendance</h4>${focusedTrend.map((x) => `<div><span>${LABELS[x.month].split(" ")[0]}</span><span class="mini-track"><i style="width:${Math.max(0, Math.min(100, x.geo?.metrics.attendanceRate ?? 0))}%"></i></span><strong>${formatPercent(x.geo?.metrics.attendanceRate ?? null)}</strong></div>`).join("")}</div><div class="register-history"><h4>Indicator register</h4><table><thead><tr><th scope="col">Measure</th><th scope="col">Jul</th><th scope="col">Aug</th><th scope="col">Sep</th></tr></thead><tbody>${registerRows}</tbody></table><p>✓ Meets 75% target · × Below target</p></div><button data-focus-district="${esc(selected.name.split(" - Block ")[0])}" class="text-action">Open this district →</button>` : `<div class="focus-empty"><span class="focus-glyph">▤</span><h3>Choose a square.</h3><p>You'll see the block's status, enrollment and attendance trend here. All values come from the school records.</p></div>`}</aside></div>
  </section>`;
}
function stripPlot(
  districts: GeoRow[],
  esc: ProgramContext["esc"],
  fmt: ProgramContext["fmt"],
  selectedDistrict = "",
): string {
  const width = 920,
    height = 280,
    pad = 52;
  const x = (v: number) =>
    pad + ((width - pad * 2) * Math.max(0, Math.min(100, v))) / 100;
  const data = [...districts]
    .filter((g) => g.metrics.attendanceRate !== null)
    .sort(
      (a, b) =>
        (a.metrics.attendanceRate ?? 0) - (b.metrics.attendanceRate ?? 0),
    );
  const bands = [
    { start: 0, end: 35, color: "#f2d8d5" },
    { start: 35, end: 60, color: "#f6e1d2" },
    { start: 60, end: 75, color: "#f6e9c5" },
    { start: 75, end: 100, color: "#dce9dc" },
  ];
  const label = selectedDistrict ? "blocks" : "districts";
  const below = data.filter(
    (g) => (g.metrics.attendanceRate ?? 100) < THRESHOLDS.ON_TRACK,
  ).length;
  const worst = data[0];
  const graph = `<svg class="district-strip" viewBox="0 0 ${width} ${height}" role="img" aria-label="Attendance distribution for ${esc(label)}. Each dot has a keyboard-accessible label.">
      ${bands.map((b) => `<rect x="${x(b.start)}" y="26" width="${x(b.end) - x(b.start)}" height="${height - 65}" fill="${b.color}"/>`).join("")}
      ${[0, 35, 60, 75, 100].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="26" y2="${height - 39}" stroke="#aaa" stroke-width="1"/><text x="${x(v)}" y="${height - 15}" text-anchor="middle" fill="#435449" font-size="15">${v}%</text>`).join("")}
      ${data
        .map((g, i) => {
          const xx = x(g.metrics.attendanceRate ?? 0),
            yy = 39 + (i % 9) * 20;
          const rr = Math.max(
            4,
            Math.min(10, 3 + Math.sqrt(g.metrics.schools) / 1.7),
          );
          const cls = levelClass[riskLevel(g.metrics.attendanceRate)];
          const attr = selectedDistrict
            ? `data-plot-district="${esc(selectedDistrict)}" data-plot-block="${esc(g.name)}"`
            : `data-plot-district="${esc(g.name)}"`;
          return `<g role="button" tabindex="0" class="district-marker" ${attr} aria-label="${esc(g.name)}: attendance ${formatPercent(g.metrics.attendanceRate)}; ${g.metrics.schools} schools"><circle cx="${xx}" cy="${yy}" r="${rr + 6}" fill="transparent"/><circle class="attendance-dot ${cls}" cx="${xx}" cy="${yy}" r="${rr}" fill="#2b4c9b" stroke="#fdfcf7" stroke-width="2"><title>${esc(g.name)}: ${formatPercent(g.metrics.attendanceRate)}</title></circle>${i < 4 ? `<text class="plot-direct-label" x="${Math.max(pad + 30, Math.min(width - 95, xx))}" y="${yy - 11}" text-anchor="middle" font-size="13">${esc(g.name.replace("District ", "").replace(" - Block ", " · "))}</text>` : ""}</g>`;
        })
        .join("")}</svg>`;
  const mobile = `<div class="district-mobile-list" aria-label="Ranked attendance values">${data
    .map((g) => {
      const attr = selectedDistrict
        ? `data-plot-district="${esc(selectedDistrict)}" data-plot-block="${esc(g.name)}"`
        : `data-plot-district="${esc(g.name)}"`;
      return `<button ${attr}><strong>${esc(g.name)}</strong><i class="mobile-dot ${levelClass[riskLevel(g.metrics.attendanceRate)]}" aria-hidden="true"></i><span class="mono">${formatPercent(g.metrics.attendanceRate)}</span></button>`;
    })
    .join("")}</div>`;
  return `<section class="register-section" aria-labelledby="district-plot-title"><div class="register-head"><div>
    <h2 id="district-plot-title">${below} of ${data.length} ${label} are below 75% attendance</h2>
    <p>${worst ? `Lowest attendance: ${esc(worst.name)}, ${formatPercent(worst.metrics.attendanceRate)}.` : "No attendance recorded for this selection."} Select a place to explore its records.</p>
    </div><span class="section-count">${data.length} ${label}</span></div><div class="strip-panel">${graph}${mobile}
      <div class="strip-caption"><span>0–35% critical</span><span>35–60% at risk</span><span>60–75% behind</span><span>75–100% on track</span></div>
      <p class="strip-footnote">Dot size reflects the number of schools; colours describe attendance against the 75% target. Source: synthetic monthly school responses.</p>
    </div></section>`;
}
export function renderChalkProgram({
  schools,
  filters: f,
  header,
  footer,
  selectors,
  esc,
  fmt,
  performanceTable,
  gridMonth,
  focusedBlock,
  showTable,
  by,
  gridView,
  plotView,
}: ProgramContext): string {
  const rows = availableRows(schools, f),
    metrics = calcMetrics(rows, f.grade, f.subject),
    previous = previousMetrics(schools, f),
    overall = risk(metrics);
  const districts = geography(rows, "district", f.grade, f.subject),
    blocks = geography(rows, "block", f.grade, f.subject);
  const plotRows = f.district ? blocks : districts;
  const strongest = rankStrongest(districts, 10),
    priorities = [...blocks]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  const underTarget = [
    { label: "participation", rate: metrics.participationRate },
    { label: "evidence", rate: metrics.evidenceRate },
    { label: "attendance", rate: metrics.attendanceRate },
  ].filter((x) => x.rate !== null && x.rate < THRESHOLDS.ON_TRACK);
  const verdict =
    underTarget.length === 0
      ? "All three indicators meet target."
      : underTarget.length === 1
        ? `${underTarget[0].label[0].toUpperCase() + underTarget[0].label.slice(1)} (${formatPercent(underTarget[0].rate)}) is the only indicator below the ${THRESHOLDS.ON_TRACK}% target.`
        : `${underTarget.map((x) => `${x.label} ${formatPercent(x.rate)}`).join(", ")} are below the ${THRESHOLDS.ON_TRACK}% target.`;
  const first = priorities[0];
  return `${header()}<section class="paper-title"><div class="title-meta"><span>Monthly programme results</span><span>${esc(LABELS[f.month])}</span></div><h1>Program review</h1></section>
  ${selectors()}
  <section class="verdict-sheet"><div class="verdict-index">Results</div><div><div class="verdict-status">${statusMark(overall.level)} <span>· ${esc(f.block || f.district || "All districts")} · ${esc(LABELS[f.month])}</span></div><p class="verdict-sentence">${esc(verdict)}</p><p class="verdict-aside"><button data-page="quality" class="inline-text-link">How is this calculated?</button></p></div></section>
  <section class="register-section bulletin" aria-labelledby="indicators-title"><div class="register-head"><div><h2 id="indicators-title">How are we doing against the 75% target?</h2><p>Dark marker = current month; fine marker = previous month; dashed line = ${THRESHOLDS.ON_TRACK}% target.</p></div><span class="section-count">${fmt(metrics.schools)} schools</span></div>
    <div class="bullet-ledger">
    ${bullet("Participation", metrics.participationRate, previous?.participationRate ?? null, `${fmt(metrics.participating)} of ${fmt(metrics.schools)} schools`)}
    ${bullet("Evidence", metrics.evidenceRate, previous?.evidenceRate ?? null, `${fmt(metrics.evidenceCount)} schools with evidence`)}
    ${bullet("Attendance", metrics.attendanceRate, previous?.attendanceRate ?? null, `${fmt(metrics.attendance)} / ${fmt(metrics.possibleSessions)} session attendances`)}
    </div><div class="ledger-foot">${fmt(metrics.enrollment)} enrolled learners · ${fmt(metrics.attendance)} recorded attendances · one learner can attend both Math and Science sessions.</div>
  </section>
  <section class="register-section action-ledger"><div class="register-head"><div><h2>Where should we act first?</h2><p>Blocks ranked by the shortfall from the 75% target, weighted by learner numbers.</p></div><button data-page="meeting" class="ink-link">Open the meeting pack →</button></div><div class="action-rows">${priorities.map((g, i) => `<button class="action-row" data-priority-block="${esc(g.name)}"><span class="action-number">${String(i + 1).padStart(2, "0")}</span><strong>${esc(g.name)}</strong>${statusMark(g.risk.level)}<span class="mono">${formatPercent(g.risk.value)}</span><span class="priority-explanation">${(THRESHOLDS.ON_TRACK - (g.risk.value ?? THRESHOLDS.ON_TRACK)).toFixed(1)} points short · ${fmt(g.metrics.enrollment)} learners</span><span>→</span></button>`).join("") || "<p>No priority gaps found for this selection.</p>"}</div>
  <div class="rank-foot">${strongest.some((x) => x.risk.level === "On Track") ? "Some districts are on track." : "No eligible district is on track; closest to target:"} ${
    strongest
      .slice(0, 2)
      .map((x) => `${esc(x.name)} (${formatPercent(x.risk.value)})`)
      .join(" · ") || "Insufficient sample sizes"
  }</div></section>
  <div class="chart-actions" role="group" aria-label="Block map view"><button data-chart-view="grid:chart" aria-pressed="${gridView === "chart"}" class="${gridView === "chart" ? "selected" : ""}">Chart</button><button data-chart-view="grid:table" aria-pressed="${gridView === "table"}" class="${gridView === "table" ? "selected" : ""}">Table</button><button data-chart-view="grid:sources" aria-pressed="${gridView === "sources"}" class="${gridView === "sources" ? "selected" : ""}">Sources</button><button data-chart-export="grid">Download CSV</button></div>
  ${
    gridView === "table"
      ? `<section class="register-section"><h2>Block results · ${LABELS[gridMonth]}</h2><div class="table-wrap"><table><thead><tr><th>Block</th><th>Schools</th><th>Participation</th><th>Evidence</th><th>Attendance</th><th>Status</th></tr></thead><tbody>${geography(
          availableRows(schools, { ...f, month: gridMonth }),
          "block",
          f.grade,
          f.subject,
        )
          .map(
            (g) =>
              `<tr><th scope="row">${esc(g.name)}</th><td>${fmt(g.metrics.schools)}</td><td>${formatPercent(g.metrics.participationRate)}</td><td>${formatPercent(g.metrics.evidenceRate)}</td><td>${formatPercent(g.metrics.attendanceRate)}</td><td>${g.risk.level}</td></tr>`,
          )
          .join("")}</tbody></table></div></section>`
      : gridView === "sources"
        ? `<section class="register-section"><h2>Block chart sources</h2><p>Synthetic monthly school response records. Status is based on the lowest of participation, evidence and session attendance. Full formulas are in Data notes.</p><button class="ink-link" data-page="quality">Read data notes →</button></section>`
        : matrix(schools, f, gridMonth, focusedBlock, esc, fmt)
  }
  <div class="chart-actions" role="group" aria-label="Attendance plot view"><button data-chart-view="plot:chart" aria-pressed="${plotView === "chart"}" class="${plotView === "chart" ? "selected" : ""}">Chart</button><button data-chart-view="plot:table" aria-pressed="${plotView === "table"}" class="${plotView === "table" ? "selected" : ""}">Table</button><button data-chart-view="plot:sources" aria-pressed="${plotView === "sources"}" class="${plotView === "sources" ? "selected" : ""}">Sources</button><button data-chart-export="plot">Download CSV</button></div>
  ${
    plotView === "table"
      ? `<section class="register-section"><h2>Attendance by ${f.district ? "block" : "district"}</h2><div class="table-wrap"><table><thead><tr><th>Place</th><th>Schools</th><th>Learners</th><th>Attendance</th></tr></thead><tbody>${plotRows
          .sort(
            (a, b) =>
              (a.metrics.attendanceRate ?? 0) - (b.metrics.attendanceRate ?? 0),
          )
          .map(
            (g) =>
              `<tr><th scope="row">${esc(g.name)}</th><td>${fmt(g.metrics.schools)}</td><td>${fmt(g.metrics.enrollment)}</td><td>${formatPercent(g.metrics.attendanceRate)}</td></tr>`,
          )
          .join("")}</tbody></table></div></section>`
      : plotView === "sources"
        ? `<section class="register-section"><h2>Attendance plot sources</h2><p>Attendance from synthetic school response records, divided by the number of eligible session places. Math and Science sessions are counted separately.</p></section>`
        : stripPlot(plotRows, esc, fmt, f.district)
  }
  <section class="register-section" aria-labelledby="full-table-title"><div class="register-head"><div><h2 id="full-table-title">Explore the full results</h2><p>Search, sort and inspect the complete underlying performance table.</p></div><button data-action="toggle-table" class="outline-action" aria-expanded="${showTable}">${showTable ? "Hide register −" : "Show table +"}</button></div>${showTable ? `<div class="table-view-switch"><button data-by="district" class="${by === "district" ? "selected" : ""}">Districts</button><button data-by="block" class="${by === "block" ? "selected" : ""}">Blocks</button></div>${performanceTable(geography(rows, by, f.grade, f.subject))}` : ""}</section>
  <p class="methods-link">How were these figures calculated? <button data-page="quality">Read the data and methods notes →</button></p>${footer()}`;
}

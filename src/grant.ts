import {
  calcMetrics,
  formatPercent,
  risk,
  THRESHOLDS,
  monthBefore,
  LABELS,
  type SchoolRow,
  type Month,
  type Metrics,
  type MetricRisk,
} from "./core.js";
export interface FinanceRow {
  grant_id: string;
  donor: string;
  grant_name: string;
  period_start: string;
  period_end: string;
  covered_districts: string;
  reporting_month: Month;
  budget_line: string;
  approved: number;
  monthly: number;
  cumulative: number;
  sourceRate: number;
  finance_note: string;
}
export interface GrantSource {
  grant_id: string;
  donor: string;
  grant_name: string;
  reporting_month: Month;
  covered_districts: string;
  report_due_date: string;
  period_end_date: string;
  report_status: string;
  milestone_summary: string;
  draft_report_text: string;
  sourceSchools: number;
  sourceCompleted: number;
  sourceEvidence: number;
  sourceEnrolled: number;
  sourceAttendance: number;
  [key: string]: string | number;
}
export interface Media {
  record_id: string;
  record_type: string;
  grant_id: string;
  donor: string;
  reporting_month: Month;
  district: string;
  title: string;
  summary_or_caption: string;
  file_name: string;
  relative_path: string;
  url: string;
  usage_note: string;
}
export interface Fact {
  id: string;
  label: string;
  value: string;
  source: string;
}
export interface CheckedFinance extends FinanceRow {
  utilization: number;
  historicalTotal: number;
  rateDiscrepancyPp: number;
  cumulativeMismatch: boolean;
  rateMismatch: boolean;
}
export interface GrantReport {
  source: GrantSource;
  districts: string[];
  metrics: Metrics;
  risk: MetricRisk;
  verification: {
    ok: boolean;
    notes: string[];
  };
  finance: CheckedFinance[];
  financeTotals: {
    approved: number;
    monthly: number;
    reportedCumulative: number;
    derivedUtilization: number;
  };
  milestones: {
    name: string;
    status: string;
    owner: string;
  }[];
  assets: Media[];
  facts: Fact[];
  narrative: string;
  markdown: string;
  warnings: string[];
}
export function milestonesParse(text: string): {
  name: string;
  status: string;
  owner: string;
}[] {
  return text
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*?):\s*(.*?)\s*\((.*?)\)$/);
      return {
        name: match?.[1] ?? entry,
        status: match?.[2] ?? "Unspecified",
        owner: match?.[3] ?? "Not provided",
      };
    });
}
export function computeGrant(
  schools: SchoolRow[],
  profiles: GrantSource[],
  finance: FinanceRow[],
  media: Media[],
  grantId: string,
  month: Month,
): GrantReport {
  const source = profiles.find(
    (p) => p.grant_id === grantId && p.reporting_month === month,
  );
  if (!source) throw new Error(`No grant profile found: ${grantId}/${month}`);
  const districts = source.covered_districts
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  const subset = schools.filter(
    (r) => r.month === month && districts.includes(r.district),
  );
  const metrics = calcMetrics(subset),
    status = risk(metrics);
  const diffs: string[] = [];
  for (const [label, actual, expected] of [
    ["school count", metrics.schools, source.sourceSchools],
    ["PBL completed", metrics.participating, source.sourceCompleted],
    ["evidence submitted", metrics.evidenceCount, source.sourceEvidence],
    ["enrollment", metrics.enrollment, source.sourceEnrolled],
    ["attendance", metrics.attendance, source.sourceAttendance],
  ] as [string, number, number][])
    if (actual !== expected)
      diffs.push(`${label} ${actual} vs source ${expected}`);
  const checkedFinance = finance
    .filter((f) => f.grant_id === grantId && f.reporting_month === month)
    .map((f) => {
      const historicalTotal = finance
        .filter(
          (pr) =>
            pr.grant_id === f.grant_id &&
            pr.budget_line === f.budget_line &&
            pr.reporting_month <= month,
        )
        .reduce((s, pr) => s + pr.monthly, 0);
      const utilization = f.approved ? (100 * f.cumulative) / f.approved : 0;
      const rateDiscrepancyPp = utilization - f.sourceRate * 100;
      return {
        ...f,
        utilization,
        historicalTotal,
        rateDiscrepancyPp,
        cumulativeMismatch: f.cumulative !== historicalTotal,
        rateMismatch: Math.abs(rateDiscrepancyPp) > 0.1,
      };
    });
  const sums = checkedFinance.reduce(
    (a, f) => ({
      approved: a.approved + f.approved,
      monthly: a.monthly + f.monthly,
      reportedCumulative: a.reportedCumulative + f.cumulative,
    }),
    { approved: 0, monthly: 0, reportedCumulative: 0 },
  );
  const financeTotals = {
    ...sums,
    derivedUtilization: sums.approved
      ? (100 * sums.reportedCumulative) / sums.approved
      : 0,
  };
  const assets = media.filter(
    (m) => m.grant_id === grantId && m.reporting_month === month,
  );
  const milestones = milestonesParse(source.milestone_summary);
  const earlier = monthBefore(month);
  const previous = earlier
    ? calcMetrics(
        schools.filter(
          (r) => r.month === earlier && districts.includes(r.district),
        ),
      )
    : null;
  const attendanceDelta =
    previous?.attendanceRate != null && metrics.attendanceRate != null
      ? metrics.attendanceRate - previous.attendanceRate
      : null;
  const endMonth = source.period_end_date.slice(0, 7);
  const periodEnded = month >= endMonth;
  const budgetRemaining = sums.approved - sums.reportedCumulative;
  const unspentPp = 100 - financeTotals.derivedUtilization;
  const number = (v: number) => v.toLocaleString("en-IN");
  const facts: Fact[] = [
    {
      id: "F1",
      label: "Grant and reporting period",
      value: `${source.grant_name} / ${LABELS[month]}`,
      source: "Grant profile CSV",
    },
    {
      id: "F2",
      label: "Geographic coverage",
      value: `${districts.length} districts: ${districts.join(", ")}`,
      source: "Grant coverage CSV",
    },
    {
      id: "F3",
      label: "Schools sampled",
      value: number(metrics.schools),
      source: "Filtered school response CSV",
    },
    {
      id: "F4",
      label: "PBL participation",
      value: `${number(metrics.participating)} / ${number(metrics.schools)} (${formatPercent(metrics.participationRate)})`,
      source: "School response PBL flag",
    },
    {
      id: "F5",
      label: "Evidence submission",
      value: `${number(metrics.evidenceCount)} / ${number(metrics.schools)} (${formatPercent(metrics.evidenceRate)})`,
      source: "School response evidence flag",
    },
    {
      id: "F6",
      label: "PBL session attendance",
      value: `${number(metrics.attendance)} / ${number(metrics.possibleSessions)} (${formatPercent(metrics.attendanceRate)})`,
      source:
        "Class × subject attendance columns; 2 sessions per enrolled pupil",
    },
    {
      id: "F7",
      label: "Risk",
      value: `${status.level} — ${status.reason}`,
      source: `Risk thresholds: ${THRESHOLDS.ON_TRACK}/${THRESHOLDS.BEHIND}/${THRESHOLDS.AT_RISK}`,
    },
    {
      id: "F8",
      label: "Reported cumulative utilization",
      value: `${number(financeTotals.reportedCumulative)} / ${number(financeTotals.approved)} budget units (${financeTotals.derivedUtilization.toFixed(1)}%)`,
      source: "Finance CSV cumulative totals / approved units",
    },
    {
      id: "F9",
      label: "Current month spend",
      value: `${number(financeTotals.monthly)} budget units`,
      source: "Finance CSV monthly units",
    },
    {
      id: "F10",
      label: "Milestone statuses",
      value: milestones
        .map((m) => `${m.name}: ${m.status} (${m.owner})`)
        .join("; "),
      source: "Grant performance milestone_summary field",
    },
    {
      id: "F11",
      label: "Indexed evidence/media",
      value: assets.length
        ? `${assets.length} synthetic asset(s): ${assets.map((m) => m.record_id).join(", ")}`
        : "None indexed for this period",
      source: "Evidence/media CSV",
    },
    {
      id: "F12",
      label: "Month-on-month attendance",
      value:
        previous?.attendanceRate != null && metrics.attendanceRate != null
          ? `${formatPercent(previous.attendanceRate)} to ${formatPercent(metrics.attendanceRate)} (${attendanceDelta !== null && attendanceDelta >= 0 ? "+" : ""}${attendanceDelta!.toFixed(1)} pp)`
          : "Not available for first reporting month",
      source: "School response CSV in consecutive months",
    },
    {
      id: "F13",
      label: "Grant end and remaining budget",
      value: `${source.period_end_date}; ${number(budgetRemaining)} budget units not reported as utilized (${unspentPp.toFixed(1)} percentage points to 100%)`,
      source: "Grant period end, approved and reported cumulative units",
    },
  ];
  const warnings = [...diffs.map((d) => `Source performance mismatch: ${d}`)];
  for (const f of checkedFinance) {
    if (f.rateMismatch)
      warnings.push(
        `${f.budget_line}: published rate differs by ${Math.abs(f.rateDiscrepancyPp).toFixed(2)} pp from cumulative / approved.`,
      );
    if (f.cumulativeMismatch)
      warnings.push(
        `${f.budget_line}: reported cumulative ${f.cumulative} ≠ sum of monthly spend ${f.historicalTotal}.`,
      );
  }
  // Nothing in this narrative is produced by an LLM; all claims use the fact ledger.
  const narrative = `${source.grant_name} covers ${number(metrics.schools)} synthetic school records across ${districts.length} districts in ${LABELS[month]}. [F1][F2][F3]

PBL took place in ${number(metrics.participating)} schools (${formatPercent(metrics.participationRate)}). [F4] ${number(metrics.evidenceCount)} schools submitted evidence (${formatPercent(metrics.evidenceRate)}). [F5] Recorded attendance was ${number(metrics.attendance)} of ${number(metrics.possibleSessions)} possible Science/Math attendances (${formatPercent(metrics.attendanceRate)}). [F6]

Overall status: ${status.level}, driven by ${status.name.toLowerCase()} at ${formatPercent(status.value)}. [F7] ${attendanceDelta === null ? "There is no earlier comparison month in this dataset." : `Attendance changed ${attendanceDelta >= 0 ? "+" : ""}${attendanceDelta.toFixed(1)} pp from ${formatPercent(previous!.attendanceRate)} the previous month to ${formatPercent(metrics.attendanceRate)}.`} [F12]

Reported cumulative expenditure is ${number(financeTotals.reportedCumulative)} of ${number(financeTotals.approved)} budget units (${financeTotals.derivedUtilization.toFixed(1)}%); ${number(financeTotals.monthly)} units were spent this month. [F8][F9] ${periodEnded ? `The grant period ended ${source.period_end_date}, with ${number(budgetRemaining)} units (${unspentPp.toFixed(1)} percentage points) not reported as utilized; this requires a close-out review.` : `The scheduled end date is ${source.period_end_date}; spending should be reviewed against the remaining period.`} [F13]

Milestones recorded: ${milestones.map((m) => `${m.name} — ${m.status} (${m.owner})`).join("; ") || "none listed"}. [F10] ${assets.length ? `${assets.length} synthetic evidence/media record(s) are indexed for this period.` : "No evidence/media assets are indexed for this grant and month."} [F11]

Proposed follow-up: investigate the ${status.name.toLowerCase()} gap, reconcile any flagged finance records and assign a grant close-out owner. [F7][F8][F13]`;
  const markdown = `# ${source.grant_name} — ${month}\n\n**Synthetic demonstration data only.**\n\n${narrative}\n\n## Fact ledger\n${facts.map((f) => `- [${f.id}] ${f.label}: ${f.value} — ${f.source}`).join("\n")}\n\n## Data-quality flags\n${warnings.length ? warnings.map((x) => `- ${x}`).join("\n") : "- No material discrepancies detected."}\n`;
  return {
    source,
    districts,
    metrics,
    risk: status,
    verification: { ok: diffs.length === 0, notes: diffs },
    finance: checkedFinance,
    financeTotals,
    milestones,
    assets,
    facts,
    narrative,
    markdown,
    warnings,
  };
}

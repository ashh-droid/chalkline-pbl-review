/** Reproducible meeting material generated from school-month records. */
import {
  availableRows,
  calcMetrics,
  comparePoints,
  geography,
  indicatorStatuses,
  monthBefore,
  rankStrongest,
  risk,
  riskLevel,
  THRESHOLDS,
  type Filters,
  type GeoRow,
  type Level,
  type Metrics,
  type SchoolRow,
} from "./core.js";
export interface ReviewAction {
  id: string;
  action: string;
  owner: string;
  priority: "High" | "Medium";
  dueDate: string;
  status: "Proposed";
  linkedMetric: string;
}
export function nextDueDate(month: string, offsetDays: number): string {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0));
  last.setUTCDate(last.getUTCDate() + offsetDays);
  return last.toISOString().slice(0, 10);
}
/** Proposed owners/dates are suggestions, never assertions about actual assignments. */
export function generateReviewActions(
  rows: SchoolRow[],
  filters: Filters,
  financeWarnings: string[] = [],
): ReviewAction[] {
  const current = availableRows(rows, filters);
  const blocks = geography(current, "block", filters.grade, filters.subject)
    .filter((x) => x.priority > 0 && x.metrics.schools > 0)
    .sort((a, b) => b.priority - a.priority);
  const actions: ReviewAction[] = blocks.slice(0, 3).map((block, index) => ({
    id: `A${index + 1}`,
    action: `Investigate ${block.risk.name.toLowerCase()} gap in ${block.name}; confirm causes with the block team`,
    owner: "Block coordinator (proposed)",
    priority: index === 0 ? "High" : "Medium",
    dueDate: nextDueDate(filters.month, 7 + index * 3),
    status: "Proposed",
    linkedMetric: `${block.name}: ${block.risk.name} ${block.risk.value?.toFixed(1)}%; ${block.metrics.schools} schools`,
  }));
  if (financeWarnings.length) {
    actions.push({
      id: `A${actions.length + 1}`,
      action: `Reconcile ${financeWarnings.length} reported finance warning(s) against source records`,
      owner: "Grant finance lead (proposed)",
      priority: "High",
      dueDate: nextDueDate(filters.month, 7),
      status: "Proposed",
      linkedMetric: "Grant finance reconciliation",
    });
  }
  return actions.slice(0, 5);
}
export interface ReviewDetail {
  metrics: Metrics;
  previous: Metrics | null;
  overall: ReturnType<typeof risk>;
  achievements: string[];
  changes: {
    label: string;
    current: number | null;
    previous: number | null;
    delta: number | null;
  }[];
  priorityDistricts: GeoRow[];
  priorityBlocks: GeoRow[];
  strongest: GeoRow[];
  strongestLabel: string;
  prompts: string[];
  actions: ReviewAction[];
  indicatorCounts: {
    month: string;
    counts: Record<Level, number>;
  }[];
}
export function buildReviewDetail(rows: SchoolRow[], f: Filters): ReviewDetail {
  const current = availableRows(rows, f);
  const metrics = calcMetrics(current, f.grade, f.subject);
  const priorMonth = monthBefore(f.month);
  const previous = priorMonth
    ? calcMetrics(
        availableRows(rows, { ...f, month: priorMonth }),
        f.grade,
        f.subject,
      )
    : null;
  const changes = [
    {
      label: "Participation",
      current: metrics.participationRate,
      previous: previous?.participationRate ?? null,
    },
    {
      label: "Evidence",
      current: metrics.evidenceRate,
      previous: previous?.evidenceRate ?? null,
    },
    {
      label: "Attendance",
      current: metrics.attendanceRate,
      previous: previous?.attendanceRate ?? null,
    },
  ].map((x) => ({ ...x, delta: comparePoints(x.current, x.previous) }));
  const achievements = changes.flatMap(({ label, current, delta }) => {
    const achievements: string[] = [];
    if (riskLevel(current) === "On Track")
      achievements.push(`${label} is on track at ${current?.toFixed(1)}%.`);
    if (delta !== null && delta > 0.05)
      achievements.push(
        `${label} improved by ${delta.toFixed(1)} percentage points versus the previous month.`,
      );
    return achievements;
  });
  if (!achievements.length)
    achievements.push(
      "No indicators reached target or improved this month; discussion should focus on recovery.",
    );
  const districts = geography(current, "district", f.grade, f.subject);
  const blocks = geography(current, "block", f.grade, f.subject);
  const strongest = rankStrongest(districts, 10).slice(0, 5);
  const onTrack = strongest.filter((x) => x.risk.level === "On Track");
  const priorityDistricts = [...districts]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  const priorityBlocks = [...blocks]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  const top = priorityBlocks[0];
  const prompts = [
    top
      ? `${top.name}: ${top.risk.name.toLowerCase()} is ${top.risk.value?.toFixed(1)}% across ${top.metrics.schools} schools. What is preventing improvement?`
      : "Which geography needs follow-up?",
    priorityDistricts[0]
      ? `How can ${priorityDistricts[0].name} address its largest implementation gap before next review?`
      : "Which district needs additional support?",
    "Who will verify flagged records and confirm owners of next steps?",
  ];
  const indicatorCounts = (["2025-07", "2025-08", "2025-09"] as const).map(
    (month) => {
      const geos = geography(
        availableRows(rows, { ...f, month }),
        "block",
        f.grade,
        f.subject,
      );
      const counts: Record<Level, number> = {
        "On Track": 0,
        Behind: 0,
        "At Risk": 0,
        Critical: 0,
        "No Data": 0,
      };
      for (const geo of geos) counts[geo.risk.level]++;
      return { month, counts };
    },
  );
  return {
    metrics,
    previous,
    overall: risk(metrics),
    achievements,
    changes,
    priorityDistricts,
    priorityBlocks,
    strongest,
    strongestLabel:
      onTrack.length > 0
        ? "Strongest districts"
        : "No district is on track — closest to target",
    prompts,
    actions: generateReviewActions(rows, f),
    indicatorCounts,
  };
}

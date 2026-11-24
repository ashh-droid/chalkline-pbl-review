/** Pure program-intelligence functions. No HTTP, UI, LLM, or database dependencies. */
export type Month = '2025-07' | '2025-08' | '2025-09';
export const MONTHS: Month[] = ['2025-07', '2025-08', '2025-09'];
export const LABELS: Record<Month, string> = { '2025-07': 'July 2025', '2025-08': 'August 2025', '2025-09': 'September 2025' };
export type Level = 'On Track' | 'Behind' | 'At Risk' | 'Critical' | 'No Data';
export type Subject = 'all' | 'science' | 'math';
export type Grade = 'all' | '6' | '7' | '8';
export interface Session {
    grade: number;
    enrolled: number;
    science: number;
    math: number;
}
export interface SchoolRow {
    month: Month;
    schoolId: string;
    school: string;
    district: string;
    block: string;
    conducted: boolean;
    evidence: boolean;
    reportedClasses: string;
    reportedSubjects: string;
    classes: Session[];
    sourceRate: number;
    sourceRisk: string;
}
export interface Filters {
    month: Month;
    district: string;
    block: string;
    grade: Grade;
    subject: Subject;
}
export interface Metrics {
    schools: number;
    participating: number;
    evidenceCount: number;
    enrollment: number;
    attendance: number;
    possibleSessions: number;
    participationRate: number | null;
    evidenceRate: number | null;
    evidenceAmongParticipants: number | null;
    attendanceRate: number | null;
}
export interface MetricRisk {
    name: string;
    level: Level;
    value: number | null;
    reason: string;
}
export interface GeoRow {
    name: string;
    metrics: Metrics;
    risk: MetricRisk;
    priority: number;
}
export { THRESHOLDS } from './config/thresholds.js';
import { THRESHOLDS } from './config/thresholds.js';
export function percent(n: number, d: number): number | null { return d > 0 ? 100 * n / d : null; }
export function formatPercent(n: number | null): string { return n === null ? '—' : `${n.toFixed(1)}%`; }
export function riskLevel(rate: number | null): Level {
    if (rate === null || !Number.isFinite(rate))
        return 'No Data';
    if (rate >= THRESHOLDS.ON_TRACK)
        return 'On Track';
    if (rate >= THRESHOLDS.BEHIND)
        return 'Behind';
    if (rate >= THRESHOLDS.AT_RISK)
        return 'At Risk';
    return 'Critical';
}
export function risk(metrics: Metrics): MetricRisk {
    const parts = [{ name: 'Participation', value: metrics.participationRate }, { name: 'Evidence', value: metrics.evidenceRate }, { name: 'Attendance', value: metrics.attendanceRate }];
    const valid = parts.filter((x): x is {
        name: string;
        value: number;
    } => x.value !== null);
    if (!valid.length)
        return { name: 'None', value: null, level: 'No Data', reason: 'No eligible denominator available' };
    valid.sort((a, b) => a.value - b.value);
    const weak = valid[0];
    const level = riskLevel(weak.value);
    return { name: weak.name, value: weak.value, level, reason: `${weak.name} ${formatPercent(weak.value)} is the lowest indicator (target ${THRESHOLDS.ON_TRACK}%)` };
}
export function availableRows(rows: SchoolRow[], f: Filters): SchoolRow[] {
    return rows.filter(r => r.month === f.month && (!f.district || r.district === f.district) && (!f.block || r.block === f.block));
}
export function selectedGrades(g: Grade): number[] { return g === 'all' ? [6, 7, 8] : [Number(g)]; }
export function calcMetrics(rows: SchoolRow[], grade: Grade = 'all', subject: Subject = 'all'): Metrics {
    let schools = 0, participating = 0, evidenceCount = 0, enrollment = 0, attendance = 0, possibleSessions = 0;
    const grades = selectedGrades(grade);
    for (const r of rows) {
        const sessions = r.classes.filter(c => grades.includes(c.grade));
        const eligible = sessions.some(c => c.enrolled > 0);
        if (!eligible)
            continue;
        const en = sessions.reduce((sum, c) => sum + c.enrolled, 0);
        const attend = sessions.reduce((sum, c) => sum + (subject === 'science' ? c.science : subject === 'math' ? c.math : c.science + c.math), 0);
        schools++;
        enrollment += en;
        attendance += attend;
        possibleSessions += en * (subject === 'all' ? 2 : 1);
        // Full cohort uses authoritative school-level participation flag.
        // Scoped grade/subject uses observed positive session attendance, not contradictory survey labels.
        const active = grade === 'all' && subject === 'all' ? r.conducted : attend > 0;
        if (active)
            participating++;
        if (r.evidence)
            evidenceCount++;
    }
    return { schools, participating, evidenceCount, enrollment, attendance, possibleSessions,
        participationRate: percent(participating, schools), evidenceRate: percent(evidenceCount, schools),
        evidenceAmongParticipants: percent(evidenceCount, participating), attendanceRate: percent(attendance, possibleSessions) };
}
export function geography(rows: SchoolRow[], by: 'district' | 'block', grade: Grade = 'all', subject: Subject = 'all'): GeoRow[] {
    const groups = new Map<string, SchoolRow[]>();
    for (const r of rows) {
        const key = r[by];
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key)!.push(r);
    }
    return Array.from(groups, ([name, items]) => {
        const metrics = calcMetrics(items, grade, subject), status = risk(metrics);
        // Weighted gap: missing percentage points to target multiplied by relevant enrollment.
        const priority = Math.max(0, THRESHOLDS.ON_TRACK - (status.value ?? THRESHOLDS.ON_TRACK)) * metrics.enrollment / 100;
        return { name, metrics, risk: status, priority };
    });
}
export function comparePoints(now: number | null, prev: number | null): number | null { return now === null || prev === null ? null : now - prev; }
export function monthBefore(m: Month): Month | null { return MONTHS[MONTHS.indexOf(m) - 1] ?? null; }
export function previousMetrics(rows: SchoolRow[], filters: Filters): Metrics | null {
    const prev = monthBefore(filters.month);
    return prev ? calcMetrics(availableRows(rows, { ...filters, month: prev }), filters.grade, filters.subject) : null;
}
export function trend(rows: SchoolRow[], filters: Filters): {
    month: Month;
    metrics: Metrics;
}[] { return MONTHS.map(month => ({ month, metrics: calcMetrics(availableRows(rows, { ...filters, month }), filters.grade, filters.subject) })); }
export function reviewSummary(rows: SchoolRow[], f: Filters): {
    metrics: Metrics;
    risk: MetricRisk;
    previous: Metrics | null;
    priorityBlocks: GeoRow[];
    priorityDistricts: GeoRow[];
    prompts: string[];
} {
    const subset = availableRows(rows, f), metrics = calcMetrics(subset, f.grade, f.subject);
    const priorityBlocks = geography(subset, 'block', f.grade, f.subject).sort((a, b) => b.priority - a.priority).slice(0, 5);
    const priorityDistricts = geography(subset, 'district', f.grade, f.subject).sort((a, b) => b.priority - a.priority).slice(0, 5);
    const weakest = risk(metrics);
    const previous = previousMetrics(rows, f);
    const prompts = [`What is preventing ${weakest.name.toLowerCase()} from reaching ${THRESHOLDS.ON_TRACK}%?`,
        `Which of the flagged blocks needs a visit before the next monthly review?`,
        'Who will verify data quality and the next evidence submission?'];
    return { metrics, risk: weakest, previous, priorityBlocks, priorityDistricts, prompts };
}
/** Three indicators and their independent, explainable statuses. */
export function indicatorStatuses(metrics: Metrics): {
    name: string;
    value: number | null;
    level: Level;
}[] {
    return [
        { name: 'Participation', value: metrics.participationRate, level: riskLevel(metrics.participationRate) },
        { name: 'Evidence', value: metrics.evidenceRate, level: riskLevel(metrics.evidenceRate) },
        { name: 'Attendance', value: metrics.attendanceRate, level: riskLevel(metrics.attendanceRate) },
    ];
}
/** Smaller geographies are visible in tables but not used as 'strongest' examples. */
export function rankStrongest(geographies: GeoRow[], minSchools = 10): GeoRow[] {
    return [...geographies]
        .filter((geo) => geo.metrics.schools >= minSchools && geo.risk.value !== null)
        .sort((a, b) => (b.risk.value ?? -1) - (a.risk.value ?? -1));
}


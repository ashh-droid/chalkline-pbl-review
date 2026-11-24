export const MONTHS = ["2025-07", "2025-08", "2025-09"];
export const LABELS = {
    "2025-07": "July 2025",
    "2025-08": "August 2025",
    "2025-09": "September 2025",
};
export { THRESHOLDS } from "./config/thresholds.js";
import { THRESHOLDS } from "./config/thresholds.js";
export function percent(n, d) {
    return d > 0 ? (100 * n) / d : null;
}
export function formatPercent(n) {
    return n === null ? "—" : `${n.toFixed(1)}%`;
}
export function riskLevel(rate) {
    if (rate === null || !Number.isFinite(rate))
        return "No Data";
    if (rate >= THRESHOLDS.ON_TRACK)
        return "On Track";
    if (rate >= THRESHOLDS.BEHIND)
        return "Behind";
    if (rate >= THRESHOLDS.AT_RISK)
        return "At Risk";
    return "Critical";
}
export function risk(metrics) {
    const parts = [
        { name: "Participation", value: metrics.participationRate },
        { name: "Evidence", value: metrics.evidenceRate },
        { name: "Attendance", value: metrics.attendanceRate },
    ];
    const valid = parts.filter((x) => x.value !== null);
    if (!valid.length)
        return {
            name: "None",
            value: null,
            level: "No Data",
            reason: "No eligible denominator available",
        };
    valid.sort((a, b) => a.value - b.value);
    const weak = valid[0];
    const level = riskLevel(weak.value);
    return {
        name: weak.name,
        value: weak.value,
        level,
        reason: `${weak.name} ${formatPercent(weak.value)} is the lowest indicator (target ${THRESHOLDS.ON_TRACK}%)`,
    };
}
export function availableRows(rows, f) {
    return rows.filter((r) => r.month === f.month &&
        (!f.district || r.district === f.district) &&
        (!f.block || r.block === f.block));
}
export function selectedGrades(g) {
    return g === "all" ? [6, 7, 8] : [Number(g)];
}
export function calcMetrics(rows, grade = "all", subject = "all") {
    let schools = 0, participating = 0, evidenceCount = 0, enrollment = 0, attendance = 0, possibleSessions = 0;
    const grades = selectedGrades(grade);
    for (const r of rows) {
        const sessions = r.classes.filter((c) => grades.includes(c.grade));
        const eligible = sessions.some((c) => c.enrolled > 0);
        if (!eligible)
            continue;
        const en = sessions.reduce((sum, c) => sum + c.enrolled, 0);
        const attend = sessions.reduce((sum, c) => sum +
            (subject === "science"
                ? c.science
                : subject === "math"
                    ? c.math
                    : c.science + c.math), 0);
        schools++;
        enrollment += en;
        attendance += attend;
        possibleSessions += en * (subject === "all" ? 2 : 1);
        // Full cohort uses authoritative school-level participation flag.
        // Scoped grade/subject uses observed positive session attendance, not contradictory survey labels.
        const active = grade === "all" && subject === "all" ? r.conducted : attend > 0;
        if (active)
            participating++;
        if (r.evidence)
            evidenceCount++;
    }
    return {
        schools,
        participating,
        evidenceCount,
        enrollment,
        attendance,
        possibleSessions,
        participationRate: percent(participating, schools),
        evidenceRate: percent(evidenceCount, schools),
        evidenceAmongParticipants: percent(evidenceCount, participating),
        attendanceRate: percent(attendance, possibleSessions),
    };
}
export function geography(rows, by, grade = "all", subject = "all") {
    const groups = new Map();
    for (const r of rows) {
        const key = r[by];
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(r);
    }
    return Array.from(groups, ([name, items]) => {
        const metrics = calcMetrics(items, grade, subject), status = risk(metrics);
        // Weighted gap: missing percentage points to target multiplied by relevant enrollment.
        const priority = (Math.max(0, THRESHOLDS.ON_TRACK - (status.value ?? THRESHOLDS.ON_TRACK)) *
            metrics.enrollment) /
            100;
        return { name, metrics, risk: status, priority };
    });
}
export function comparePoints(now, prev) {
    return now === null || prev === null ? null : now - prev;
}
export function monthBefore(m) {
    return MONTHS[MONTHS.indexOf(m) - 1] ?? null;
}
export function previousMetrics(rows, filters) {
    const prev = monthBefore(filters.month);
    return prev
        ? calcMetrics(availableRows(rows, { ...filters, month: prev }), filters.grade, filters.subject)
        : null;
}
export function trend(rows, filters) {
    return MONTHS.map((month) => ({
        month,
        metrics: calcMetrics(availableRows(rows, { ...filters, month }), filters.grade, filters.subject),
    }));
}
export function reviewSummary(rows, f) {
    const subset = availableRows(rows, f), metrics = calcMetrics(subset, f.grade, f.subject);
    const priorityBlocks = geography(subset, "block", f.grade, f.subject)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5);
    const priorityDistricts = geography(subset, "district", f.grade, f.subject)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5);
    const weakest = risk(metrics);
    const previous = previousMetrics(rows, f);
    const prompts = [
        `What is preventing ${weakest.name.toLowerCase()} from reaching ${THRESHOLDS.ON_TRACK}%?`,
        `Which of the flagged blocks needs a visit before the next monthly review?`,
        "Who will verify data quality and the next evidence submission?",
    ];
    return {
        metrics,
        risk: weakest,
        previous,
        priorityBlocks,
        priorityDistricts,
        prompts,
    };
}
/** Three indicators and their independent, explainable statuses. */
export function indicatorStatuses(metrics) {
    return [
        {
            name: "Participation",
            value: metrics.participationRate,
            level: riskLevel(metrics.participationRate),
        },
        {
            name: "Evidence",
            value: metrics.evidenceRate,
            level: riskLevel(metrics.evidenceRate),
        },
        {
            name: "Attendance",
            value: metrics.attendanceRate,
            level: riskLevel(metrics.attendanceRate),
        },
    ];
}
/** Smaller geographies are visible in tables but not used as 'strongest' examples. */
export function rankStrongest(geographies, minSchools = 10) {
    return [...geographies]
        .filter((geo) => geo.metrics.schools >= minSchools && geo.risk.value !== null)
        .sort((a, b) => (b.risk.value ?? -1) - (a.risk.value ?? -1));
}

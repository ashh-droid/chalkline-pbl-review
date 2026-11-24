<p align="center"><img src="docs/brand/chalkline-wordmark-light.svg" alt="Chalkline — Mark where to act" width="340" /></p>

# Chalkline

**Mark where to act.** A programme review and grant-reporting workspace for project-based learning (PBL) data.

Chalkline presents monthly programme performance as a readable register rather than an administrative dashboard. It turns school response records into independently computed indicators, geographic priorities, meeting material and source-linked grant narratives.

**[Explore the interactive demo](https://ashh-droid.github.io/chalkline-pbl-review/)** · July–September 2025 · 2,300 schools · 38 districts · 395 blocks

> **Data provenance:** This is an independent technical demonstration built with synthetic educational, finance and media records supplied for a Mantra4Change engineering exercise. It is not a live programme, an official Mantra4Change product, or evidence of actual schools or grants.

![Chalkline programme review](engineering/screenshots/Chalkline_Program_Review.png)

## The four views

| View | Purpose |
| --- | --- |
| **Program review** | Compare participation, evidence and session attendance; filter by month, district, block, grade and subject. Custom bullet charts, a 395-block progress matrix and a district attendance strip plot reveal where action is needed. |
| **Meeting pack** | A printable 35-minute review agenda covering achievements, month-to-month changes, risks, priority geographies and suggested owners/dates. Proposed actions are not confirmed assignments. |
| **Grant reporting** | Independently recompute grant indicators, reconcile finance data and milestones, inspect indexed synthetic media, and generate a cited narrative linked to fact IDs. |
| **Data notes** | Show formulas, assumptions, source inconsistencies and the limits of the dataset. |

## Decisions come from code

All performance metrics, classifications and finance checks are computed by deterministic code. The optional AI path can only word already computed facts; it cannot alter a count, target or grant status. Grant narratives are fully available with AI turned off, including on GitHub Pages.

| Indicator | Computation |
| --- | --- |
| Participation | Schools reporting that PBL was conducted ÷ eligible schools. For filtered grade/subject views, positive session attendance is used as a documented proxy because survey responses conflict with recorded sessions. |
| Evidence | Schools with evidence recorded ÷ eligible schools. |
| Session attendance | Recorded class-and-subject attendances ÷ (enrollment in selected classes × number of selected subjects). Both Math and Science together create two attendance opportunities per learner. |
| Month-over-month | Change in percentage **points**, not relative percentage growth. |
| Geographic status | Worst of participation, evidence and attendance. |
| Priority | Gap below target on the weakest indicator × selected enrollment ÷ 100. |

Risk thresholds are defined once in [`src/config/thresholds.ts`](src/config/thresholds.ts): **On Track ≥75%**, **Behind 60–74.9%**, **At Risk 35–59.9%**, **Critical below 35%**. No valid denominator is reported as No Data.

### Evidence-led grant reporting

Grant data is joined to the underlying school records by reporting month and covered districts. School counts, PBL completion, evidence, enrollment and attendance are independently recalculated and reconciled against the supplied summary for all **nine grant-month combinations**. Report sentences cite computed facts using `[F1]`–`[F13]`, with an adjacent fact ledger. Indexed synthetic evidence appears only for its applicable grant and month.

The application never presents the provided draft donor prose as verified fact, and it does not assume a financial currency where the source gives only budget units. September's remaining budget represents the fraction **not reported as utilized**, rather than proof of actual underspend.

## Data quality is visible

The source is retained without silent correction. The import audit reports:

| Finding | Observed records |
| --- | ---: |
| Grade survey responses inconsistent with attendance cells | 1,858 |
| Subject survey responses inconsistent with attendance cells | 1,669 |
| Finance utilization-rate discrepancies greater than 0.1 percentage points | 37 of 45 |
| Reported cumulative spend inconsistent with historical monthly spending | 4 |

These counts reflect the respective checks; overlaps between issue categories are possible. Only indexed, explicitly synthetic images are shown as supporting media.

## Technical architecture

```text
Original synthetic CSVs and media
            ↓
Python standard-library normalization + source-quality audit
            ↓
Normalized JSON + indexed synthetic media
            ↓
Pure TypeScript metrics, risk, review and grant modules
            ↓
Chalkline browser interface (static-first)
            └─ Optional Node narrative API → validated AI wording or deterministic fallback
```

The interface uses browser-native TypeScript, SVG and CSS. No runtime framework, external chart service, analytics tracker or third-party font CDN is required. A Node server is included for local/API use; the published GitHub Pages edition is fully static and keeps all factual reporting functional.

### Local reproducibility

Node.js 20+ and npm are required for development. The `docs/` directory already contains the compiled static application and source data, so the demo does not require a database or AI credentials.

```bash
npm install
npm test
npm run typecheck
npm run build
npm start
```

The local web server serves the application at `http://localhost:3000`. `npm run import` regenerates the normalized JSON from the synthetic source CSVs. To examine the compiled site with any static server, serve `docs/` as the document root rather than opening `index.html` through `file://`.

The TypeScript modules are divided into [`core.ts`](src/core.ts), [`grant.ts`](src/grant.ts), [`review.ts`](src/review.ts), [`narrative.ts`](src/narrative.ts) and view components in [`src/pages`](src/pages). The original source CSVs are kept under `original_data/`; the normalized JSON used by the browser is under `docs/data/`.

### Optional AI boundaries

The Node API optionally accepts an OpenAI-compatible narrative service through server-side `NARRATIVE_API_URL`, `NARRATIVE_API_KEY` and `NARRATIVE_MODEL` variables. The model receives only the computed fact list. Its output must pass citation and number checks; otherwise the deterministic narrative is displayed. The checks are structural and numerical, **not a guarantee of semantic truth**. No LLM key is included in the repository or needed for the GitHub Pages site. On GitHub Pages, optional AI wording is not connected; deterministic reports remain fully available.

## Validation and limitations

Automated tests cover attendance denominators, filters, risk boundaries, all grant/month reconciliations, finance discrepancies, priority actions, narrative rejection and source audits. The initial release passed **18/18 tests** and strict TypeScript checking. Detailed results and scope are recorded in [engineering/VERIFICATION.md](engineering/VERIFICATION.md).

This is a historical synthetic dataset, not a production backend. A field deployment would require source validation and approvals, role-based access, immutable audit history, consent and retention controls, proper financial reconciliation, and human review of narrative claims. The runtime AI connection has been tested for fallback behavior, not with a real provider API key.

---

*Chalkline is an independent educational programme analytics case study. All figures, entities and media are synthetic.*

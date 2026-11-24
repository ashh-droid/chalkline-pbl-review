# Verification report

## Automated source and data checks

The GitHub Actions validation workflow runs on every push to the production and redesign branches, and on pull requests. It installs pinned development dependencies, formats and typechecks the TypeScript source, reproduces the compact synthetic school dataset from the original records, then **rebuilds the JavaScript before running tests**.

The unit suite checks the underlying indicators, risk thresholds, selected class/subject denominators, geographic rankings, grant-month reconciliations, finance/source warnings, proposed meeting actions, narrative citation safeguards and compact-data equivalence. A passing old compiled bundle cannot substitute for a fresh source build.

## Real-browser acceptance

The acceptance script launches the HTTP-served application in headless Chromium and exercises six viewport widths: **360, 390, 768, 1024, 1366 and 1440 CSS pixels**. It checks:

- Exactly two main navigation tabs, the visible month and programme finding, and three calculated KPIs.
- Priority rows, the three-month stacked status comparison, and the district register.
- District expansion; block record and three-month data; date-label clearance beside the bars.
- The keyboard Escape action for both block and calculation drawers.
- Month changes, class selection and visible active filters.
- All three grant selectors, cited fact ledger, collapsed Supporting details and synthetic evidence loading.
- Meeting-pack print flow and restoration of the month view.
- No JavaScript page errors or page-level horizontal overflow at the tested widths.
- On a 1366 × 768 screen, the first-screen summary cards fit above the bottom of the viewport.

The workflow generates updated desktop and phone screenshots and the share-preview image from the running browser. View the latest GitHub Actions run for the executable evidence and status; previously passed runs do not certify a later commit.

## Manual and external release checks

The browser suite covers the main workflow and narrow layouts. It is not a substitute for independent Safari/Firefox checks, assistive-technology reviews, actual printer/PDF review, or a Lighthouse audit. No Lighthouse 95+ score or under-one-second performance result is claimed without measurement.

The earlier public-site review checked the former four-page release. **The two-page redesign requires the current GitHub Pages deployment to succeed before its live-site status can be described as verified.** Preserve the live-site URL and confirm the deployment status after merging the validated redesign into `main`.

## Boundaries

The school, grant, finance and evidence records are synthetic. Budget values are source-provided units, not a named currency. Proposed actions in the printed meeting pack are recommendations, not recorded assignments. AI-generated narrative support is optional in a server edition; the public static edition uses deterministic source-linked writing and needs no API key.

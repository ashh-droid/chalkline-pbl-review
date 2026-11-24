# Verification report

## Automated checks

The repository's validation workflow runs on pushes and pull requests. It installs dependencies, performs strict TypeScript checks, regenerates the compact school-response dataset from the original source, and runs the Node test suite **after rebuilding** `src/` into `docs/app/`.

Coverage includes school participation and evidence denominators, grade and subject filters, attendance opportunities, status thresholds, geographical aggregation, grant-month reconciliation, finance warnings, narrative citation and number validation, and proposed meeting actions. The compact-data test compares every recorded enrollment, attendance, participation and evidence value against the full source.

See the current GitHub Actions result for the passing/failing state. A green badge is required before releasing changes to the public demo.

## Browser acceptance review

On 24 November 2026, a manual review of the previously published GitHub Pages version reported:

| Check | Result reported |
| --- | --- |
| Programme review, meeting pack, grant reporting and data notes | All four views opened |
| Month and geography filters | Responded correctly |
| Browser console | No page errors observed |
| Keyboard focus | Visible and operable |
| Indexed evidence and photos | Loaded |
| Mobile browser layout | No page-level horizontal scrolling observed |

These are manual observations of the earlier live version, not proof that subsequent edits have passed the same checks. The current release requires re-running responsive and interactive checks after deployment.

## Release acceptance checklist

- [ ] GitHub Actions typecheck, compact-data audit and fresh-build tests pass
- [ ] Published Pages build loads with no script or data requests failing
- [ ] Filters, chart/table views, CSV downloads, priority links, print/export and fact citations work
- [ ] Chart labels and detail-panel timelines do not overlap at 360, 390, 768, 1024 and 1440 CSS pixels
- [ ] Keyboard and screen-reader tables work, including reduced-motion mode
- [ ] Open Graph sharing image and canonical URL resolve correctly
- [ ] No page-level horizontal overflow; no critical browser console errors

## Boundaries

The site uses synthetic educational, finance and media records. Human review is required before interpreting the draft report operationally. The optional AI endpoint was checked for deterministic fallback behavior, not against an authenticated external provider.

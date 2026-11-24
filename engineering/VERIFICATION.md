# Verification and test coverage

- `npm test`: 18/18 passing after the redesign.
- `npm run typecheck`: passed with TypeScript strict mode.
- `npm run build`: passed; compiled site in `docs/app/`.
- Node server HTTP: `/`, `/api/health`, evidence PNG, and `/api/narrative` verified. The latter returned a deterministic fallback without an AI key.
- Chromium fixture-injection check: program verdict, three bullet rows, 395 block tiles and month switch, selected-block three-month trend, 38 district dots, expanded geography table, meeting agenda with five slots and four proposed actions, grant ledger (13 facts), finance rows, indexed evidence images (naturalWidth > 0), AI fallback, four data-method notes.
- No JavaScript page errors from the Chromium check.
- Mobile viewport 390px: no horizontal document overflow.
- Meeting pack printed as one A4 page in Chromium.
- **Limitations:** direct Chromium localhost navigation was blocked in the development environment. Screens were tested by injecting compiled modules and fixtures into a browser; an unrestricted public live-site test is still required. Optional AI service with a real key was not tested.

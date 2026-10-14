# Merchant–Driver Workflow Audit

## Goal

Audit and resolve reproducible failures affecting the merchant and driver order lifecycle, with evidence from tests and builds.

## Scope

Merchant order visibility/creation → driver assignment and acceptance → pickup evidence/status → delivery evidence/status. Out of scope unless blocking: payments, analytics, admin, accounts.

## Phases

1. **Project context and evidence** — inspect repo state, architecture, recent changes, test commands, workflow entry points. Status: complete.
2. **Failure analysis** — trace boundaries (merchant UI/API, driver UI/API, realtime/offline queue) and run the existing tests to establish a baseline. Status: complete.
3. **Targeted fixes** — for each confirmed bug, add a failing regression test first, implement the smallest root-cause fix, and verify it. Status: complete.
4. **Final verification** — run relevant tests/type-check/builds and inspect final diff. Status: complete.

## Next Step

Done. Audit fixes committed in fc85b19; final full API re-run green (399/399). Uncommitted work in tree (variant maxSelections + menu UI) left untouched.

## Decisions Made

- Treat the Cloudinary error as a configuration path to verify; do not request or repeat credentials in chat.
- Fix the no_driver dead end with merchant-owned retry/cancel (pending/cancelled) plus fresh contest window and fleet re-alert.
- Fix scheduled discovery with ?scheduled=true returning driver_proposals instead of immediate pending orders.
- Keep default getAvailableOrders behavior unchanged when the flag is absent.
- Validate photo size/type on the client before upload and add upload timeouts; keep server magic-bytes + 5MB as source of truth.

## Errors Encountered

| Error                                       | Attempt | Resolution                                                               |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| New regression spec failed 3/4 on first run | 1       | Expected RED; implemented minimal service + controller fixes, all 4 pass |
| api has no type-check script                | 1       | Used npx tsc --noEmit -p tsconfig.json per app/package                   |

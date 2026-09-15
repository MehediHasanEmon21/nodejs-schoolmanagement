# Development Progress

Current Phase: 5 — Roles & Permissions
Status: READY FOR NEXT PHASE

## Completed phases

- [x] Phase 1 — Architecture baseline.
- [x] Phase 2 — Docker development environment.
- [x] Phase 3 — Express/EJS/Tailwind application foundation.
- [x] Phase 4 — Session authentication (commit `3189599`).
- [x] Phase 5 — Roles and permissions; all seven action-plan items verified.

## Phase 5 implementation

- Added `Role` and `Permission` models with unique string IDs, status and timestamps.
- Connected existing `User.role` values to persisted role records without changing account IDs or requiring migration.
- Added startup/first-admin initialization for five roles and eleven permission definitions. Existing grants and inactive statuses are preserved.
- Added authorization resolution from current database state on every authenticated request; no role/grant cache in sessions.
- Added `requireRole`, `requirePermission` and `requireResource` middleware, plus reusable service-level permission and ownership policies.
- Protected `/dashboard` with `dashboard.view`; safe 403 responses explain access denial. Missing/unauthorized resources receive 404.
- Defined Super Admin bypass centrally: active registered permissions only, exact role checks, explicit opt-in for ownership bypass, no bypass of resource existence or business invariants.
- Added authorization unit/integration tests and included both integration files in `npm run test:integration`.
- Updated README, [authentication](authentication.md), [authorization](authorization.md) and action-plan status.

## Verification

- `docker compose config --quiet`: passed.
- `docker compose up -d --build --wait`: build passed; application and MongoDB healthy.
- `docker compose exec -T app npm run check`: 32 JavaScript files passed.
- `docker compose exec -T app npm run build`: Tailwind compilation passed.
- `docker compose exec -T app npm test`: 19 passed, 0 failed.
- `docker compose exec -T app npm run test:integration`: 8 passed, 0 failed (authentication lifecycle, authorization lifecycle and six authorization subtests). Test databases removed after HTTP servers closed.
- Authorization tests cover role/permission references, unique IDs, non-destructive initialization, all five roles, direct URLs, multiple required permissions, forged ownership, other users' resources, async teacher/guardian relationship fixtures, live role/grant changes, missing/inactive records, logout after denial, restricted Admin access and explicit Super Admin bypass.
- Live checks: `/` and `/login` return 200; anonymous `/dashboard` redirects to `/login`; test-only `/test/admin` returns 404. Five roles and eleven permissions exist in the app database. Missing timestamps from the initial development seed were filled without changing grants.
- `git diff --check`: passed. Manifest/lockfile dependencies remain consistent; no dependencies added. Local `.env` and generated CSS remain ignored.

## Scope and remaining work

No Phase 5 implementation items remain. The app runs at http://localhost:3001. Existing accounts keep working; new installations can run `docker compose exec app npm run setup:admin` for their first administrator.

Resource guards are verified against persisted users and relationship fixtures in test-only routes. Actual academic assignment/guardian models, scoped module lists and resource endpoints must use these guards when their designated phases are implemented. Role-editing screens and later business modules are not implemented in this phase.

There is no separate linter; syntax, unit, HTTP and MongoDB integration checks passed. No browser visual test was needed for this authorization-focused change.

Phase 6 — Dashboard & UI Foundation has not started.

# Development Progress

Current Phase: 4 — Authentication
Status: READY FOR NEXT PHASE

## Phase 4 completed

- [x] User schema, normalized unique email, account status and last login timestamp.
- [x] Argon2id password hashing and protected password-write paths.
- [x] Login validation and safe invalid-credential handling.
- [x] Persistent MongoDB sessions, secure cookie configuration and idle/absolute expiry.
- [x] Login/session regeneration, POST logout, CSRF and shared login throttling.
- [x] Guest/authentication middleware and protected dashboard.
- [x] Interactive first Super Admin setup and configuration documentation.
- [x] All nine Phase 4 action-plan checklist items verified.

## Work completed from the existing partial implementation

- Preserved the existing authentication MVC implementation and completed verification.
- Fixed session-store database selection to match the active Mongoose database, including integration-test overrides.
- Replaced deprecated Mongoose update options with `returnDocument: 'after'`.
- Fixed the password test to verify Argon2 parameters independently of serialization order.
- Added password-change coverage and fixed integration teardown to close HTTP servers before MongoDB.
- Updated README setup/login instructions, [authentication guide](authentication.md), and phase checklist.

## Phase 4 verification

- `docker compose config --quiet`: passed.
- `docker compose up -d --build --wait`: image built; app and MongoDB healthy.
- `docker compose exec -T app npm run check`: 25 JavaScript files passed syntax checks.
- `docker compose exec -T app npm run build`: Tailwind compilation passed.
- `docker compose exec -T app npm test`: 13 passed, 0 failed.
- `docker compose exec -T app npm run test:integration`: 1 MongoDB lifecycle test passed, 0 failed, with clean shutdown. Covers password creation/change, unique email, validation, invalid credentials, CSRF, session fixation, protected/guest routes, escaping, persisted sessions across app instances, logout, inactive accounts, both expiration limits and shared throttling.
- Live HTTP checks: `/` and `/login` return 200; unauthenticated `/dashboard` redirects to `/login`; GET `/logout` returns 404.
- Interactive `setup:admin` verified in a temporary database: password prompts stayed hidden, one Super Admin was created and authenticated, and the test database was removed.
- No separate linter is configured. Unit, HTTP and MongoDB integration checks provide authentication verification; no new browser visual inspection was performed.
- Local `.env` and generated CSS remain ignored. Git metadata now works; the earlier phase reports below describe the previous workspace state.

## Phase boundary

The app is running at http://localhost:3001. No Phase 4 implementation items remain. Provision your own first administrator with `docker compose exec app npm run setup:admin`; no default credentials are created. Phase 5 roles/permissions has not been started.

## Earlier phase history

## Completed

- [x] Phase 1 architecture baseline.
- [x] Phase 2 Docker development environment.
- [x] Phase 3 Express JSON/form parsing and static assets.
- [x] Reusable MongoDB connection, retries, lifecycle logging and shutdown.
- [x] EJS layouts, welcome page and all requested shared UI partials.
- [x] Tailwind build and supervised CSS/server watchers.
- [x] Safe 404/error pages, request references and structured logs.
- [x] All nine Phase 3 checklist items verified.
- [ ] Commit phases: `git status --short` fails because the supplied `.git` directory is not a usable Git repository.

## Files changed

- `src/app.js`, `server.js`, `src/config/`, `src/routes/`, `src/controllers/`, `src/middleware/`, `src/utils/`.
- `src/views/`, `src/styles/`, `public/js/`, `public/images/` and generated ignored `public/css/app.css`.
- `scripts/`, `tests/foundation.test.js`, `package.json`, `Dockerfile`, `.gitignore`, `.dockerignore`.
- `README.md`, action-plan checklist, this progress file and [application-foundation.md](application-foundation.md).
- No dependencies changed; package-lock dependency declarations still match package.json.

## Verification

- `docker compose config --quiet`: passed.
- `docker compose exec -T app npm run build`: Tailwind minified compilation passed.
- `docker compose exec -T app npm run check`: all 12 JavaScript files passed syntax checks.
- `docker compose exec -T app npm test`: 9 passed, 0 failed. Covers HTTP rendering/static assets, parsing and limits, escaped UI, error handling/fallback, logging privacy and missing database URI.
- `docker compose up -d --build --force-recreate --wait app`: image built with CSS; app and MongoDB healthy; database connected.
- Template edit generated a new Tailwind class via the watcher; controller edit restarted nodemon and reconnected MongoDB. Temporary edits removed and generated CSS checked afterward.
- Headless browser verified 1440px desktop and 390px mobile layouts, styles, responsive navigation, Escape/focus, no horizontal overflow, 404 recovery, no JavaScript errors and navigation without JavaScript. Desktop/mobile screenshots inspected.
- `docker compose restart app` then `docker compose up -d --wait`: combined development processes restarted cleanly; both services healthy.
- Documentation links, manifest/lock consistency, environment exclusions and temporary-file cleanup checks passed.
- npm reports the existing optional Parcel watcher script notice; CSS compilation and live watching both work without additional approvals or packages.

## Local environment and remaining work

- App remains running at http://localhost:3001 because port 3000 is occupied. `.env.example` retains the default 3000.
- Git metadata remains unusable, so the required commit cannot be created here.
- No separate linter is configured; syntax checks, automated tests, asset build and browser/runtime checks provide Phase 3 verification.
- Phase 4 — Authentication has not started. Restore usable Git metadata and commit the project excluding `.env`; continue to the next phase only when requested.

See [architecture.md](architecture.md) for the unchanged system assumptions and future transaction requirements.

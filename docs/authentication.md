# Authentication — Phase 4

## Using authentication

Start Docker as described in the [README](../README.md), then run `docker compose exec app npm run setup:admin` in a terminal to provision the first Super Admin. Setup prompts for name, email and a hidden password with confirmation. It refuses to overwrite an existing Super Admin. Passwords must contain 12–128 characters; no credentials are seeded automatically.

| Route | Behavior |
| --- | --- |
| `GET /login` | Guest login form; signed-in users redirect to `/dashboard`. |
| `POST /login` | Validates CSRF and credentials, regenerates and saves the session, then redirects to `/dashboard`. |
| `GET /dashboard` | Requires an active authenticated user. |
| `POST /logout` | Requires authentication and CSRF; destroys the session, clears its cookie and redirects to `/login`. |

The public welcome page remains at `/`. The dashboard contains only the authenticated welcome screen; permission management and dashboard modules remain in later phases.

## Configuration

| Variable | Default / requirement |
| --- | --- |
| `SESSION_SECRET` | Required generated secret, at least 32 characters; placeholders rejected. |
| `SESSION_IDLE_MINUTES` | `30`; integer between 1 and 10080. |
| `SESSION_ABSOLUTE_MINUTES` | `720`; integer between 1 and 10080. |
| `NODE_ENV` | Production enables the cookie's `Secure` flag and requires HTTPS for login sessions. |
| `TRUST_PROXY` | Empty by default; configure only trusted proxy IPs/subnets behind HTTPS. |

Changing environment settings requires recreating the app container. Changing the session secret invalidates existing cookies.

## Implementation and security

- `User` stores normalized unique email, name, role, status, last login time and timestamps. Roles are a fixed enum for this phase; permission enforcement is Phase 5.
- Argon2id hashes passwords on document save using 64 MiB memory, three iterations and parallelism one. Query-based password changes, replacement writes, bulk writes and bulk inserts are rejected to prevent bypassing hashing. Use `document.save()` for account creation/password changes. Passwords are excluded from normal queries and JSON serialization.
- MongoDB sessions use the same database as the Mongoose connection, including database-name overrides. Session contents contain a user ID, timestamps and CSRF metadata, never credentials.
- Cookies use `HttpOnly`, `SameSite=Lax`, explicit expiry and production `Secure`. Server checks enforce idle and absolute expiration independently of cookie expiry and MongoDB TTL cleanup.
- Successful login regenerates the session ID to prevent fixation. Each authenticated request rechecks account existence/status. Logout destroys the stored session so an old cookie cannot restore access.
- Login and logout forms carry random session-bound CSRF tokens. Protected HTML responses use `Cache-Control: no-store`. EJS escapes account data and login forms never repopulate passwords.
- Unknown users, inactive users and incorrect passwords receive the same invalid-credentials message. Unknown-user requests also perform password verification against a dummy hash.
- MongoDB-backed fixed 15-minute rate-limit windows allow 10 login attempts per normalized email and 30 per IP. Limits survive app restarts and are shared by app instances. Keys are HMAC digests; expired records use a TTL index. Rejected attempts return HTTP 429 with `Retry-After`.

## Verification

```bash
docker compose config --quiet
docker compose up -d --build --wait
docker compose exec -T app npm run check
docker compose exec -T app npm run build
docker compose exec -T app npm test
docker compose exec -T app npm run test:integration
```

The unit/foundation suite contains 13 tests. The MongoDB integration suite exercises user uniqueness, password hashing and changes, login validation, invalid credentials, CSRF, session regeneration, guest/protected routes, escaping, logout, account deactivation, idle/absolute expiry, persistent sessions across app instances and shared throttling. It creates a randomly named database and closes HTTP servers before deleting that database and disconnecting.

No separate linter is configured. Docker startup, live route responses, syntax checks, asset compilation and both test suites were verified for Phase 4. Production deployment configuration remains a later phase.

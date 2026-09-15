# Application Foundation — Phase 3

## Application lifecycle

`src/app.js` exports `createApp()` for server startup and isolated HTTP tests. It sets absolute views/static paths independent of the working directory, configures EJS, installs request context and bounded JSON/form parsing, mounts routes, and ends with 404/error middleware.

`server.js` validates the port, calls `connectDatabase()` from `src/config/database.js`, then listens. The database module owns the five-attempt bounded connection policy and connection-event logging. Shutdown closes HTTP before disconnecting MongoDB. A failed startup exits nonzero without printing the database URI.

The home route delegates presentation to `home.controller.js`. Business services and models are introduced only when a module needs them. No authentication, school records, or dashboard metrics are implemented in Phase 3.

## Shared views

Pages include `layouts/start` before content and `layouts/end` afterward. The layout uses navbar, sidebar and footer partials, with a keyboard skip link, named navigation landmarks and a single main region. Pass a page `title` and, optionally, `activePage`. Pages own their heading via the header partial.

| Partial | Inputs and behavior |
| --- | --- |
| `header` | `heading`; optional `eyebrow`, `description`; renders the page h1 |
| `alert` | `message`; optional `kind` (`info`, `success`, `error`); errors use alert semantics |
| `form-control` | `name`, `label`; optional `id`, `type`, `value`, `required`, `hint`, `error`, `autocomplete`, `options` |
| `button` | `label`; optional `type`, `variant` (`secondary` or default primary), `disabled`; defaults to a non-submitting button |
| `table` | `caption`, `columns` containing `key`/`label`, `rows`; optional `emptyMessage`; escaped text cells and accessible horizontal scrolling |
| `pagination` | `page`, `totalPages`; optional `previousUrl`, `nextUrl`; absent links render disabled boundaries |
| `breadcrumbs` | `items` containing `label` and optional `href`; last item is the current page |

Phase 6 adds metric cards, empty states, icons and a native confirmation modal; see [dashboard and shared UI](dashboard.md) for their interfaces, permission-aware layout context and browser verification.

Controls support text/email/password/number/date/tel/search inputs, textarea, and select options (`value`, `label`). Labels connect to IDs, errors connect through `aria-describedby`, and password values are never repopulated. Use unique IDs when a page repeats field names. Controllers supply validated values and internal application URLs; do not pass raw request objects or user-selected view names into EJS. Pagination controllers own positive page counts and filter-preserving URLs. State-changing forms will receive CSRF protection when introduced in their owning phase.

All variable text uses EJS escaping. Raw output is reserved for trusted includes. Tables deliberately accept text data, not raw HTML. These partials are tested in isolation so the public welcome page does not expose pretend school workflows.

## Assets and development

- Tailwind input: `src/styles/app.css`; scans `src/views` and `public/js` explicitly.
- Generated output: `public/css/app.css`; ignored by Git and the Docker build context.
- Browser behavior: `public/js/app.js`; progressive mobile navigation, desktop breakpoint handling and Escape to close. Navigation remains available without JavaScript.
- Images: `public/images/`; includes a small local SVG school mark.
- `npm run build`: minified CSS compilation, also run while building the Docker image.
- `npm run dev`: builds CSS first, then supervises the CSS watcher and nodemon; stopping the supervisor signals both process groups. This development runner targets the Linux Docker environment.
- `npm run check`: syntax-checks server, source, browser, scripts and tests.
- `npm test`: Node HTTP/component tests; build CSS first on fresh checkouts.

Tailwind build/watch succeeded with the installed prebuilt packages. npm still emits its Phase 2 notice about the optional Parcel watcher install script; no script approval or new dependencies were needed.

## Errors and operational logs

JSON and URL-encoded bodies are limited to 100 KB; forms are limited to 100 parameters. Malformed, oversized and unsupported requests receive safe error pages. Unknown routes receive HTTP 404. Async controller failures flow into Express 5 error middleware. Invalid error status codes become HTTP 500, and a failed error template falls back to plain text. Error responses disable caching.

Each request receives a new UUID in `X-Request-Id`, also shown on error pages. Incoming request IDs are not trusted. Structured JSON logs contain event, timestamp and allowlisted operational fields: request ID, method, response status, duration, retry attempt, port and error category. They omit URL/query, headers/cookies, request bodies, database URIs and raw exception messages/stacks. Use the reference ID to correlate request and error events. Database and server lifecycle events use the same logger.

Development pages additionally show an allowlisted exception category; production pages omit it. Neither environment prints raw error text or stack traces. For deeper investigation use a local debugger rather than adding sensitive payloads to logs. The Phase 22 security audit will review these controls along with features introduced later.

## Verification

Nine automated tests cover rendered layouts/assets, private-file and missing-route handling, JSON/forms and body limits, async failures and log privacy, development diagnostics, error-view fallback, escaped/accessible controls, table/pagination/breadcrumb states, and missing database configuration.

Docker checks confirm image build, healthy app/MongoDB, database connection, CSS rebuilds after template edits, and nodemon restarts after controller edits. Browser checks cover desktop/mobile styles, no horizontal overflow, toggle/Escape behavior, 404 recovery, absence of JavaScript errors, and navigation without JavaScript. Browser screenshots were inspected during implementation; the browser smoke harness was temporary, not a new project dependency.

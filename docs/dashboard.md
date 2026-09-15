# Dashboard and shared UI — Phase 6

## Dashboard

`GET /dashboard` still requires an active account, active role and `dashboard.view`. The dedicated dashboard controller uses `dashboard.service.js` to prepare presentation data, and EJS renders it through the existing shared layout.

The dashboard includes breadcrumbs, an account greeting, a school overview, a workspace list and an announcement empty state. Administrators see placeholders for total students, total teachers, total classes, today's attendance and outstanding fees. Teachers see labels for their assigned students/classes. Student and guardian views show only the summaries relevant to their permissions.

Metrics are deliberately unavailable: a dash with “Not available yet” accessible text and “Coming soon” status. No fake counts, attendance percentages, balances or school records are generated. Data queries and correct ownership/assignment scopes must be added when the corresponding modules are implemented.

## Authorization-aware navigation

`loadAuthorization` supplies the current role display name and a filtered navigation array on every request. The navbar shows the signed-in account and role. Its brand link and the sidebar's Overview link point to `/dashboard` only when the current request has dashboard permission.

Workspace entries are filtered by the same permission service used by server guards. Attendance appears when either `attendance.create` or `attendance.edit` is granted. Future modules render as non-focusable, disabled text with a “Soon” label, never links to unimplemented routes. Revoking dashboard permission removes all dashboard links and workspace entries on the next request; the route still returns 403. UI visibility supplements server authorization and never replaces it.

## Responsive layout and interaction

- Shared navbar, sidebar, header, main region and footer serve public pages and the authenticated dashboard.
- At 768px and above, the sidebar remains visible. Below that width, the Menu button controls a collapsible navigation area.
- Escape closes an open mobile menu and returns focus to its button. Choosing a navigation link closes the menu. Changing viewport width updates the menu state.
- Without JavaScript, navigation remains visible and the Menu button stays hidden.
- Metric cards and workspace sections reflow across desktop, tablet and mobile widths. Long account names wrap in the greeting and truncate in the navbar. Tables retain their own horizontal scrolling instead of overflowing the page.
- Existing skip link, landmarks, labels, active-page indicators, focus outlines and escaped EJS output are preserved.

## Reusable components

The existing table, pagination, form-control, alert and button partials remain available; see [application foundation](application-foundation.md) for their interfaces. Phase 6 adds:

| Partial | Inputs and behavior |
| --- | --- |
| `stat-card` | Required `label`; optional `icon`, `value`, `caption`. Missing/null values display an unavailable placeholder; a real `0` displays zero. All supplied values are escaped. |
| `empty-state` | Required `heading`; optional `description`, `icon`. Static, accessible explanatory content without invented records. |
| `icon` | Optional `name` from the built-in icon set; decorative SVG with `aria-hidden`. Uses local vector markup, no external asset dependency. |
| `modal` | Required unique `id`, `title`, `description`; optional `cancelLabel`, `action`, `confirmLabel`, `csrfToken`. Native dialog with labeled heading/description, safe cancellation and an optional CSRF-protected POST action. |

### Confirmation dialog

The navbar's original logout POST form has `data-confirm-dialog="logout-dialog"`. JavaScript opens the matching native dialog when supported. The reusable modal appears once at the end of the shared layout for signed-in users. Confirmation submits its own POST form with the current CSRF token.

Focus starts on “Stay signed in”. Tab/Shift+Tab wrap inside the dialog. Escape, cancellation and a backdrop click close it and return focus to the original button; the page cannot scroll while the dialog is open. Escape gives the dialog priority over the mobile menu.

If JavaScript is disabled or `showModal()` is unsupported, the original logout form submits normally. There is no JavaScript-only logout dependency. Future uses should supply a trusted internal action URL, a unique dialog ID and a matching trigger form; never accept action URLs, view names or raw HTML from a request.

## Verification

```bash
docker compose config --quiet
docker compose up -d --build --wait
docker compose exec -T app npm run check
docker compose exec -T app npm run build
docker compose exec -T app npm test
docker compose exec -T app npm run test:integration
```

The unit/component/foundation suite contains 24 tests. The integration suite reports 8 passing checks, including the existing authentication/authorization lifecycles and new assertions for rendered navigation and live permission revocation.

Headless Chrome verified 1440px desktop, 768px tablet, 390px mobile and a 320px long-name case with no horizontal page overflow. Browser checks covered menu/Escape behavior, modal focus wrapping and restoration, cancellation/backdrop/confirmation, permission-filtered navigation, shared form/table/pagination rendering and scrolling, and navigation/logout without JavaScript. No page JavaScript errors occurred. Desktop, tablet, mobile, dialog and component screenshots were inspected.

The browser harness ran a separate temporary Docker app and MongoDB database; its test accounts and component-preview route are not part of the production app. No browser-testing package or other dependency was added.

Phase 7 academic-year management and later school modules remain unimplemented.

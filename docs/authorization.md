# Roles and permissions — Phase 5

## Data and initialization

The relationship is `User.role → Role._id → Role.permissions[] → Permission._id`.

Roles use the existing stable IDs `super_admin`, `admin`, `teacher`, `student` and `guardian`. Existing accounts and sessions require no data migration. Permission IDs use `resource.action` names. Both models have timestamps and active/inactive status; IDs are unique through MongoDB's `_id` index. Role documents reject duplicate permission references.

App startup and first-admin setup call `seedAuthorization()` before accepting authenticated work. This inserts the five roles and eleven initial permission definitions. It never overwrites an existing role's grants, name, status or timestamps, and never reactivates an existing inactive permission. Initialization creates no users.

To revoke access persistently, remove a grant from the role or mark the role/permission inactive. Deleting a built-in definition denies access immediately, but initialization recreates missing built-in records on the next startup. Later catalog additions do not automatically add grants to existing roles; those changes need an explicit reviewed update.

The initial grants live in [authorization config](../src/config/authorization.js):

| Role | Initial permissions |
| --- | --- |
| Super Admin | All registered active permissions through the centralized bypass policy below. |
| Admin | All eleven initial operational permissions. |
| Teacher | Dashboard, student/teacher viewing, attendance creation/editing, result viewing/creation. |
| Student | Dashboard, student viewing, result viewing, fee viewing. |
| Guardian | Dashboard, student viewing, result viewing, fee viewing. |

These grants allow an action to proceed to its resource policy. They do not authorize unrestricted student lists, fees, attendance or results. Those modules and their database relationships are implemented in their designated phases.

## Request enforcement

Authentication loads the active user from MongoDB. `loadAuthorization` then resolves the current active role and active referenced permissions for that request. Missing/inactive users or roles produce no authorization. Dangling or inactive permission references grant nothing. Database errors propagate through the safe error handler and do not permit access.

Authorization is not stored in sessions. User role changes, grant removals, disabled roles and disabled permissions affect the next request without requiring a new login. An authenticated user without permission receives HTTP 403 and can still log out. Unauthenticated callers of authorization guards redirect to `/login`.

The production `/dashboard` route now requires `dashboard.view`. This phase supplies the reusable authorization foundation; school resource endpoints, role-editing screens and authorization-aware dashboard navigation remain in their own phases.

### Role and permission guards

```js
router.get('/dashboard', requirePermission('dashboard.view'), showDashboard);

// Any explicitly listed role can pass. Super Admin is not added implicitly.
router.use('/restricted-area', requireRole('admin', 'super_admin'));

// All listed permissions are required.
router.use('/some-action', requirePermission('student.view', 'student.edit'));
```

Use `requireRole('super_admin')` for future protected role-management entry points. Admin's operational grants do not imply the ability to change roles or permissions. No public role/permission mutation endpoints are introduced in Phase 5. Future mutation services must also validate the actor, target role and referenced permissions, allowlist fields, and record sensitive changes.

### Resource access

`requireResource(permission, { load, policy, allowSuperAdmin })` enforces permission before loading a resource, then runs a server-side policy. Loaders must validate route/body IDs and query persisted data. Return `null` for missing or inaccessible resources; do not treat a submitted owner/assignment field as trusted.

The provided `ownsResource` policy compares the authenticated user's ID with the loaded resource's `user` reference, supporting ObjectIds and populated references. Missing ownership information denies access. Example for a future module:

```js
router.get('/:id', requireResource('student.view', {
  load: async (request) => {
    if (!mongoose.isObjectIdOrHexString(request.params.id)) return null;
    return Student.findById(request.params.id);
  },
  policy: ownsResource,
}), showStudent); // The authorized document is request.resource.
```

This is an integration example, not a Phase 5 Student endpoint. Teachers and guardians need their own async policies querying active assignments or guardian links, with academic year/class/section/subject scope as appropriate. A policy must return the boolean `true`; missing policies, missing relationships and other return values do not authorize access. Errors fail the request rather than allowing it.

Missing and unauthorized resources both receive HTTP 404 to avoid disclosing other users' records. A missing permission receives HTTP 403 before any resource lookup. For lists, apply equivalent ownership/assignment constraints in the database query before pagination/counting; permission checks alone are insufficient. For writes, enforce resource access and invariants in the service too, and retain CSRF and input validation.

Services can reuse `hasPermission`, `hasRole`, `ownsResource` and `canAccessResource` from [authorization.service.js](../src/services/authorization.service.js). Supply a context resolved from the authenticated database user, never a role or permission list supplied by the client.

## Super Admin policy

- Requires an active user and active persisted `super_admin` role.
- Bypasses individual role grants for registered, active permissions. Unknown and disabled permissions remain denied.
- Exact role guards still require `super_admin` to be explicitly listed.
- Ownership bypass is **off by default**. A route/service must explicitly pass `allowSuperAdmin: true` when access to other users' resources is intended.
- Never bypasses authentication, CSRF, resource existence, input validation or business invariants. Keep invariants outside the ownership policy so a permitted bypass cannot skip them.
- Ordinary Admin never receives the Super Admin bypass.

## Verification

```bash
docker compose config --quiet
docker compose up -d --build --wait
docker compose exec -T app npm run check
docker compose exec -T app npm run build
docker compose exec -T app npm test
docker compose exec -T app npm run test:integration
```

The unit/foundation suite contains 19 tests. The integration command runs the existing authentication lifecycle plus authorization integration coverage in separate random databases, then removes those databases. Authorization coverage includes stable references, unique records, repeat initialization, all five roles, direct URLs, multiple required permissions, forged identity/ownership fields, other users' resources, async assignment/link policies, explicit Super Admin bypass, business invariants, live revocation and restricted Admin access to a Super Admin-only guard.

The `/test/*` endpoints exist only inside the integration test app. They exercise resource policies against persisted users and explicit relationship fixtures; no future academic module is added to the production app.

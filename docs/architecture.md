# School Management System Architecture

Phase 1 design baseline. Application scaffolding and Docker configuration begin in Phase 2.

## Scope and decisions

- One school per deployment and database initially. Multi-school tenancy is outside the current roadmap; introducing it requires revisiting every scoped query, relationship, and unique index.
- Use Node.js, Express, MongoDB, Mongoose, EJS, Tailwind CSS, vanilla JavaScript, npm, and Docker Compose as specified in the action plan.
- Render pages on the server. Use ordinary forms for mutations and redirects after successful submissions. Introduce JSON endpoints only where a concrete interaction requires them.
- Keep student identity separate from yearly enrollment and teacher identity separate from academic assignments.
- Initially each login has one role. Student, teacher, and guardian profiles can exist before a login is provisioned. Changing to multiple roles is a later explicit decision.
- Store instants in UTC. Configure a school timezone for attendance dates and timetable interpretation; use `Asia/Dhaka` as the initial development default. Represent school calendar dates explicitly as dates, without converting them through the browser timezone.
- These are implementation defaults, not additional features or evidence of stakeholder approval. Revisit them before implementing an affected module if school requirements differ.

## Roles and access boundaries

| Role | Intended access | Boundary |
| --- | --- | --- |
| Super Admin | System administration, role/permission management, all school modules | Explicit permission bypass only; never bypass account status, validation, or data integrity rules |
| Admin | Daily school operations, people, academics, finances, notices, reports | Cannot grant Super Admin or alter protected system roles; role administration requires an explicit permission |
| Teacher | Assigned rosters, attendance, subject marks, timetable, relevant notices | Current academic assignment must match the requested year/class/section/subject as applicable; no finance management |
| Student | Own profile, enrollment, attendance, published results, fees, timetable, notices | Resolve the student profile from the authenticated user; no access to another student |
| Parent / Guardian | Linked students' permitted academic and financial information, relevant notices | Active guardian-student relationship required; no access to unlinked students |

Use stable role keys `super_admin`, `admin`, `teacher`, `student`, and `guardian`. Maintain permission names such as `student.view`, `student.create`, `attendance.edit`, and `result.publish`. Grant permissions deliberately in Phase 5; do not infer permissions from a displayed role label.

## Module responsibilities

| Module | Owns / depends on |
| --- | --- |
| Authentication | Login, logout, password verification, persistent sessions, account eligibility |
| User Management | Login identities, provisioning, account status, profile links |
| Roles & Permissions | Role grants, permission catalog, centralized access policies |
| Dashboard | Role-scoped summaries from existing modules |
| Academic Years | Calendar boundaries, current-year selection, year status |
| Classes | Stable grade/class definitions |
| Sections | Sections belonging to a class |
| Subjects | Subject catalog and class-subject associations |
| Students | Student identity and admission data; optional user reference |
| Teachers | Teacher identity and employment data; optional user reference |
| Guardians | Guardian contact data and student relationships; optional user reference |
| Enrollments | Student placement in an academic year, class, section, and roll number; history |
| Teacher Assignments | Teacher responsibility by year, class, section, and subject |
| Attendance | Daily records against enrollment, with recording actor and status |
| Exams | Exam definitions, academic scope, subject configuration, dates, mark limits |
| Results | Marks against exam subject and enrollment, calculation, publication |
| Fees | Fee types and individual student obligations, due dates, outstanding calculation |
| Payments | Payments against obligations, partial payments, receipts and reversals |
| Timetables | Year-specific weekly class/teacher/room slots and conflict checks |
| Notices | Content, publication window, role/class/section audiences |
| Reports | Authorized filtered/printable views of source-module data |

Implement modules in roadmap order. Dashboard and reports consume source data rather than duplicating ownership of it.

## MVC and request flow

`Route → authentication → permission check → request validation → controller → service (including resource policy) → repository/model → controller → EJS view`

| Layer | Responsibility |
| --- | --- |
| Routes | Map HTTP methods and URLs to middleware and controllers |
| Controllers | Read validated inputs, call services, choose a view/redirect/status; no business calculations |
| Services | Business rules, resource authorization, relationship checks, write coordination and calculations |
| Repositories | Optional reusable/complex persistence queries; simple services may call models directly |
| Models | Mongoose schemas, field validation, references, indexes and timestamps |
| Middleware | Authentication, permission gates, CSRF, shared request context, error handling |
| Validators | Allowlisted input fields, types, formats, ranges, ObjectId syntax; never pass raw request objects into queries |
| Views | Escaped presentation and shared partials; no database queries or access-control decisions |
| Config | Validated environment configuration, database/session/view setup |
| Utils | Small reusable functions without request or business-state coupling |

An authenticated actor must accompany service calls that need authorization. Resource policies also apply to list queries, reports and exports. Hiding a button is only presentation. Use a central error handler, consistent validation errors, and production-safe error pages.

## Final target folder structure

Create directories when their phase first needs them; this tree is the agreed implementation baseline, not scaffolding to generate in Phase 1.

```text
school-management/
├── docs/
│   ├── school-management-system-action-plan.md
│   ├── architecture.md
│   └── development-progress.md
├── src/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── validators/
│   ├── utils/
│   ├── views/
│   │   ├── layouts/
│   │   ├── partials/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── guardians/
│   │   ├── academics/
│   │   ├── attendance/
│   │   ├── exams/
│   │   ├── fees/
│   │   └── notices/
│   └── app.js
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── tests/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env                 # Local only; never committed
├── .env.example         # Documented non-secret placeholders
├── package.json
├── package-lock.json
└── server.js
```

`src/app.js` assembles and exports Express without listening. `server.js` loads configuration, connects to MongoDB, starts the HTTP server, and handles shutdown. Use JavaScript ES modules, camelCase variables/functions, PascalCase model names, and descriptive files such as `student.controller.js`, `student.service.js`, and `Student.js`. Use plural resource URLs, GET for reads and POST for HTML form mutations; GET must not change state. Use EJS includes for reusable layout pieces without requiring a layout extension by default.

Use npm with a committed lockfile and reproducible installs. Add scripts and dependencies only when implemented. Keep tests organized by unit, integration and HTTP responsibility as they become relevant; verify critical rules in their owning phase rather than postponing every test until Phase 23.

## MongoDB modeling strategy

### Relationships and document boundaries

- Use ObjectId references for independently managed entities: user → role → permissions; profiles → optional user; section → class; enrollment → student/year/class/section; assignment → teacher/year/class/section/subject.
- Use a `GuardianStudent` relationship collection for many-to-many links, relationship type, and access status. Do not grow student arrays on guardian documents indefinitely.
- Use a class-subject relationship collection when assigning subjects to classes. Validate that teacher assignments and exam subjects use an eligible class subject.
- Embed small, bounded values owned by one document, such as address components or a receipt's immutable display snapshot. Do not embed growing attendance, enrollment, mark, or payment histories inside profiles.
- Store daily attendance as one document per enrollment and school date. Start with daily class attendance, not per-period attendance.
- Store exam subject configuration separately when marks reference it; one mark document references an exam subject and enrollment. Services validate that the enrollment belongs to the exam's year/class.
- Separate fee obligations and payment records. Initially one payment applies to one obligation; multiple partial payments are allowed. Store amounts in integer minor units with an explicit currency. Derive balances from valid records and preserve reversals instead of deleting financial history.

### Constraints and indexes

These are planned business keys; create each index with its owning model and test duplicate behavior then.

| Collection / rule | Planned uniqueness |
| --- | --- |
| User | Normalized email |
| Role / Permission | Stable role key / permission name |
| Student / Teacher | Student identifier / teacher identifier |
| Profile with optional login | Partial unique user reference when an ObjectId is present, per profile collection |
| AcademicYear | Normalized name; partial unique `isCurrent` restricted to `true` allows at most one current year |
| Class / Subject | Stable class code / subject code |
| Section | Class + normalized section name |
| ClassSubject | Class + subject |
| GuardianStudent | Guardian + student |
| Enrollment | Partial unique student + academic year for active enrollments; partial unique year + section + roll number for active enrollments |
| TeacherAssignment | Teacher + year + class + section + subject; co-teaching is allowed |
| Attendance | Enrollment + school date |
| ExamSubject | Exam + subject |
| Mark | Exam subject + enrollment |
| Fee obligation | Enrollment + fee type + billing-period key |
| Payment | Receipt/reference number; idempotency key for repeated submissions |

Transfers deactivate the old enrollment and create a new one so historical attendance and marks retain their original references. Require section membership in the selected class and dates within the academic context. Query by the requested year, never silently substitute the current year for historical records.

Mongoose validates document shape; services validate referenced existence, status, academic compatibility and access. Unique indexes enforce concurrency-safe uniqueness; convert duplicate-key failures to clear application errors. Add nonunique compound indexes for actual scoped/filter/sort queries, not speculatively for every field.

Use timestamps on business documents, explicit status enums, and actor references on sensitive changes. Archive/deactivate referenced academic and people records rather than cascade-delete history. Status filtering is explicit: archived records remain visible in authorized historical views. Do not treat timestamps as a full audit log.

Prefer single-document atomic updates. Operations that require atomic multi-document changes, such as enrollment transfers, switching current years, and payment/balance coordination, must use transactions with a replica-set-capable MongoDB deployment or a documented concurrency-safe redesign before those modules ship. The initial standalone development database does not support those transactions. Timetable interval conflicts require service-level checks and concurrency protection, not just unique indexes.

## Authentication design (Phase 4)

- Use server-side sessions with a MongoDB-backed session store and TTL expiration; do not use an in-memory store for deployed environments.
- Store only the user identifier and minimal session metadata. Recheck account status and resolve current permissions on protected requests so disabling a user or changing a role takes effect.
- Hash passwords with a maintained password-hashing implementation; prefer Argon2id and select/benchmark its supported configuration during Phase 4. Never store or log plaintext passwords or return hashes.
- Regenerate the session identifier after successful login, persist it before redirecting, and destroy the session and clear the matching cookie on POST logout.
- Use an opaque session cookie with `HttpOnly`, `SameSite=Lax`, explicit expiry, and `Secure` under production HTTPS. Local HTTP requires a development-only secure-cookie exception. Trust only the configured reverse proxy.
- Initial policy: 30-minute idle timeout and 12-hour absolute lifetime, enforced server-side with matching store/cookie expiry behavior. Make the values configurable.
- Validate credentials, return generic login failures, rate-limit authentication attempts, and protect state-changing forms, including login/logout, against CSRF when introduced. Escape untrusted EJS output and allowlist request fields. Phase 22 audits these controls; it is not their first implementation.
- Require a generated session secret from environment configuration and reject placeholders in production. Provision the first Super Admin through a controlled setup mechanism in the authentication phase, never a public role-selecting signup or committed default credentials.

## Authorization design (Phase 5)

Evaluate active authenticated user → permission → resource/ownership policy → business rules. Deny by default when identity, permission or relationship information is missing.

For example, `attendance.edit` allows a teacher to reach attendance editing, but the service must verify an active assignment matching the attendance year, class and section, and that the student enrollment belongs to that scope. Marks entry additionally requires the matching subject. Students and guardians can see only published results in their own/linked scope.

Admin permissions cover school operations, while protected role changes require explicit checks preventing privilege escalation. Super Admin bypasses permission and ownership restrictions only through a centralized, explicit policy; validation, financial invariants and account eligibility still apply. Record sensitive role and financial changes when their modules are implemented.

Reject unauthorized direct URLs and submitted resource identifiers as well as unauthorized lists. Prefer scoped lookups so inaccessible resources receive a consistent not-found response. Add negative tests for other students, unlinked guardians, unassigned teachers, disabled accounts and restricted admin role changes in the relevant phases.

## Docker architecture (Phase 2)

```text
Browser → localhost:3000 → app:3000 → mongo:27017
                          │              │
                    source mount     named data volume
```

- Compose services are `app` and `mongo` on a private Compose network. Publish the app on the host loopback interface for local development; do not publish MongoDB by default.
- The app uses `mongodb://mongo:27017/school_management`, never localhost for container-to-container traffic. MongoDB stores data in a named volume mounted at `/data/db`.
- Bind-mount source for development and isolate container `node_modules` in a volume so host files do not replace container dependencies. Use nodemon for source changes; install and run npm commands inside `app`.
- Select supported explicit Node.js and MongoDB image versions when implementing Phase 2; avoid floating `latest`. Use a non-root app user where practical and configure volume ownership accordingly.
- Add MongoDB readiness checking and bounded connection retries. Start listening only after the database connection succeeds; handle shutdown cleanly. Verify the exact initial route supplied by Phase 2.
- Keep `.env` local and excluded from Git and Docker build context. Commit `.env.example` with placeholders. Exclude dependencies, logs and coverage from the build context.
- Verify Compose configuration, build, startup, connection, HTTP response, live reload and persistence in Phase 2. Ordinary `docker compose down` retains data; document that removing volumes destroys local database contents.
- Phase 25 will define production images without development mounts/watchers, TLS/proxy configuration, database credentials, backups and deployment checks. Upgrade the development MongoDB topology before implementing transaction-dependent workflows.

## Phase 1 verification and handoff

The design covers every Phase 1 checklist item and preserves the roadmap stack and phase order. No packages, source files, Docker configuration, or application tests exist yet, so application/build/container verification is not applicable to this documentation phase.

Next authorized phase: Phase 2 only after the user requests continuation. Implement the Docker development environment against this baseline and verify its runtime behavior.

# Development Progress

Current Phase: 26 — Demo Seed Data
Status: READY FOR NEXT PHASE

## Completed phases

- [x] Phase 1 — Architecture baseline.
- [x] Phase 2 — Docker development environment.
- [x] Phase 3 — Express/EJS/Tailwind application foundation.
- [x] Phase 4 — Session authentication (`3189599`).
- [x] Phase 5 — Roles and permissions (`cc33c0a`).
- [x] Phase 6 — Dashboard and UI; all six action-plan checklist items verified.
- [x] Phase 7 — Academic year module; all eight action-plan checklist items verified.
- [x] Phase 8 — Classes, sections and subjects; all seven action-plan checklist items verified.
- [x] Phase 9 — Student management; all ten action-plan checklist items verified.
- [x] Phase 10 — Teacher management; all eight action-plan checklist items verified.
- [x] Phase 11 — Parent / Guardian management; all six action-plan checklist items verified.
- [x] Phase 12 — Student enrollment; all eight action-plan checklist items verified.
- [x] Phase 13 — Teacher / Class / Subject Assignment; all eight action-plan checklist items verified.
- [x] Phase 14 — Attendance; all eight action-plan checklist items verified.
- [x] Phase 15 — Exams; all six action-plan checklist items verified.
- [x] Phase 16 — Marks & Results; all eight action-plan checklist items verified.
- [x] Phase 17 — Fees; all seven action-plan checklist items verified.
- [x] Phase 18 — Payments; all eight action-plan checklist items verified.
- [x] Phase 19 — Timetable; all seven action-plan checklist items verified.
- [x] Phase 20 — Notices & Announcements; all seven action-plan checklist items verified.
- [x] Phase 21 — Reports; all seven action-plan checklist items verified.
- [x] Phase 22 — Security Hardening; all nine action-plan checklist items verified.
- [x] Phase 23 — Testing; all seven action-plan checklist items verified.
- [x] Phase 24 — Performance & Database Optimization; all six action-plan checklist items verified.
- [x] Phase 25 — Production Readiness; all nine action-plan checklist items verified.
- [x] Phase 26 — Demo Seed Data; all sixteen action-plan checklist items verified.

## Phase 26 implementation

- Added `npm run seed:demo` through `scripts/seed-demo.js`.
- Added a reusable demo seed service that initializes authorization, guards production use, resets only known demo records and recreates the walkthrough data.
- Seeded four demo logins for admin, teacher, student and guardian roles with documented credentials.
- Seeded academic year, classes, sections, subjects, teachers, students, guardians, enrollments, teacher assignments, attendance, exams, marks/results, fee types, student fees, payments, timetable entries and notices.
- Added [demo seed data](demo-seed-data.md) with the command, login credentials, coverage and cleanup/reset strategy.
- Added unit and integration tests for production safety, documented credentials, repeatability and cleanup.
- Ran the demo seed command in the development database; the app at http://localhost:3001 now has the walkthrough dataset.

## Phase 25 implementation

- Added `Dockerfile.production` with a multi-stage production image, built CSS, production dependencies, non-root runtime user, direct `node server.js` startup and container health check.
- Added `docker-compose.production.yml` as a production-oriented template without source mounts or development watchers.
- Added `.env.production.example` and kept real production env files ignored by Git.
- Added `/healthz` as a no-store JSON health endpoint for container and reverse proxy checks.
- Added [production readiness](production-readiness.md) covering environment strategy, Docker strategy, HTTPS/reverse proxy, health checks, backups, logging, sessions, deployment and rollback.
- Updated README production guidance and added regression tests for production artifacts and the health endpoint.

## Phase 24 implementation

- Reviewed common list, detail, report and dashboard query patterns across the implemented modules.
- Added supporting indexes for frequent filters and sorts across academic years, classes, sections, subjects, students, teachers, guardians, enrollments, exams, fee types, student fees and notices.
- Kept pagination behavior bounded and added regression coverage for common query-supporting indexes.
- Optimized reports by using narrower projections, narrower populate selections and per-report filter option loading instead of loading every option set for every report page.
- Confirmed dashboard still uses lightweight unavailable placeholders, so no dashboard database reads needed optimization.
- Added [performance database review](performance-database-review.md) with the optimization notes and future large-school considerations.

## Phase 23 implementation

- Split test commands into explicit `test:unit`, `test:integration`, `test:critical` and `test:all` scripts while keeping `npm test` as the unit/component default.
- Added MongoDB-backed database constraint coverage for critical duplicate protections across classes, sections, subjects, enrollments, teacher assignments, attendance, exams, marks, fees and payment references.
- Verified the critical workflow test command covers authentication, authorization, enrollment, attendance, teacher assignments, marks/results, fees, payments and database constraints.
- Re-ran the full unit/component and integration suites after the testing changes.

## Phase 22 implementation

- Reviewed and retained the existing session lifecycle controls: generated session secrets, persistent Mongo-backed sessions, secure cookie mode in production, idle and absolute timeouts, session regeneration on login/logout, and inactive-user invalidation.
- Added explicit browser security headers, including CSP, frame denial, MIME sniffing prevention, referrer policy, permissions policy and cross-origin opener policy.
- Added request-data hardening to reject dangerous `$` and dotted keys in query/body payloads and duplicate query parameters before controller or database logic runs.
- Removed inline print handlers from report views so the stricter script policy can run with `script-src 'self'`.
- Tightened `TRUST_PROXY` parsing so deployment proxy trust is explicit and invalid values fail startup.
- Reverified CSRF, XSS escaping, rate limiting, authorization/resource-scope tests, secret `.gitignore` behavior and safe error responses without exposing stacks, tokens, session data or database internals.

## Phase 21 implementation

- Added an admin-only Reports module with a report hub and printable report views.
- Added student, attendance, result and fee reports using the existing source models rather than new report storage.
- Added reusable report filter normalization for text search, object IDs and date ranges.
- Added filters for class/section/status, date ranges for attendance, exam/section for results, and year/type/status for fees.
- Added report totals for student counts, attendance statuses, result pass/fail counts and fee assigned/paid/outstanding balances.
- Used lean/populated queries with bounded result sets for predictable operational report reads.
- Linked Reports navigation for administrators and added focused unit/view and MongoDB-backed route tests.

## Phase 20 implementation

- Added the `Notice` model with title, body, audience, optional class/section target, publish status, visibility dates, audit users, timestamps and query indexes.
- Added notice validation, service logic, controller actions, protected routes and EJS screens for lists, details, creation and editing.
- Supported audiences for everyone, admins, teachers, students, guardians, specific classes and specific sections.
- Enforced publish status and optional visibility windows so non-admin users only see currently visible published notices.
- Implemented scoped authorization: administrators manage notices, while teachers, students and guardians view notices for their role and class/section relationships.
- Linked Notices navigation once the module became implemented.
- Added focused tests for permissions, validation, model rules, view rendering and MongoDB-backed audience visibility behavior.

## Phase 19 implementation

- Added the `TimetableEntry` model with academic year, class, section, subject, teacher, weekday, start/end time, room, status, audit users, timestamps and query indexes.
- Added timetable validation, service logic, controller actions, protected routes and EJS screens for weekly schedule display, details, creation and editing.
- Validated timetable relationships against active academic records and required an active teacher assignment for the selected year, class, section, subject and teacher.
- Added overlap detection to prevent active class-section conflicts and active teacher conflicts on the same day.
- Implemented scoped authorization: administrators manage entries, teachers view their own weekly timetable, students view their active enrollment timetable, and guardians view linked student timetables.
- Linked Timetable navigation once the module became implemented.
- Added focused tests for permissions, validation, model rules, weekly view rendering and MongoDB-backed route behavior.

## Phase 18 implementation

- Added the `Payment` model with linked student fee, amount, payment date, method, optional unique reference number, note, recorder, timestamps and query indexes.
- Added payment validation, service logic, controller actions, protected routes and EJS screens for payment history and payment entry.
- Recorded payments separately from fee obligations while updating each `StudentFee` paid amount and derived status.
- Supported partial payments and prevented payments that exceed the current outstanding balance.
- Implemented scoped authorization: administrators record payments, while students and guardians can view allowed payment histories through their fee access.
- Added focused tests for permissions, validation, model rules, payment history view rendering and MongoDB-backed route behavior.

## Phase 17 implementation

- Added `FeeType` and `StudentFee` models with reusable fee categories, assigned student obligations, due dates, status, audit users, timestamps and indexes.
- Added duplicate prevention for the same student, academic year, fee type and due date.
- Added fee validation, service logic, controller actions, protected routes and EJS screens for fee lists, details, assignment forms and fee type management.
- Implemented outstanding amount calculation from assigned amount minus paid amount, while leaving separate payment records for Phase 18.
- Implemented scoped authorization: administrators manage fees and fee types, students view their own fee obligations, and guardians view linked student fee obligations.
- Linked Fees navigation once the module became implemented.
- Added focused tests for permissions, validation, model rules, outstanding calculation, view rendering and MongoDB-backed route behavior.

## Phase 16 implementation

- Added the `Mark` model with exam, subject, student, enrollment, marks, audit users, timestamps and duplicate prevention for one mark per exam/student/subject.
- Added marks/result validation, service logic, controller actions, protected routes and EJS screens for result dashboard, mark entry, student result and class result.
- Loaded eligible students from active enrollments for the selected exam class and academic year.
- Supported mark entry and edits through idempotent upserts, with max/min validation against the exam subject setup.
- Implemented result calculation in the service layer, including subject pass/fail, percentages, grades and aggregate student summaries.
- Implemented scoped authorization: administrators manage results, assigned teachers enter marks for their assigned subjects, students view their own result, and guardians can view linked student results.
- Linked Results navigation once the module became implemented.
- Added focused tests for permissions, validation, model rules, result calculation, view rendering and MongoDB-backed route behavior.

## Phase 15 implementation

- Added the `Exam` model with academic year, class, name, date window, status, embedded subject mark setup, timestamps and query indexes.
- Added scoped uniqueness for exam names within the same academic year and class.
- Added exam validation, service logic, controller actions, protected routes and EJS screens for list, create, detail and edit.
- Configured subject exams with total marks, pass marks and optional subject exam dates.
- Validated schedules so exam windows are ordered, pass marks do not exceed total marks, subject dates stay inside the exam window and subjects belong to the selected class.
- Implemented exam permissions: administrators manage exam definitions while teachers, students and guardians can view them for upcoming marks/results phases.
- Linked Exams navigation once the module became implemented.
- Added focused tests for permissions, validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 14 implementation

- Added the `Attendance` model with academic year, class, section, normalized attendance date, embedded student records, audit users, timestamps and query indexes.
- Added a unique year/class/section/date index to prevent duplicate daily attendance records.
- Added attendance validation, service logic, controller actions, protected routes and EJS screens for list, roster entry, detail and edit.
- Loaded daily rosters from active enrollments and recorded per-student statuses: present, absent, late and excused.
- Added student attendance history and class attendance summary views.
- Implemented scoped authorization: administrators manage all attendance, assigned teachers manage only their active class/section assignments, and students/guardians can view permitted student history.
- Linked Attendance navigation once the module became implemented.
- Added focused tests for permissions, validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 13 implementation

- Added the `TeacherAssignment` model linking teacher, academic year, class, section and subject with active/inactive status and timestamps.
- Added a partial unique index to prevent duplicate active teacher assignments for the same year/class/section/subject combination.
- Added teacher assignment validation, service logic, controller actions, protected routes and EJS screens for list, create, detail and edit.
- Added teacher assignment history and class subject teacher views.
- Validated academic relationships so sections must belong to the selected class and subjects must be active and assigned to the selected class.
- Implemented scoped authorization: administrators manage assignments, teachers view only their own active assignments, and students/guardians cannot access teacher assignments.
- Added focused tests for permissions, validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 12 implementation

- Added the `Enrollment` model with student, academic year, class, section, roll number, enrollment date, status and timestamps.
- Added partial unique indexes to prevent duplicate active student/year enrollments and duplicate active roll numbers in the same year/class/section.
- Added enrollment validation, service logic, controller actions, protected routes and EJS screens for list, create, detail and edit.
- Added class student lists and student enrollment history views.
- Validated academic relationships so sections must belong to the selected class and all selected records must be active.
- Implemented scoped authorization: administrators manage enrollments, teachers view active enrollments, students view their own history, and guardians view linked student enrollments.
- Active enrollments synchronize the student's current class and section profile fields.
- Added focused tests for validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 11 implementation

- Added the `Guardian` model with guardian ID, optional linked user account, contact fields, relationship, linked students, status and timestamps.
- Added guardian validation, service logic, controller actions, protected routes and EJS screens for list, create, profile, edit and activate/deactivate.
- Added multiple linked students per guardian without duplicating student profile data.
- Implemented scoped authorization: administrators manage all guardians, guardian users can view only their linked guardian profile, and students/teachers cannot access guardian management.
- Linked the Guardians navigation entry for users with `guardian.view`.
- Added focused tests for validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 10 implementation

- Added the `Teacher` model with teacher ID, optional linked user account, contact fields, joining date, qualification, status and timestamps.
- Added teacher validation, service logic, controller actions, protected routes and EJS screens for list, create, profile, edit and activate/deactivate.
- Added searchable, filterable, sortable and paginated teacher lists.
- Implemented Phase 10 scoped authorization: administrators manage all teachers, teachers can view active teacher records and their own linked profile, and students/guardians cannot access teacher management.
- Linked the Teachers navigation entry now that the module is implemented.
- Added focused tests for validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 9 implementation

- Added the `Student` model with student ID, optional linked user account, profile fields, current class/section placement, status and timestamps.
- Added student validation, service logic, controller actions, protected routes and EJS screens for list, create, details, edit and activate/deactivate.
- Added searchable, filterable, sortable and paginated student lists.
- Implemented Phase 9 scoped authorization: administrators manage all students, teachers can view active students, students can view their own linked profile, and guardians receive no linked records until the guardian relationship module exists.
- Linked the Students navigation entry now that the module is implemented.
- Added focused tests for validation, model rules, navigation, view rendering and MongoDB-backed route behavior.

## Phase 8 implementation

- Added `SchoolClass`, `Section` and `Subject` models with status fields, timestamps and indexes for duplicate prevention.
- Added section-to-class relationships and subject-to-class assignments for later enrollment, attendance and result modules.
- Added academic structure validation, service logic, controller actions, protected routes and EJS list/form screens for classes, sections and subjects.
- Added `academic_structure.view`, `academic_structure.create` and `academic_structure.edit` permissions for administrators, including a one-time permission migration for existing databases.
- Added focused tests for validation, models, navigation, view rendering and MongoDB-backed route behavior.

## Phase 7 implementation

- Added an `AcademicYear` model with date validation, status, current-year flag, timestamps, a unique name and a partial unique current-year index.
- Added academic-year validation, service logic, controller actions, protected routes and EJS screens for list, create, edit, view and activation.
- Added `academic_year.view`, `academic_year.create` and `academic_year.edit` permissions for administrators, including a one-time permission migration for existing databases, and permission-aware dashboard navigation.
- Added focused tests for validation, model rules, navigation and view rendering.

## Phase 6 implementation

- Added a dedicated dashboard controller and presentation service; reused the protected `/dashboard` route and shared layout.
- Added role-appropriate placeholder metric cards, a workspace list, breadcrumbs, account greeting and announcement empty state.
- Added current-request permission-filtered navigation and account/role display. Future modules appear as disabled text, with no unavailable route links.
- Improved shared navbar/sidebar/main layout for desktop, tablet and mobile; long names cannot force horizontal page overflow.
- Added reusable metric, icon, empty-state and native modal partials. Existing tables, pagination, form controls, alerts and buttons are preserved.
- Added logout confirmation with initial focus, Tab/Shift+Tab wrapping, Escape/cancel/backdrop dismissal, focus restoration and a CSRF-protected POST action. Native logout forms remain functional without JavaScript.
- Added dashboard component tests and authorization integration assertions for visible links and immediate revocation.
- Updated README, foundation/authorization guides, [dashboard guide](dashboard.md) and phase checklist.

## Verification

- `docker compose config --quiet`: passed.
- `docker compose up -d --build --wait`: image built; app and MongoDB healthy.
- `docker compose exec app npm run check`: 147 JavaScript files passed.
- `docker compose exec -T app npm run build`: Tailwind compilation passed.
- `docker compose exec app npm test`: 91 passed, 0 failed.
- `docker compose exec app npm run test:integration`: 24 passed, 0 failed. Existing authentication, authorization, academic-year, academic-structure, student, teacher, guardian, enrollment, teacher assignment, attendance, exam, result, fee, payment, timetable, notice, report and database constraint behavior remains covered.
- `APP_ENV_FILE=.env.production.example docker compose -f docker-compose.production.yml --env-file .env.production.example config --quiet`: passed.
- `APP_ENV_FILE=.env.production.example docker compose -f docker-compose.production.yml --env-file .env.production.example build app`: production image built.
- `git diff --check`: passed.
- `docker compose ps`: app and MongoDB healthy.

## Scope and remaining work

No Phase 25 implementation items remain. The app runs at http://localhost:3001; sign in to open `/dashboard`.

Dashboard metrics are explicitly unavailable placeholders, not live counts or balances. The planned implementation phases are complete; future work should use production readiness, backup and monitoring practices before real deployment. No test-only route or test account was added to the running school database.

No separate linter is configured. Syntax, unit/component, integration, Docker and browser checks provide phase verification.

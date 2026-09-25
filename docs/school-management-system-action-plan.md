# School Management System — Step-by-Step Development Action Plan

## 1. Project Goal

Build a production-ready **School Management System** using:

- **Backend:** Node.js + Express.js
- **Database:** MongoDB
- **ODM:** Mongoose
- **Frontend:** Server-side rendered views
- **Template Engine:** EJS
- **UI:** Tailwind CSS
- **JavaScript:** Vanilla JavaScript
- **Architecture:** MVC
- **Authentication:** Session-based authentication
- **Local Development:** Docker + Docker Compose
- **Package Manager:** npm

The project should be built **one phase at a time**. Do not jump ahead until the current phase is working and verified.

---


# Codex Execution Instructions

This project will be implemented by **Codex**, so treat this file as both the development roadmap and the execution contract.

## Codex Working Rules

Before making changes in any phase:

1. Inspect the existing repository and understand the current state.
2. Read relevant files before modifying them.
3. Reuse the existing architecture and conventions where they are already correct.
4. Do not recreate files unnecessarily.
5. Do not overwrite unrelated work.
6. Do not remove working code unless the current phase requires it.
7. Do not implement future phases early unless a minimal dependency is strictly required.
8. Prefer small, reviewable changes over large rewrites.
9. Keep the application runnable after every completed logical step.
10. Run the appropriate verification commands after changes.
11. Fix errors introduced by the current work before marking the step complete.
12. If an existing implementation differs from this plan but is technically sound, preserve it unless changing it is necessary.
13. Do not introduce a new library when the same goal can reasonably be achieved with the current stack.
14. Do not silently change architectural decisions defined in this document.
15. Never expose or commit secrets.

## Required Codex Workflow

For each phase, follow this cycle:

```text
Inspect repository
      ↓
Identify current phase state
      ↓
List files affected
      ↓
Implement smallest logical step
      ↓
Run formatting/lint/tests/build as available
      ↓
Run Docker/application verification
      ↓
Fix current-step failures
      ↓
Summarize changes
      ↓
Update phase checklist/status
      ↓
Stop at phase boundary
```

## Repository Inspection

At the beginning of a new phase, inspect at least:

```text
package.json
docker-compose.yml / compose.yml
Dockerfile
.env.example
src/
public/
tests/
```

when those files/directories already exist and are relevant.

Also inspect Git state before broad changes:

```bash
git status
```

Do not discard user changes or unrelated uncommitted work.

## Command Execution Rules

Because local development is Docker-based:

- Prefer running application commands inside the `app` container.
- Prefer Docker Compose commands for startup, rebuild, logs, and dependency execution.
- Do not require host-installed Node.js or MongoDB.
- If the container is not running, use the appropriate Docker Compose command first.
- When adding npm dependencies, update both `package.json` and the lockfile.
- Do not delete lockfiles unless there is a specific documented reason.

Typical commands:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 app
docker compose exec app npm test
docker compose exec app npm run lint
docker compose exec app npm run build
```

Only run commands that actually exist in the project. Inspect `package.json` before assuming script names.

## Verification Standard

A coding task is not complete merely because files were edited.

Where applicable, Codex should verify:

- Docker Compose configuration is valid.
- Containers start successfully.
- Application starts without runtime errors.
- MongoDB connection succeeds.
- Relevant page/route responds.
- Validation works.
- Authentication/authorization rules work.
- Tests pass.
- Existing tests still pass.
- No obvious secrets are committed.
- No unrelated files were unintentionally modified.

If a test suite does not yet exist, perform the strongest practical verification available for the current phase and clearly state that automated coverage is not yet available.

## Failure Handling

If a command fails:

1. Read the actual error.
2. Determine whether it was caused by the current change.
3. Fix issues caused by the current work.
4. Re-run the failed verification.
5. Do not hide failing tests or disable checks merely to get a green result.

If the failure is clearly pre-existing and unrelated:

- Do not modify unrelated code just to fix it.
- Record the pre-existing failure in the completion summary.
- Continue only when it does not block the current phase.

## File Editing Rules

When editing:

- Follow the existing formatting style.
- Keep file names and naming conventions consistent.
- Avoid giant files when responsibilities can be separated cleanly.
- Keep controllers thin.
- Keep business rules in services.
- Keep validation outside controllers where practical.
- Keep database-specific query logic in models/repositories as appropriate.
- Reuse middleware rather than duplicating access checks.
- Reuse EJS partials instead of duplicating markup.
- Avoid large refactors during unrelated feature work.

## Database Change Rules

For every Mongoose model or important schema change:

- Define required fields deliberately.
- Add indexes only for actual lookup/uniqueness needs.
- Add unique constraints where the business rule truly requires uniqueness.
- Consider compound indexes for scoped uniqueness.
- Use timestamps where useful.
- Decide intentionally between embedding and referencing.
- Avoid uncontrolled document growth.
- Validate references/business rules at the service layer when MongoDB alone cannot enforce them.

Before changing an existing schema, inspect how it is already used.

## Security Rules

For all relevant phases, Codex must consider:

- Authentication
- Authorization
- Resource ownership
- Input validation
- Output escaping
- CSRF
- Session security
- NoSQL injection
- Rate limiting
- Sensitive logging
- Secret management

Never weaken security simply to make a feature easier to implement.

## Phase Boundary Rule

Codex must work on **one phase at a time**.

A phase is complete only when:

```text
Implementation complete
        +
Relevant verification complete
        +
Checklist updated
        +
No blocking error from current work
```

Then stop and report:

```markdown
## Phase X Completion

### Implemented
- ...

### Files Changed
- ...

### Verification
- ...

### Tests
- ...

### Known Issues
- None / ...

### Checklist
- [x] ...

### Status
READY FOR NEXT PHASE
```

Do not automatically start the next phase unless explicitly instructed to continue.

## Existing Project Rule

If Codex is working in a repository that already contains partial implementation:

- First determine which checklist items are already complete.
- Verify them instead of rebuilding them.
- Continue from the first incomplete item.
- Preserve working implementation.
- Bring inconsistent pieces into alignment only when necessary.

## Decision Rule

When multiple implementation choices are possible:

1. Prefer the simplest production-sensible option.
2. Prefer built-in Node.js/Express/Mongoose capabilities where appropriate.
3. Prefer maintainability over cleverness.
4. Avoid premature abstraction.
5. Add repositories only when they reduce meaningful query duplication or isolate complex persistence logic.
6. Add services when business rules exist beyond simple request forwarding.
7. Document non-obvious architectural choices briefly in code comments or project documentation when useful.

## Codex Response Style

After each logical implementation step, return a concise implementation report containing:

- What changed
- Files changed
- Commands run
- Verification result
- Remaining tasks in the current phase

Do not paste entire files into the response unless specifically requested; edit the repository directly.

---

# Development Principles

Throughout the project:

- Follow clean MVC architecture.
- Keep controllers thin.
- Put business logic inside services.
- Use repositories only when database/query abstraction is useful.
- Use middleware for authentication, authorization, validation, and shared request logic.
- Use validators for request validation.
- Keep reusable helpers/utilities separated.
- Use environment variables for configuration.
- Follow consistent naming conventions.
- Avoid unnecessary dependencies.
- Do not overengineer early phases.
- Write code that can grow into a real production system.
- Use Docker for local application commands whenever practical.

Recommended request flow:

```text
Browser
   ↓
Route
   ↓
Middleware
   ↓
Validation
   ↓
Controller
   ↓
Service
   ↓
Repository / Mongoose Model
   ↓
MongoDB
   ↓
Controller
   ↓
EJS View
```

---

# Phase 1 — Project Planning & Architecture

## Goal

Define the system structure, development conventions, modules, data strategy, and overall architecture before implementation.

## Tasks

### 1.1 Define Main User Roles

Plan these initial roles:

- Super Admin
- Admin
- Teacher
- Student
- Parent / Guardian

### 1.2 Define Core Modules

Plan for these modules:

- Authentication
- User Management
- Roles & Permissions
- Dashboard
- Academic Years
- Classes
- Sections
- Subjects
- Students
- Teachers
- Guardians
- Enrollments
- Teacher Assignments
- Attendance
- Exams
- Results
- Fees
- Payments
- Timetables
- Notices
- Reports

### 1.3 Define Architecture

Use these layers:

```text
Routes
Controllers
Services
Repositories
Models
Middleware
Validators
Views
Config
Utils
```

### 1.4 Define Folder Structure

Target structure:

```text
school-management/
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
├── .env
├── .env.example
├── package.json
└── server.js
```

### 1.5 Define MongoDB Strategy

Decide where to use:

- References
- Embedded subdocuments
- Unique indexes
- Compound indexes
- Validation
- Timestamps
- Soft-status fields where needed

### 1.6 Define Authentication Strategy

Use:

- Session-based authentication
- Password hashing
- Secure cookies
- Authentication middleware

### 1.7 Define Authorization Strategy

Use:

```text
Role
  ↓
Permission
  ↓
Resource / Ownership Check
```

Example:

```text
Teacher has attendance.edit
        ↓
Is teacher assigned to this class?
        ↓
YES → Allow
NO  → Deny
```

## Deliverable

A documented architecture and agreed folder structure.

Design baseline: [Architecture](architecture.md).

Status: Architecture and documentation verification complete. The required Git commit is blocked because the workspace does not contain usable Git metadata. See [development progress](development-progress.md).

## Completion Checklist

- [x] Roles are defined
- [x] Main modules are defined
- [x] MVC responsibilities are clear
- [x] Folder structure is finalized
- [x] MongoDB modeling strategy is understood
- [x] Authentication strategy is defined
- [x] Authorization strategy is defined
- [x] Docker architecture is defined

---

# Phase 2 — Docker & Project Setup

## Goal

Create a development environment where Node.js and MongoDB run entirely through Docker.

## Architecture

```text
Host Machine
     │
     │ localhost:3000
     ↓
Docker Compose
     │
     ├── app
     │    └── Node.js + Express
     │
     └── mongo
          └── MongoDB
               ↓
          Named Volume
```

## Tasks

### 2.1 Initialize Project

Create:

```text
package.json
server.js
src/app.js
```

### 2.2 Install Base Dependencies

Plan dependencies for:

- Express
- Mongoose
- EJS
- Environment variables
- Nodemon
- Tailwind CSS

Do not add security/auth libraries until their phase unless needed earlier.

### 2.3 Create Dockerfile

Configure:

- Node.js base image
- Working directory
- Dependency installation
- Source code
- Development command
- Appropriate user where practical

### 2.4 Create docker-compose.yml

Services:

```text
app
mongo
```

### 2.5 Configure MongoDB

Use:

```env
MONGODB_URI=mongodb://mongo:27017/school_management
```

Do not use `localhost` from inside the app container.

### 2.6 Add MongoDB Persistence

Create a named volume for `/data/db`.

### 2.7 Configure Source Mounting

Mount application source for development so changes can trigger nodemon.

### 2.8 Create .dockerignore

Exclude items such as:

```text
node_modules
.git
.env
npm-debug.log
coverage
```

### 2.9 Add Environment Files

Create:

```text
.env
.env.example
```

Initial variables:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://mongo:27017/school_management
SESSION_SECRET=change_me
```

### 2.10 Verify Docker Development Workflow

Commands should include:

```bash
docker compose build
docker compose up -d
docker compose up --build
docker compose logs -f
docker compose down
docker compose exec app npm install
```

## Deliverable

The application runs at:

```text
http://localhost:3000
```

with both Node.js and MongoDB running inside Docker.

Implementation and runtime verification complete. This machine uses http://localhost:3001 because port 3000 is occupied; `.env.example` retains port 3000. The required Git commit remains blocked by unusable Git metadata. See [development progress](development-progress.md).

## Completion Checklist

- [x] Dockerfile works
- [x] Docker Compose works
- [x] App container starts
- [x] MongoDB container starts
- [x] App connects to MongoDB
- [x] MongoDB uses persistent volume
- [x] Source mounting works
- [x] Nodemon restarts application
- [x] App is accessible from browser
- [x] Environment variables work

---

# Phase 3 — Application Foundation

## Goal

Create the reusable Express foundation before implementing business modules.

## Tasks

### 3.1 Configure Express

Set up:

- Express application
- Body parsing
- URL-encoded forms
- Static files

### 3.2 Configure MongoDB Connection

Create a reusable database configuration module.

Requirements:

- Clean startup connection
- Error handling
- Connection logging
- Environment-based URI

### 3.3 Configure EJS

Set:

- Views directory
- EJS view engine
- Shared layouts
- Shared partials

### 3.4 Configure Static Assets

Use:

```text
public/
├── css/
├── js/
└── images/
```

### 3.5 Configure Tailwind CSS

Create development scripts for Tailwind compilation.

### 3.6 Create Shared UI

Create reusable:

- Navbar
- Sidebar
- Header
- Footer
- Alerts
- Form controls
- Buttons
- Tables
- Pagination
- Breadcrumbs

### 3.7 Create Central Error Handling

Add:

- 404 handler
- Application error handler
- Development-safe debugging
- Production-safe responses

### 3.8 Add Logging

Log important application and request information without exposing secrets.

## Deliverable

A stable Express + MongoDB + EJS + Tailwind foundation.

Implementation and verification complete. EJS/Tailwind foundation, reusable database connection, shared UI, safe error handling and structured logs are working at http://localhost:3001. Nine automated tests and Docker/browser/watcher checks passed. The required Git commit remains blocked by unusable Git metadata. See [foundation guide](application-foundation.md) and [development progress](development-progress.md).

## Completion Checklist

- [x] Express is configured
- [x] MongoDB connection is reusable
- [x] EJS rendering works
- [x] Static assets work
- [x] Tailwind works
- [x] Shared partials work
- [x] 404 page works
- [x] Error handler works
- [x] Logging works

---

# Phase 4 — Authentication

## Goal

Implement secure login/logout using sessions.

## Tasks

### 4.1 Create User Model

Plan fields such as:

```text
name
email
password
role / role reference
status
lastLoginAt
timestamps
```

### 4.2 Add Password Hashing

Hash passwords before storing them.

Never store plain-text passwords.

### 4.3 Configure Sessions

Configure:

- Session secret
- Secure cookie options
- HttpOnly
- SameSite
- Session expiration

Use an appropriate persistent session store when needed.

### 4.4 Create Login Page

Create:

```text
GET /login
POST /login
```

### 4.5 Implement Login Flow

```text
Login Form
   ↓
Validate Request
   ↓
Find User
   ↓
Verify Password
   ↓
Create Session
   ↓
Redirect Dashboard
```

### 4.6 Create Logout

Create:

```text
POST /logout
```

Destroy session safely.

### 4.7 Create Authentication Middleware

Examples:

```text
requireAuth
requireGuest
```

### 4.8 Protect Dashboard

Unauthenticated users must not access protected routes.

## Deliverable

Working secure authentication.

Status: READY FOR NEXT PHASE. Existing authentication implementation completed and verified in Docker. All 13 unit/foundation tests and the MongoDB authentication integration suite pass. See [authentication](authentication.md) and [development progress](development-progress.md).

## Completion Checklist

- [x] User model exists
- [x] Password hashing works
- [x] Login validation works
- [x] Login works
- [x] Session works
- [x] Logout works
- [x] Protected routes work
- [x] Guest routes work
- [x] Invalid credentials are handled safely

---

# Phase 5 — Roles & Permissions

## Goal

Implement role-based and resource-level authorization.

## Tasks

### 5.1 Create Role Model

Examples:

```text
Super Admin
Admin
Teacher
Student
Guardian
```

### 5.2 Create Permission Model

Use permission names such as:

```text
student.view
student.create
student.edit
student.delete

teacher.view
attendance.create
attendance.edit
result.create
fee.view
```

### 5.3 Connect Roles and Permissions

Design either:

```text
User → Role → Permissions
```

or a structure allowing multiple roles later if needed.

### 5.4 Create Authorization Middleware

Examples:

```text
requireRole()
requirePermission()
```

### 5.5 Add Resource-Level Authorization

Do not rely only on role/permission.

Example:

```text
Teacher
   ↓
attendance.edit
   ↓
Assigned to requested class?
   ↓
Allow / Deny
```

### 5.6 Super Admin Behavior

Super Admin may bypass normal authorization where intended.

## Deliverable

Centralized authorization system.

Status: READY FOR NEXT PHASE. Five persisted roles and eleven permissions, current-request permission resolution, dashboard enforcement, resource/ownership guards and explicit Super Admin policy are implemented. Docker build, 32-file syntax check, 19 unit/foundation tests and 8 integration checks passed. See [authorization](authorization.md) and [development progress](development-progress.md).

## Completion Checklist

- [x] Roles exist
- [x] Permissions exist
- [x] Role-permission relationship works
- [x] Permission middleware works
- [x] Unauthorized access is denied
- [x] Ownership/resource checks work
- [x] Super Admin behavior is defined

---

# Phase 6 — Dashboard & UI Foundation

## Goal

Create the main administration interface.

## Tasks

### 6.1 Create Dashboard Layout

Build:

- Sidebar
- Navbar
- Header
- Main content area
- Footer

### 6.2 Make Layout Responsive

Support:

- Desktop
- Tablet
- Mobile

### 6.3 Create Dashboard Home

Initial cards may include:

```text
Total Students
Total Teachers
Total Classes
Today Attendance
Outstanding Fees
```

Use placeholder or real data depending on available modules.

### 6.4 Create Reusable Components

Prepare:

- Table component/partial
- Pagination
- Form input partials
- Alerts
- Buttons
- Modal
- Empty states

## Deliverable

Responsive reusable dashboard UI.

Status: READY FOR NEXT PHASE. Dashboard overview, responsive shared layout, permission-aware navigation, modal and empty-state components are complete. Docker build, 35-file syntax check, 24 unit/component tests, 8 integration checks and desktop/tablet/mobile browser verification passed. See [dashboard and shared UI](dashboard.md) and [development progress](development-progress.md).

## Completion Checklist

- [x] Dashboard route works
- [x] Sidebar works
- [x] Navbar works
- [x] Mobile layout works
- [x] Shared components are reusable
- [x] Authorization-aware navigation works

---

# Phase 7 — Academic Year Module

## Goal

Introduce the foundation for year-specific school data.

## Tasks

Create:

```text
AcademicYear model
AcademicYear routes
AcademicYear controller
AcademicYear service
AcademicYear views
Validation
```

Suggested fields:

```text
name
startDate
endDate
isCurrent
status
timestamps
```

Business rules:

- Only one academic year should normally be current.
- Prevent duplicate names when appropriate.
- Validate start/end date.

## Deliverable

Academic years can be managed from the dashboard.

Status: READY FOR NEXT PHASE. Academic year management is implemented with list/create/edit/view screens, current-year activation, validation, authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] List
- [x] Create
- [x] Edit
- [x] View
- [x] Activate/current-year logic
- [x] Validation
- [x] Authorization
- [x] Tests

---

# Phase 8 — Classes, Sections & Subjects

## Goal

Create the academic structure required by later modules.

## Development Order

```text
Class
  ↓
Section
  ↓
Subject
```

## 8.1 Classes

Example:

```text
Grade 6
Grade 7
Grade 8
```

Implement:

- List
- Create
- Edit
- Status
- Validation

## 8.2 Sections

Example:

```text
Grade 8
├── Section A
├── Section B
└── Section C
```

Prevent duplicate section names within the same class where required.

## 8.3 Subjects

Examples:

```text
Mathematics
English
Science
ICT
```

Support subject assignment to appropriate class structures.

## Deliverable

Reusable academic structure.

Status: READY FOR NEXT PHASE. Class, section and subject management is implemented with relationships, duplicate prevention, authorization, validation and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Class CRUD works
- [x] Section CRUD works
- [x] Subject CRUD works
- [x] Relationships are correct
- [x] Duplicate data is prevented
- [x] Authorization works
- [x] Validation works

---

# Phase 9 — Student Management

## Goal

Manage student records.

## Tasks

### 9.1 Design Student Model

Consider:

```text
studentId
user reference
firstName
lastName
dateOfBirth
gender
phone
address
admissionDate
status
timestamps
```

Do not automatically place all enrollment information directly in the student document.

### 9.2 Student CRUD

Implement:

- List
- Create
- Details
- Edit
- Activate/deactivate

### 9.3 Student List Features

Add:

- Search
- Pagination
- Filtering
- Sorting

### 9.4 Authorization

Example:

```text
Admin → manage students
Teacher → limited viewing
Student → own profile only
Guardian → linked students only
```

## Deliverable

Complete student management module.

Status: READY FOR NEXT PHASE. Student profiles are implemented with scoped CRUD, activate/deactivate, search, filters, sorting, pagination, validation, authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Student model
- [x] Create
- [x] List
- [x] View
- [x] Edit
- [x] Search
- [x] Filter
- [x] Pagination
- [x] Authorization
- [x] Validation
- [x] Tests

---

# Phase 10 — Teacher Management

## Goal

Manage teacher records.

## Suggested Fields

```text
teacherId
user reference
name
email
phone
joiningDate
qualification
status
timestamps
```

## Tasks

Implement:

- Teacher list
- Create teacher
- Teacher profile
- Edit teacher
- Status management
- Search
- Filter
- Pagination

Do not mix teacher assignment rules directly into basic teacher CRUD.

## Deliverable

Complete teacher management.

Status: READY FOR NEXT PHASE. Teacher profiles are implemented with CRUD, status management, search, filters, sorting, pagination, validation, authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Teacher model
- [x] CRUD
- [x] Search
- [x] Filtering
- [x] Pagination
- [x] Authorization
- [x] Validation
- [x] Tests

---

# Phase 11 — Parent / Guardian Management

## Goal

Manage guardians separately and connect them to students.

## Relationship

```text
Guardian
   ├── Student A
   └── Student B
```

A student may also have multiple guardians where needed.

## Tasks

Implement:

- Guardian model
- Guardian CRUD
- Connect guardian with students
- Guardian profile
- Authorization

## Deliverable

Guardian relationships work without duplicating unnecessary guardian data.

Status: READY FOR NEXT PHASE. Guardian profiles are implemented with CRUD, linked students, multiple-student support, scoped authorization, validation and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Guardian CRUD
- [x] Student relationships work
- [x] Multiple students per guardian supported
- [x] Authorization works
- [x] Validation works
- [x] Tests

---

# Phase 12 — Student Enrollment

## Goal

Connect a student to an academic year, class, and section.

## Relationship

```text
Student
   +
Academic Year
   +
Class
   +
Section
   ↓
Enrollment
```

## Suggested Enrollment Fields

```text
student
academicYear
class
section
rollNumber
enrollmentDate
status
timestamps
```

## Important Rule

Prevent duplicate active enrollment for the same relevant combination.

A compound unique index may be useful depending on the final schema.

## Tasks

- Create enrollment
- Change/update enrollment
- View class students
- View student enrollment history
- Validate academic relationships

## Deliverable

Students can be enrolled safely into academic structures.

Status: READY FOR NEXT PHASE. Student enrollment is implemented with active duplicate prevention, academic relationship validation, class student lists, student enrollment history, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Enrollment model
- [x] Enrollment creation
- [x] Duplicate prevention
- [x] Enrollment history
- [x] Class student listing
- [x] Validation
- [x] Authorization
- [x] Tests

---

# Phase 13 — Teacher / Class / Subject Assignment

## Goal

Assign teachers to academic responsibilities.

## Relationship

```text
Teacher
   +
Academic Year
   +
Class
   +
Section
   +
Subject
   ↓
Teacher Assignment
```

## Tasks

- Create assignment model
- Assign teachers
- Prevent inappropriate duplicates
- View teacher assignments
- View class subject teachers
- Add authorization checks

## Why This Is Important

Later modules can use assignment records for resource authorization.

Example:

```text
Teacher requests attendance.create
           ↓
Is teacher assigned to this class/section?
           ↓
YES → Allow
NO → Deny
```

## Deliverable

Teacher academic responsibilities are centrally defined.

Status: READY FOR NEXT PHASE. Teacher assignments are implemented with the assignment model, create/edit flows, active duplicate prevention, teacher assignment history, class subject teacher views, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Assignment model
- [x] Create assignment
- [x] Edit assignment
- [x] Duplicate checks
- [x] Teacher assignment view
- [x] Class assignment view
- [x] Authorization
- [x] Tests

---

# Phase 14 — Attendance

## Goal

Allow authorized teachers/admins to record attendance.

## Design

```text
Academic Year
Class
Section
Date
   ↓
Attendance
   ↓
Students
```

Attendance statuses may include:

```text
Present
Absent
Late
Excused
```

## Tasks

- Create attendance schema
- Load enrolled students
- Record attendance
- Update attendance
- View attendance by date
- Student attendance history
- Attendance summary

## Important Rules

- Prevent duplicate attendance records.
- Teacher must be assigned to relevant class/section if required.
- Use indexes for common attendance queries.

## Deliverable

Reliable daily attendance management.

Status: READY FOR NEXT PHASE. Attendance is implemented with daily class/section records, roster loading from active enrollments, duplicate prevention, updates, student history, class summaries, teacher-assignment authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Attendance model
- [x] Daily attendance entry
- [x] Duplicate prevention
- [x] Attendance update
- [x] Student history
- [x] Class summary
- [x] Authorization
- [x] Tests

---

# Phase 15 — Exams

## Goal

Create and manage exams.

## Suggested Structure

```text
Exam
├── Academic Year
├── Class
├── Name
├── Start Date
├── End Date
└── Subjects
```

## Tasks

- Exam CRUD
- Associate exam with academic structure
- Configure subject exams
- Configure total/pass marks
- Validate schedules

## Deliverable

Exam definitions ready for marks entry.

Status: READY FOR NEXT PHASE. Exam definitions are implemented with CRUD, academic year/class relationships, per-subject mark setup, schedule validation, authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Exam model
- [x] CRUD
- [x] Subject setup
- [x] Validation
- [x] Authorization
- [x] Tests

---

# Phase 16 — Marks & Results

## Goal

Record marks and generate student results.

## Flow

```text
Exam
   ↓
Subject
   ↓
Student
   ↓
Marks
   ↓
Calculated Result
```

## Tasks

- Create marks/result schema
- Load eligible students
- Enter marks
- Edit marks
- Validate max/min marks
- Calculate grade/result
- Student result page
- Class result page

## Important Rules

- Prevent duplicate marks for same exam/student/subject.
- Teachers should only enter marks for assigned subjects where applicable.
- Result calculation should live in services, not controllers.

## Deliverable

Complete exam result workflow.

Status: READY FOR NEXT PHASE. Marks and results are implemented with duplicate-safe marks, eligible student loading, mark entry/editing, validation, service-layer result calculation, student result pages, class result pages, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Marks model
- [x] Entry form
- [x] Duplicate prevention
- [x] Result calculation
- [x] Student result
- [x] Class result
- [x] Authorization
- [x] Tests

---

# Phase 17 — Fees

## Goal

Define student fee obligations.

## Example Fee Types

```text
Admission Fee
Tuition Fee
Exam Fee
Transport Fee
Library Fee
```

## Tasks

- Fee type management
- Fee assignment
- Student fee records
- Due dates
- Status handling
- Outstanding amount calculation

## Deliverable

The system knows what each student owes.

Status: READY FOR NEXT PHASE. Fees are implemented with fee types, student fee assignments, due dates, outstanding balance calculation, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Fee model
- [x] Fee types
- [x] Student fee assignment
- [x] Due dates
- [x] Outstanding calculation
- [x] Authorization
- [x] Tests

---

# Phase 18 — Payments

## Goal

Record payments separately from fee obligations.

## Example

```text
Fee: 10,000

Payment 1: 4,000
Payment 2: 3,000

Outstanding: 3,000
```

## Tasks

- Create payment model
- Record payments
- Support partial payments
- Payment history
- Receipt/reference number
- Prevent invalid overpayments where applicable
- Payment status calculation

## Deliverable

Reliable fee payment tracking.

Status: READY FOR NEXT PHASE. Payments are implemented with separate payment records, partial payment support, reference numbers, payment history, outstanding balance updates, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Payment model
- [x] Payment creation
- [x] Partial payment support
- [x] Outstanding balance
- [x] Payment history
- [x] Validation
- [x] Authorization
- [x] Tests

---

# Phase 19 — Timetable

## Goal

Create class schedules.

## Suggested Fields

```text
academicYear
class
section
subject
teacher
day
startTime
endTime
room
```

## Tasks

- Create timetable
- Edit timetable
- Weekly timetable display
- Detect class conflicts
- Detect teacher conflicts

## Deliverable

Validated weekly academic timetable.

Status: READY FOR NEXT PHASE. Timetables are implemented with weekly display, create/edit/detail screens, teacher assignment validation, class and teacher conflict prevention, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Timetable model
- [x] CRUD
- [x] Weekly view
- [x] Teacher conflict prevention
- [x] Class conflict prevention
- [x] Authorization
- [x] Tests

---

# Phase 20 — Notices & Announcements

## Goal

Publish notices to selected audiences.

## Possible Audiences

```text
Everyone
Admins
Teachers
Students
Guardians
Specific Class
Specific Section
```

## Tasks

- Notice model
- Create notice
- Publish/unpublish
- Audience targeting
- Notice list
- Notice details
- Date-based visibility

## Deliverable

Role- and class-aware announcement system.

Status: READY FOR NEXT PHASE. Notices are implemented with create/edit screens, publish status, audience targeting, date-based visibility, scoped authorization and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Notice model
- [x] Create/edit
- [x] Audience targeting
- [x] Publish status
- [x] Visibility rules
- [x] Authorization
- [x] Tests

---

# Phase 21 — Reports

## Goal

Generate useful management reports from existing modules.

## Initial Reports

- Student list/report
- Teacher report
- Enrollment report
- Attendance report
- Exam result report
- Fee collection report
- Outstanding fee report
- Teacher assignment report

## Tasks

- Add filtering
- Add date ranges
- Add pagination where appropriate
- Design printable views
- Optimize MongoDB queries

Avoid building reports before the underlying source modules are stable.

## Deliverable

Operational reports for school administrators.

Status: READY FOR NEXT PHASE. Reports are implemented with admin-only printable student, attendance, result and fee reports, filters, date ranges where relevant, lean/populated queries and tests. See [development progress](development-progress.md).

## Completion Checklist

- [x] Student report
- [x] Attendance report
- [x] Result report
- [x] Fee report
- [x] Filters
- [x] Query optimization
- [x] Authorization

---

# Phase 22 — Security Hardening

## Goal

Review the application systematically for security issues.

## Tasks

### Authentication Security

- Password hashing
- Secure sessions
- Session regeneration after login
- Safe logout
- Cookie configuration

### Request Security

- CSRF protection
- XSS protection/output escaping
- NoSQL injection prevention
- Request validation
- Rate limiting

### Authorization

Review every protected action for:

```text
Authenticated?
     ↓
Has permission?
     ↓
Owns / can access resource?
     ↓
Allow
```

### Secrets

Ensure secrets stay in:

```text
.env
```

and `.env` is ignored by Git.

### Error Handling

Never expose:

- Passwords
- Tokens
- Session values
- Stack traces
- Internal database details

## Deliverable

Security review completed before production preparation.

Status: READY FOR NEXT PHASE. Security hardening is implemented with reviewed session and CSRF behavior, stricter request-data rejection, safe error handling, secret checks, authorization coverage, rate limiting and explicit browser security headers. See [development progress](development-progress.md).

## Completion Checklist

- [x] Session security reviewed
- [x] CSRF protection
- [x] XSS protection
- [x] NoSQL injection protection
- [x] Rate limiting
- [x] Authorization audit
- [x] Secret management
- [x] Error exposure audit
- [x] Security headers

---

# Phase 23 — Testing

## Goal

Add reliable automated tests for critical workflows.

## Test Layers

```text
Unit Tests
   ↓
Services / business logic

Integration Tests
   ↓
MongoDB + application services

HTTP Tests
   ↓
Express routes

Authorization Tests
   ↓
Roles + permissions + ownership
```

## Priority Test Areas

- Authentication
- Permissions
- Resource ownership
- Enrollment duplicates
- Attendance duplicates
- Teacher assignments
- Exam marks
- Result calculation
- Fee calculations
- Payments

## Deliverable

Critical workflows have automated coverage.

Status: READY FOR NEXT PHASE. Testing is consolidated with explicit unit, integration, critical workflow and all-test scripts, plus database constraint coverage for critical duplicate protection. See [development progress](development-progress.md).

## Completion Checklist

- [x] Test configuration
- [x] Unit tests
- [x] Integration tests
- [x] Authentication tests
- [x] Authorization tests
- [x] Database constraint tests
- [x] Critical workflow tests

---

# Phase 24 — Performance & Database Optimization

## Goal

Review application behavior with larger data volumes.

## Tasks

Review:

- MongoDB indexes
- Compound indexes
- Query projections
- Pagination
- Sorting
- Search queries
- Aggregation pipelines
- N+1-like repeated query patterns
- Large response payloads
- Dashboard queries
- Report queries

## Deliverable

Database/query design optimized for realistic usage.

Status: READY FOR NEXT PHASE. Performance and database optimization is implemented with common-query indexes, slimmer report queries, bounded report option reads, pagination review and regression tests. See [development progress](development-progress.md) and [performance database review](performance-database-review.md).

## Completion Checklist

- [x] Common queries analyzed
- [x] Indexes reviewed
- [x] Pagination optimized
- [x] Reports optimized
- [x] Dashboard optimized
- [x] Unnecessary queries removed

---

# Phase 25 — Production Readiness

## Goal

Prepare the application architecture for a production environment.

## Tasks

Review:

- Production environment variables
- Production Docker image
- Development vs production Docker configuration
- Container user permissions
- Logging
- Error reporting
- MongoDB security
- MongoDB backups
- Reverse proxy
- HTTPS
- Health checks
- Process management
- Session storage
- Persistent storage
- Deployment workflow

Do not blindly reuse development Docker configuration in production.

## Deliverable

Production deployment checklist and configuration strategy.

Status: READY FOR NEXT PHASE. Production readiness is implemented with a production Dockerfile, production Compose template, production environment example, health endpoint, production deployment guide and verification tests. See [development progress](development-progress.md) and [production readiness](production-readiness.md).

## Completion Checklist

- [x] Production environment strategy
- [x] Production Docker strategy
- [x] HTTPS strategy
- [x] Reverse proxy strategy
- [x] Health checks
- [x] Backup strategy
- [x] Logging strategy
- [x] Session persistence strategy
- [x] Deployment/rollback strategy

---

# Phase 26 — Demo Seed Data

## Goal

Provide safe, repeatable seed data so a new reviewer can sign in and walk through the complete school-management flow without manually creating every record.

## Tasks

Implement a demo data seeding workflow for:

- Admin / staff demo users
- Academic year
- Classes
- Sections
- Subjects
- Teachers
- Students
- Guardians
- Enrollments
- Teacher / class / subject assignments
- Attendance records
- Exams
- Marks and results
- Fee types
- Student fees
- Payments
- Timetable entries
- Notices

The seed workflow must be explicit and safe:

- Do not run demo seeding automatically in production startup.
- Do not overwrite real user data.
- Make the seed command repeatable / idempotent where practical.
- Use obvious demo credentials only for local/demo environments.
- Document all demo login credentials and walkthrough coverage.
- Keep seeded data realistic enough to exercise filters, reports, dashboards and common CRUD screens.
- Include a clear cleanup or reset strategy for local demo data.

## Deliverable

A documented seed command and complete demo dataset that lets a user exercise the full application flow from login through reports.

Status: READY FOR NEXT PHASE. Demo seed data is implemented with an explicit npm command, guarded production behavior, repeatable demo reset/reseed logic, documented credentials, cleanup guidance and automated verification. See [development progress](development-progress.md) and [demo seed data](demo-seed-data.md).

## Completion Checklist

- [x] Seed command added
- [x] Demo users created with documented credentials
- [x] Academic structure seeded
- [x] Student / guardian / teacher data seeded
- [x] Enrollment flow data seeded
- [x] Teacher assignment data seeded
- [x] Attendance data seeded
- [x] Exam / marks / result data seeded
- [x] Fee and payment data seeded
- [x] Timetable data seeded
- [x] Notice data seeded
- [x] Reports have meaningful seeded data
- [x] Seeder is repeatable or safely guarded
- [x] Seeder does not run automatically in production
- [x] Cleanup / reset strategy documented
- [x] Automated verification added where appropriate

---

# Recommended Build Order

Follow this exact order unless a strong architectural reason requires changing it:

```text
Phase 1   Planning & Architecture
   ↓
Phase 2   Docker & Project Setup
   ↓
Phase 3   Application Foundation
   ↓
Phase 4   Authentication
   ↓
Phase 5   Roles & Permissions
   ↓
Phase 6   Dashboard
   ↓
Phase 7   Academic Year
   ↓
Phase 8   Classes / Sections / Subjects
   ↓
Phase 9   Students
   ↓
Phase 10  Teachers
   ↓
Phase 11  Guardians
   ↓
Phase 12  Enrollment
   ↓
Phase 13  Teacher Assignment
   ↓
Phase 14  Attendance
   ↓
Phase 15  Exams
   ↓
Phase 16  Marks & Results
   ↓
Phase 17  Fees
   ↓
Phase 18  Payments
   ↓
Phase 19  Timetable
   ↓
Phase 20  Notices
   ↓
Phase 21  Reports
   ↓
Phase 22  Security Hardening
   ↓
Phase 23  Testing
   ↓
Phase 24  Performance Optimization
   ↓
Phase 25  Production Readiness
   ↓
Phase 26  Demo Seed Data
```

---

# How to Work Through This Plan

For every phase:

1. Read the phase goal.
2. Design the model/data flow where applicable.
3. Identify files that need to be created or modified.
4. Implement the smallest working version.
5. Run the application through Docker.
6. Test the feature manually.
7. Add automated tests where appropriate.
8. Verify security and authorization.
9. Complete the checklist.
10. Commit the phase to Git.
11. Only then continue to the next phase.

Recommended Git style:

```text
feature/docker-setup
feature/authentication
feature/roles-permissions
feature/student-management
feature/attendance
```

Example commits:

```text
chore: configure docker development environment
feat: implement session authentication
feat: add role and permission authorization
feat: add student management module
```

---

# Codex Phase Prompt

When starting or continuing a phase, the following instruction can be given to Codex:

```text
Follow the project action plan in this repository.

Work only on the current phase and continue from the first incomplete checklist item.

Before editing:
- inspect the current repository,
- inspect git status,
- read all relevant existing files,
- identify what is already implemented.

Then implement the smallest complete logical step.

Requirements:
- edit the repository directly,
- preserve unrelated existing work,
- do not jump to future phases,
- use the established MVC structure,
- keep controllers thin,
- keep business logic in services,
- use repositories only where useful,
- use Docker commands where practical,
- validate inputs,
- enforce authorization and ownership where relevant,
- do not expose secrets,
- do not add unnecessary dependencies.

After editing:
- run the relevant available checks,
- verify the application behavior,
- fix failures caused by your changes,
- update the current phase checklist/status if this repository tracks it.

Stop after the current logical step or completed phase.

Report:
1. what changed,
2. files changed,
3. commands/checks run,
4. verification result,
5. remaining items in the current phase.
```

---

# Phase Completion Template

Use this after each phase:

```markdown
## Phase X Completion

### Implemented
- [x] ...

### Verified
- [x] ...

### Tests
- [x] ...

### Security Review
- [x] ...

### Remaining
- [ ] ...

### Status
READY FOR NEXT PHASE
```

Do not move forward until the phase status is:

```text
READY FOR NEXT PHASE
```

---


# Optional Progress Tracking

For long-running Codex implementation, maintain a small file such as:

```text
docs/development-progress.md
```

Recommended format:

```markdown
# Development Progress

Current Phase: 2 — Docker & Project Setup
Current Step: 2.4 — Create docker-compose.yml
Status: IN PROGRESS

## Completed
- [x] Phase 1
- [ ] Phase 2

## Current Notes
- App service created
- Mongo service pending verification

## Known Issues
- None
```

This prevents Codex from losing the current implementation position across separate sessions.

Do not use the progress file as a substitute for actual verification.

---

# First Development Step

Start with:

```text
Phase 1 — Project Planning & Architecture
```

After Phase 1 is confirmed, proceed to:

```text
Phase 2 — Docker & Project Setup
```

Do not write the entire application at once. Build, verify, and stabilize each phase before continuing.

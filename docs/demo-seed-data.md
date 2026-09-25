# Demo Seed Data

Phase 26 adds an explicit demo seed command for local review databases. It never runs during app startup.

## Command

Start the development containers, then run:

```bash
docker compose exec app npm run seed:demo
```

The command resets only known demo records and recreates the walkthrough dataset. It is safe to run repeatedly in a local/demo database because cleanup is limited to demo emails, IDs, names, reference numbers and related records.

To remove the demo dataset without recreating it:

```bash
docker compose exec app npm run seed:demo -- --cleanup
```

The command refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED_IN_PRODUCTION=true` is set intentionally for a throwaway demo database.

## Demo Logins

All demo users use the same password:

```text
DemoPass12345!
```

| Role | Email |
| --- | --- |
| Admin | demo.admin@example.test |
| Teacher | demo.teacher@example.test |
| Student | demo.student@example.test |
| Guardian | demo.guardian@example.test |

## Walkthrough Coverage

The seed data includes:

- Demo academic year: `Demo Academic Year 2026`
- Demo classes and sections for Grade 8 and Grade 9
- Demo English, Mathematics and Science subjects
- Demo teacher and second teacher records
- Three students with guardian links
- Active enrollments with roll numbers
- Teacher / class / section / subject assignments
- Attendance days with present, late and absent states
- Completed midterm exam with marks and pass/fail variety
- Tuition and exam fee types
- Paid, partial and pending student fees
- Payment history with demo reference numbers
- Timetable entries across multiple days
- Published notices for everyone and a class audience

This is enough to exercise login, dashboards, scoped role navigation, list/search/filter screens, CRUD detail pages, attendance, exams, results, fees, payments, timetables, notices and reports.

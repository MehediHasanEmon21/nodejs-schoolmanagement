# Performance & Database Review

Phase 24 focused on query/index alignment for the current operational modules.

## Changes

- Added compound indexes for common list filters and sorts across students, teachers, guardians, enrollments, attendance, exams, fee types, student fees, notices and academic structure options.
- Kept dashboard data as lightweight placeholders, so no dashboard database optimization was needed yet.
- Reduced report option queries with field projections and a bounded exam option list.
- Reduced report row payloads with `select()` and narrower `populate()` projections.
- Added regression coverage that asserts important query-supporting indexes remain present.

## Notes

- Existing paginated list pages already use `countDocuments`, bounded page sizes, `skip` and `limit`.
- Report pages intentionally cap returned rows for operational browser rendering.
- Future large-school work should revisit keyset pagination for very deep pages and add aggregate-based reports if report volumes exceed browser-table use.

# Module 13 Attendance

30 October 2026. Scope: registers, attendance saves, holidays, date restrictions, Student summaries and statistics. Manual verification belongs to the owner.

## Trace and changes

Admin/Teacher register and Student attendance panel → attendance actions → attendance service → delivery.attendance_register / delivery.save_attendance → cohort, enrollment, attendance sessions and records.

1. Read paths had no caller check, suppressed errors and could truncate roster/mark reads. A scoped database register now returns complete JSON after validating the caller. Staff access derives from campus/assignment; a Student can request only their own records.
2. A Teacher home-campus fallback allowed unassigned cohort edits. Writes now require an actual assignment or Super Admin identity, derived inside the database. Institution Admin remains read-only for Attendance.
3. Per-student select/write loops could partially save a roster and race into duplicate sessions. One validated, locked transaction saves the batch; live unique indexes protect date sessions and Student marks. Batches are limited to 2,500 records and duplicate/unrelated/unenrolled records are rejected before writing.
4. Saving attendance previously removed holidays implicitly. A holiday now blocks marks until explicitly removed. Marks are preserved but excluded from holiday statistics.
5. Browser/server dates now consistently use Asia/Kolkata. Teachers edit today only; Super Admin can correct elapsed dates within the cohort range. Future marking is rejected. Pre-enrollment marks are rejected; bulk controls exclude students who had not joined on the chosen date.
6. Shared statistics exclude future, holiday and pre-enrollment dates. Percentage is (present + late) / marked days, rounded to one decimal; no marks is 0%, not an invented 100%. Unmarked days are not counted as absent, and that rule is shown in the UI.
7. Register queries follow protected cache invalidation. Student load uses one own-record request instead of fetching full registers twice. Reads show errors with Retry. Mutation failures roll back optimistic marks and recover controls.
8. Roster views show 50 students per page and sheets show one selected month, keeping DOM size bounded. Bulk actions still cover the eligible whole roster. Late-arriving institution selection and failed group loads recover correctly.
9. RLS was enabled on attendance_sessions and attendance_records, scoped SELECT policies were added and raw authenticated writes were revoked in favour of the checked RPC. Nine other delivery tables still require the broader RLS pass.

## Passed

- Rolled-back SQL assertions for assignment/identity, batch atomicity, duplicates, repeated saves, date locks, holidays, Student own-only reads and raw-write denial.
- Capacity fixture: 1,002 synthetic enrolled students returned, 1,001 marks saved and returned. Observed database save 563.877 ms and register read 667.842 ms. All writes rolled back; these are one-run database timings, not browser latency or a load SLA.
- Unit/service/action tests cover date validation, UTC midnight versus campus day, statistics, duplicate rejection, single-RPC batching, explicit read errors and structured authorization failures.
- Component tests cover 50-row/month bounds, later-page navigation, read Retry, optimistic rollback with connection loss and pre-enrollment bulk exclusion.

## Failed then fixed

Unauthorized reads and home-campus edits, per-row partial writes, truncation risk, implicit holiday changes, deployment-timezone mismatch, false empty-roster/100% states, stale views and oversized sheets were addressed.

## Blocked and untested

The owner must run A1-A8 in the checklist, including real responsive layouts and reconnect behaviour. Query results above 100,000 rows fail explicitly instead of returning a partial report. Attendance register date ranges are limited to 3,661 days. This pass does not approve production: the remaining delivery security work and real-browser/load checks remain open.

Evidence: database-integration.sql, database-result.json, capacity-integration.sql, capacity-result.json, component-tests.log and shared final validation under ../module-14/.

# Hynox Campus testing and fixes

30 October 2026. Today's scope is four modules: **10 Projects, 12 quiz Strict mode, 13 Attendance and 14 Analytics**. Module 11 coding challenges, execution and challenge Strict mode were excluded completely. Existing Module 1-9 fixes were preserved; the starting Git checkout was clean at be29fb9.

Code and targeted Supabase verification are complete for this pass. Manual verification is handed to the owner and is not recorded as passed. Use [the manual checklist](manual-verification-2026-10-30.md) and return case IDs with actual results.

## Final verification

| Check | Result |
| --- | --- |
| Full npm test | 554 passed across 78 files |
| Increase over the previous 519-test checkpoint | 35 tests and 8 test files |
| Production npm run build | Passed |
| Standalone TypeScript | Passed |
| Focused ESLint | 27 changed TypeScript files, zero errors and zero warnings |
| Git whitespace check | Passed |
| Project database fixture | Passed and rolled back |
| Quiz Strict mode database fixture | Passed and rolled back |
| Attendance database and capacity fixtures | Passed and rolled back |
| Anonymous REST projection checks | HTTP 200, valid nested joins, zero exposed rows |
| Today's manual browser verification | Owner handoff; not performed by Codex |

One full-suite run hit a timeout in the new large-register test's expensive accessibility-tree scan. The diagnostic is retained in module-14/tests-timing-diagnostic.log. The assertion was made more direct while retaining the same row/month bounds, and the later complete suite passed. Initial fixture setup errors were corrected before the recorded passing SQL runs. No failed run is presented as a pass.

## Changes by module

### 10 Projects

Identical pending submission retries no longer rewrite activity progress timestamps or trigger unnecessary revisions. Caller, activity and progress ownership remain checked in the database. Submission/review read failures now reach the UI instead of appearing as missing work or an unlocked form. Staff project reads carry the assignment cohort and use bounded pages/ID batches.

An open Student project review updates after protected dashboard changes while preserving an unsent repository/notes draft. Lesson project loads ignore stale responses and preserve drafts. Tests cover read failures, feedback preservation, live review refresh, repository validation, grade bounds, self-review denial, reviewer identity, approval/revision progress and resubmission cleanup.

Details: [Module 10 report](module-10/report.md).

### 12 Quiz Strict mode

Fullscreen and tab visibility events from one departure now share one warning, including events arriving before React renders. A failed forfeit save locks the attempt and retries every five seconds/on reconnect; normal answer submission cannot bypass the pending forfeit. Successful submission clears warning state before fullscreen cleanup.

The unload endpoint validates origin, JSON/body size, attempt ID and reason length. Component tests cover fullscreen denial without consuming an attempt, recovery during the first warning, expiry at 15 seconds, second departure, offline forfeit/reconnect and normal submission without a false violation. SQL verifies zero-score closure, ownership, retry idempotency and exclusion from course completion.

Details: [Module 12 report](module-12/report.md). Real fullscreen, unload and browser behaviour still require the owner's checks.

### 13 Attendance

Attendance reads and writes now go through scoped database functions. Student reads contain only that Student. Teacher writes require a saved cohort assignment; a home campus alone is insufficient. Institution Admin remains read-only. Sessions and marks have live unique indexes, and one validated transaction saves the whole date's batch instead of per-student request loops. Invalid/duplicate/unenrolled marks fail before any partial save.

Holidays must be removed explicitly before marking. Client and server share the Asia/Kolkata date boundary. Teachers edit today only; Super Admin can correct elapsed dates within the cohort range. Future and pre-enrollment marks are rejected. Bulk marking excludes people who had not joined on the selected date.

Shared attendance statistics count marked elapsed working days after enrollment. Rate is present plus late divided by marked days, with no marks shown as 0%. Future, holiday and pre-enrollment dates do not affect that rate. The UI explains that unmarked dates are not automatically absences.

Registers participate in protected refresh, show recoverable read errors and roll back optimistic marks when saving fails. Roster pages contain 50 students; sheets contain one month. A rolled-back capacity fixture returned 1,002 students and 1,001 saved marks. Observed database-only timings were 563.877 ms for saving and 667.842 ms for reading; these are not browser timings or a production SLA.

RLS and checked write access now protect attendance_sessions and attendance_records. Details: [Module 13 report](module-13/report.md).

### 14 Analytics

Quiz/project report rows now carry actual assignment cohort identity. Cohort filtering checks the assignment as well as Student membership, preventing cross-cohort contamination for Students enrolled in multiple groups. Outcomes and engagement count distinct assigned Student/activity pairs; a failed quiz followed by a passed retake occupies one passed slot. In-progress work is separate from failed finalized results, and scores use each attempt's actual point denominator.

Student drilldown counts passed quizzes, uses normalized scores, limits syllabus courses to the cohort's assignments and follows refreshed Student progress. Removed unused per-cohort Attendance report requests and eager loading of all course lessons. Relevant report queries use stable 500-row pages, deduplicated 100-ID groups and at most four independent requests in parallel; later-page errors are visible instead of becoming partial totals.

Details: [Module 14 report](module-14/report.md).

## Data safety and practical limits

Two migrations were applied: attendance_atomic_scopes_and_statistics and project_review_grade_integrity. Integration fixtures used random synthetic identities inside transactions and rolled back. No real account roles, real marks or coursework were edited. Coding challenge code paths were not exercised or modified as part of this pass; shared types/cache infrastructure remain in use by the application.

Manual cases P1-P8, S1-S8, A1-A8 and N1-N8 are ready for the owner. They cover all four roles, responsive widths, invalid inputs, retries, grade/feedback propagation and report arithmetic. The checklist includes the exact information to return for failures.

The broader release security pass remains open. After securing Attendance, **nine delivery tables still lack RLS**: cohort_statuses, cohort_teachers, cohorts, course_assignments, course_progress, enrollment_statuses, enrollments, lesson_progress and progress_statuses. Remaining unprotected assignment/enrollment tables are not made safe by the Attendance RPC checks alone. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and security-advisors.json provide the follow-up references.

No production release approval is given. Real-browser manual results, production load/concurrency, network/browser failure behaviour and the remaining security/deployment checks must be reviewed. Report queries beyond 100,000 records fail explicitly; Attendance batches are limited to 2,500 records and register ranges to 3,661 days. These bounds do not certify all production workloads.

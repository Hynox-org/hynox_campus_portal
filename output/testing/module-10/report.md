# Module 10 Projects

30 October 2026. Scope: project submissions, review states, grades and feedback. Coding challenges are excluded. Manual verification is handed to the owner.

## Trace and changes

Student project and lesson views → learning actions → learning service → learning.submit_project / learning.review_project → submissions, reviews, activity progress and the course snapshot.

1. Identical pending submission retries previously called begin_student_activity before returning the existing submission. That could reset progress timestamps and trigger unnecessary revisions. The database now validates the caller and assignment, serializes the activity, and returns an identical pending submission before writing progress. A mismatched progress identifier is rejected.
2. Project detail reads ignored submission/review errors, which could falsely display an unlocked or unreviewed form. These errors now propagate visibly. Staff review lists also propagate review lookup failures.
3. Project results carry the actual activity and cohort assignment. Staff reads use paged responses and bounded ID batches rather than silently stopping at the REST row limit.
4. An already open Student project detail observes protected dashboard changes. Review, grade and feedback refresh without overwriting unsent repository/notes drafts. Lesson project loads reject stale responses and preserve drafts across background updates.

## Passed

- Service regressions cover submission/review read failures and preserved stored feedback.
- A Student component test verifies an open review updates while an unsent repository draft survives.
- The rolled-back database fixture covers malformed URL, Student self-review denial, unauthorized Student, grade bounds, invalid review state, server-derived reviewer identity, approval completion, revision removal of completion, resubmission cleanup and idempotent retries. A deliberately older synthetic progress timestamp remains unchanged on an identical retry.
- Anonymous REST projection checks returned HTTP 200 with zero exposed submission rows and validated the nested assignment projection.
- Shared final suite, build, types and lint evidence is under ../module-14/.

## Failed then fixed

Timestamp-changing retries, swallowed read failures, stale open review details and unbounded staff reads were corrected. Existing valid approval/revision behaviour was retained.

## Blocked and untested

The owner must complete P1-P8 in ../manual-verification-2026-10-30.md. Today's manual browser checks were not performed by Codex. Simultaneous production load and transport behaviour require further verification; broader delivery RLS still blocks production approval.

Evidence: database-integration.sql, database-result.json, project-ui-tests.log, src/services/project-details.test.ts and the shared validation logs.

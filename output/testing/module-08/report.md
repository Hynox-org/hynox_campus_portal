# Module 8 Activity management

29 October 2026. Shared activity editing, assignment, submission and review were traced from the interface through server actions and services to Supabase.

## Passed

- Transactional activity/subtype/question/assignment saves and idempotent assignment retries; scoped role/campus and assigned Teacher checks.
- Rolled-back integration fixture covering validation, unauthorized access, rollback and submission/review state transitions.
- Teacher Brave: created optional project, saved draft, published to QA cohort and edited title. Student saw updated title.
- Student Brave: empty URL validation, valid synthetic submission and locked pending form; malformed URL created no submission, but its transient error text was not captured.
- Teacher approved 90/100; Student saw Approved, 90/100 and the exact mentor feedback with locked resubmission.
- Student project layouts checked at 320, 375 and 768px; mobile navigation and quiz cards checked at 375px.
- Shared final checks: 519 tests / 70 files, build and types passed, 134 scoped lint files clean.

## Failed then fixed

Non-atomic child writes, weak ownership checks and Student implicit project creation were removed. Submission and review use guarded transactions. Staff project projections omitted passing_score: two regressions reproduced the wrong 50 fallback and verified configured 60 after the fix. An animated ancestor clipped the activity drawer; a document-root portal and accessible close button passed regression and Brave retesting.

## Blocked

Deferred delivery RLS blocks production approval.

## Untested

Sandbox execution excluded by owner. Worker credential, job claim and progress code was hardened, but live judging is not certified. Production latency, multi-browser simultaneous edits, live updates inside an already open review detail and exhaustive device coverage remain unverified. Manual deletion was not performed.

See ../module-09/manual-verification.md and the consolidated report for evidence. database-integration.sql was rolled back.


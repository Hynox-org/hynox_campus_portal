# Module 9 Quizzes

29 October 2026. Quiz questions, attempts, scoring and retake approval were traced UI → actions → services → Supabase.

## Passed

- Atomic start and finish with server-derived assignment, locks, idempotent retries and grading validation.
- Rolled-back integration fixture: valid and invalid answers, ownership/access restrictions, safe answer-key projection, scoring scales, retry/retake rules and history preservation.
- Native Brave Student: four question formats, timed attempt, blank 0/8 failure, attempt-limit lock, approved retake and 8/8 pass with normalized short answer. Final counter 2/2; no additional attempt after passing.
- Native Brave Teacher: failed attempt audit including all question types, one retake approval; database confirmed one credit and preserved failed attempt.
- Final npm test: 519 tests / 70 files. npm run build and TypeScript passed. Focused ESLint: 134 files, zero errors and zero warnings.

## Failed then fixed

Early answer-key exposure, unrestricted raw writes, first-assignment selection, unguarded attempt counting, incompatible score scales, destructive question replacement and broken retake counters were addressed by scoped transactional functions. Attempted question edits are locked. Staff displays use persisted pass/fail and actual attempt maximum. Ordinary failed attempts now show Teacher retake approval, and the Student counter includes the approved allowance.

## Blocked

Production approval remains blocked by eleven delivery tables requiring RLS. Broader Supabase advisor findings require a separate pass.

## Untested

Exhaustive browser/mobile, production load and network failure behaviour; final Admin/Institution manual details are recorded in the consolidated report. No claim that all production conditions pass.

Evidence: database-integration.sql, manual-verification.md, live-qa-manifest.json, tests-final.log, build-final.log, types-final.log, lint-final.json and before/after logs in Modules 7 and 8. Manual QA course is retained; database integration fixtures were rolled back.


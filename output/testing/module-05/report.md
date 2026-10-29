# Module 5 Academic structure

Updated 27 October 2026. Existing fixes were preserved. Production release is not approved.

## Passed

- Full automated suite: 468 tests across 59 files. Evidence: tests-final.log. Final build, type and lint logs are in this folder; their results must be read independently of the test result.
- Final production build, TypeScript check and git diff --check passed. Focused lint across all changed TypeScript files failed with 409 errors and 132 warnings, including existing legacy debt. See final-validation-summary.txt.
- Traced program/course/module/lesson/resource UI through actions, services and Supabase. Added runtime input validation, persisted parent ownership and active/deleted ancestor checks. Read/write guards enforce role, assignment and campus scope in the application.
- Rolled-back synthetic SQL tests cover hierarchy mismatch, deleted parents, duplicate assignments, unauthorized writes, atomic instructor replacement, colleague editing and revision isolation. Database integration script is database-integration.sql.
- Admin created QA Module 5-6 Hierarchy, QA M56 Manual Course, module and Markdown lesson in Brave. Program/course activation and visibility controls were exercised. Missing required program input was blocked.
- Teacher accessed assigned QA campus/cohorts, shared curriculum and media. External lesson changes appeared in its open preview without refresh. Original QA title was restored.
- Student opened QA M56 Collaborative Group, its assigned course, module and text lesson. Markdown hierarchy, heading and bullets rendered. The lesson was also inspected at 320px responsive width.

## Failures reproduced and fixed

- Parent/campus and authorization checks were inconsistent. Shared academic scope helpers now derive ownership from database parents; database triggers reject invalid hierarchies.
- Standalone and cohort-only teachers could disappear from campus discovery. Protected teacher campus resolution now includes explicit campus, course and cohort mappings.
- Teacher curriculum prefetch was broader than assignment scope. Queries now restrict assigned courses and enrolled students before returning data.
- Program visibility was not manageable and course status/visibility controls were incomplete. Admin controls now expose these values and preserve explicit zero durations.
- Academic explorer eagerly fetched descendants. Modules, lessons and resources now load on expansion and reuse cache. Partial failures clear loading state and support retry.
- Failed catalog reads looked like empty results. Program/course errors now show an error and Retry; regression failed before the fix and passes afterward.
- Refetched query data did not consistently update local curriculum caches/previews. Revision-driven invalidation and cache synchronization now update mounted views.

## Failed or open

- Existing lint debt remains. See changed-files-final-lint.log and baseline-lint.log; do not interpret passing tests/build as lint cleanliness.
- Broad academic read policies and eleven delivery tables without RLS remain part of the deferred security pass. Application guards do not replace database RLS.

## Blocked or untested

- Production deployment limits were not established; original Modules 1-3 Markdown reports were absent.
- Full concurrent edit conflict handling, very large catalog pagination, offline recovery under real network loss, provider expiry and physical mobile devices were not exhaustively tested.
- Student audio/image playback was not repeated in the final Student session; its selector exposed only the new QA cohort. Earlier Student video/PDF checks and Teacher audio/image checks are recorded separately in Module 4.
- Precise progress recalculation after curriculum changes and assignment-specific analytics eligibility need the learning/progress testing pass.

## Retained QA data

live-qa-manifest.json records the new hierarchy and authorized QA mappings. Dedicated fixtures remain for review. SQL integration fixtures were rolled back. No credentials are included.

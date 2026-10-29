# Module 4 — Course blueprints

Date: 27 October 2026. Scope: template CRUD, modules, lessons, resources, publication, ordering, and campus copying.

## Starting state and evidence limitations

The working tree was clean at commit `51ba002` before editing. Existing Modules 1–3 fixes were preserved. The requested `module-01/report.md`, `module-02/report.md`, `module-03/report.md`, and `dashboard-scope-and-remaining.md` were absent both on disk and in HEAD. Existing JSON evidence was available; these missing reports' lint/type findings and deployment limits cannot be reconstructed reliably. Markdown reports were globally ignored; an exception now preserves testing reports in Git.

## Trace

`src/app/admin/library-builder.tsx` → `src/hooks/use-library.ts` → `src/app/actions/library-actions.ts` → `src/services/library.ts` → the four `library.*_templates` tables and their RLS policies. Campus copying follows `src/app/admin/program-manager.tsx` → `instantiateCourseTemplateAction` → the service → `library.duplicate_course_template` → `academic.courses/modules/lessons/lesson_resources` in one database transaction. Source metadata is read by the academic course page.

## Reproduced failures and fixes

1. **RPC authorization bypass:** under the authenticated PostgreSQL role and a synthetic student JWT subject, the original SECURITY DEFINER RPC successfully copied a synthetic blueprint using a supplied super-admin actor ID. The server action's role guard did not protect direct RPC access. Reproduction was rolled back. The RPC now checks the active database identity, super-admin role and actor ID; checks the target program/campus relationship; requires a published, nondeleted blueprint; restricts anonymous execution; and pins its search path. Cross-campus requests fail before inserts.
2. **Duplicate/retry copying:** per-program advisory transaction locking and existing template/slug checks reject a second live copy. A unique partial index also prevents duplicate live blueprint slugs. Slugs may be reused after soft deletion. These are database protections, including requests that bypass the application.
3. **Missing runtime validation:** shared service validation now rejects missing/malformed titles, slugs, IDs, order/duration values, publication flags, unsupported lesson/resource types and unsafe URLs. Valid fields are trimmed. Service mutations also require super-admin identity; resource deletion previously had no session check. Structured Supabase errors remain visible through server-action error responses.
4. **False success/stale deletion:** updates and deletes filter out soft-deleted rows; deletes request the affected row so nonexistent/already-deleted IDs return an error. Zero lesson duration is preserved instead of becoming 15 minutes. Clearing a lesson video URL now sends an empty value instead of omitting the update.
5. **Publication and recovery:** the blueprint form now exposes the existing publication field. Curriculum loading only marks a course complete after every level succeeds; failures are shown and selection can retry. Loading state is tracked per course. Child refresh/expand paths show errors and clear loading flags in finally blocks.
6. **Ordering:** module/lesson/resource lists and the copy RPC use position, creation time and ID as deterministic tie breakers. Copying continues to normalize module/lesson positions to sequential values and preserves resource positions.

## Passed

- Final `npm test`: **386 tests passed across 44 files**, including 43 new Module 4 tests. Tests cover action authorization for signed-out, public, student, teacher, trainer and institution-admin identities; publication/cache invalidation; structured database errors; service role checks; missing-row deletion; valid normalization; zero duration; URL clearing; malformed input; unsafe URLs; ordering validation; failed-load retry; and the publication checkbox.
- `npm run build`: passed after correcting an initially detected validator type error. See the final build log for the last verification.
- Focused lint of the service, actions, validator and new tests: passed. The builder retains its baseline lint failures, detailed below.
- Rolled-back synthetic database integration: student mutation denial, student published visibility, draft curriculum invisibility, actor spoof denial, campus mismatch denial, draft/missing/deleted blueprint rejection, duplicate blueprint slug rejection, valid copying, duplicate retry denial, and copied curriculum/resource content, duration, positions and campus ownership.
- The migration was applied to the connected Hynox Campus project, then the fixture checks were rerun against the deployed function successfully. Anonymous EXECUTE is false and search_path is pg_catalog. No real accounts/data were edited by fixtures.
- Security advisor after migration: mutable search-path findings fell from 7 to 6; anonymously executable SECURITY DEFINER findings fell from 5 to 4. Remaining broader findings are not a release approval.

## Failed / open

- Focused lint including `library-builder.tsx`: **16 errors and 4 warnings**, identical counts to linting its untouched HEAD version. Existing explicit-any declarations and unused declarations remain; this task does not claim a clean repository lint run.
- One full-suite run overlapped with the build and hit an existing newsletter navigation test's 5-second timeout: 384 passed, 1 failed. The subsequent standalone `npm test` passed all 386. This is a resource-contention inference, not proof that the test can never flake; the failed run is retained.
- **Production release remains blocked:** all eleven delivery tables still have RLS disabled. Advisor also reports six newsletter tables with RLS but no policies, six remaining mutable function search paths, four other anonymous SECURITY DEFINER entry points, nineteen authenticated SECURITY DEFINER entry points for final review, and leaked-password protection disabled.

## Blocked

- Review of prior reports' deployment limits and baseline type/lint findings: the four supplied Markdown paths are missing. Current build/lint results above are independently measured.

## Untested / remaining

- Actual desktop/mobile browser layout, touch/keyboard operation, and authenticated browser-to-server journeys; component tests are not visual device verification.
- Complete direct database CRUD/input matrices for every template descendant, creating under a soft-deleted ancestor, descendant edits during publication changes, every lookup value, and legacy relative storage paths. URL fields now require HTTP(S) URLs; storage-key migration/rendering was not verified.
- Large blueprint catalog pagination and >1,000-row PostgREST truncation, large-curriculum fan-out, production latency, sustained concurrent copy stress and simultaneous editor conflicts. The copy retry test is sequential; the lock's concurrent behavior has not been load tested.
- Mid-copy database fault injection, provider outages, production deployment/runtime limits and performance budgets. No measured bottleneck claim or production deployment is made.
- Resource editing is not exposed by the existing UI/action API; create/list/delete are the current resource operations.

The reusable `database-integration.sql` runs its temporary schema changes and synthetic fixtures inside BEGIN/ROLLBACK. Use a privileged SQL connection; do not remove the rollback.


## Manual/media follow-up (27 October 2026)

This follow-up supersedes the earlier automated totals and the earlier blanket Brave-access blocker. Full suite: **412 tests across 47 files**, production build passed. See `manual-follow-up-tests.log` and `manual-follow-up-build.log`.

### Passed manually in Brave

- Google sign-in with thehynoxofficial@gmail.com completed and reached the Super Admin console. Database identity is now active and linked; no credential was created or exposed.
- Course Blueprints opened; the existing QA Library Blueprint, its module, text lesson, rendered Markdown body, and QA Docs attachment link appeared. The edit drawer displayed its publication checkbox and saved metadata. The drawer was cancelled without saving and the QA data was preserved.
- Admin logout returned to the normal Google login page.
- Institution Admin Google sign-in with the assigned account reached the campus-only analytics dashboard for Hynox QA Campus. The navigation exposed Analytics and Students rather than the Admin blueprint tools. Logout returned to login.

### Additional implementation and regression checks

- A shared LessonMedia renderer now serves Admin blueprint previews, academic course pages and student lessons. Academic course pages previously displayed a video placeholder; the student renderer misclassified any Supabase/Drive link as a PDF and any AWS/Google storage link as video. Classification now parses protocol, hostname and pathname, recognizes supported YouTube/Vimeo links, preserves signed direct-file URLs, and handles direct video/audio/images/PDFs and normalized Drive previews. Other HTTP(S) resources retain explicit external links. Malformed/unsafe URLs do not become links or embeds. Embedded resources have fallback links and responsive dimensions; videos/audio preload metadata and embeds/images load lazily.
- Nineteen media regression cases cover classification, storage URLs, spoofed YouTube hosts, invalid protocols, controlled video playback markup and document fallback links. Actual provider playback/codec/CORS behavior is still unverified.
- The blueprint selector now fetches only modules; lessons/resources load upon expansion and are cached on reopening. A component regression measures one initial module fetch with no descendant requests, then one request per opened branch. Before this change initial selection scheduled 1 + module count + lesson count requests. This is a verified request-count reduction, not a measured production latency claim.
- Academic lookup queries and independent course-page reads now execute concurrently, with lookup errors surfaced instead of silently becoming empty dropdowns. The course page also rejects a course paired with the wrong program. Four regressions cover these reads and the routing guard.
- Media inputs now use a generic Learning Media URL label, and the blueprint edit form preserves an explicit zero duration.

### Blocked and untested

- Teacher Google sign-in reached a phone identity-verification prompt. User completion is required; the Teacher dashboard has not yet been verified in this follow-up.
- Student browser sign-in and end-to-end course playback, mobile emulation and live browser playback across every provider remain open. Automated media cases do not establish successful video decoding, private-provider access or mobile layout.
- No persistent synthetic database fixtures were created for browser inspection. Existing QA records were viewed without mutation; database integration remains rollback-only.
- Focused lint for the new renderer/tests/page changes has no errors and three warnings (two existing unused page imports and one native-image optimization warning). Including the large pre-existing builder/student/course-console files reports 145 errors/30 warnings. Their HEAD baselines report 16 errors/4 warnings for the builder, 116 errors/14 warnings for student console and 19 errors/11 warnings for course console. The follow-up does not claim a lint-clean codebase.
- Eleven delivery tables without RLS still block production release. Earlier security/scale/deployment limitations remain open.


## Student and responsive verification continuation (27 October 2026)

- Teacher verification is **skipped at the user's request**, after Google requested phone confirmation.
- Student Google sign-in with akshaykumar7.m@gmail.com reached the Student Hub and the expected Hynox QA Campus identity. Overview and Syllabus both displayed the appropriate no-enrollment state. A read-only database check confirmed that this active, campus-linked account has **zero delivery.enrollments rows**; live enrolled-course playback is therefore blocked for this account. No enrollment or other real data was changed to manufacture a passing result.
- Brave's responsive toolbar was set to **320 pixels wide** (visible viewport approximately 320 � 584). The syllabus header and no-enrollment panel fit the viewport. The mobile navigation drawer opened, showed the correct Student actions, and navigating to Overview dismissed it. The Overview welcome panel, wrapped action buttons and stacked progress cards fit the mobile view. This checks these screens in browser emulation, not every device or lesson-media viewport.
- The login page was initially stuck showing Initializing after returning from an OAuth journey; a reload restored it. Code inspection showed the busy flag survived a browser back/forward-cache restoration. The page now resets the flag on a persisted pageshow event. A regression restores a pending page and verifies a fresh sign-in can start. Focused login tests and lint pass.
- Final verification: **413 tests passed across 47 files**, production build passed. These totals supersede the earlier 412 count. Direct local login GET during diagnosis returned HTTP 200 in about 219 ms; this is one development request, not an authenticated-page latency benchmark.

Still open: live enrolled-course playback and private-provider/codec/CORS behavior, Teacher dashboard verification, full Admin/mobile CRUD matrices, production-scale concurrency/pagination and the existing security-release blockers. The eleven delivery tables requiring RLS remain a production-release blocker.

Student logout also passed: Brave returned to the normal login page with Sign In with Google available. Responsive DevTools were closed. Focused academic-service lint was run and reports three existing explicit-any errors outside the changed lookup function; output is in academic-service-lint.log.

## Latest verification

The current consolidated outcome is in [current-verification.md](current-verification.md). Read it before the historical sections above: the QA course now has a Student enrollment and Teacher campus/course/cohort assignments, and media was exercised in Brave. Current count: 423 tests / 50 files; production build passed. Production approval remains blocked by security and remaining test gaps.

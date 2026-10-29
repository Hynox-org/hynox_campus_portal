# Module 4 — Current verification report

Final Modules 5/6 continuation: 468 tests across 59 files, production build and TypeScript checks passed. See ../module-05/report.md and ../module-06/report.md for new hierarchy/access/live-sync checks that supersede some open items below. Student new QA course/text lesson rendered at 320px. Student audio/image playback remains unverified in the final session; Teacher media evidence is separate. Final changed-file lint: 409 errors / 132 warnings across the expanded file set. RLS and other release gaps remain open.

Updated 27 October 2026. This report supersedes older progress counts and browser blockers in report.md. Production release is **not approved**.

## Passed

- Latest full suite: **423 tests across 50 files** (`teacher-final-tests.log`). Production build after Teacher media/cache/ordering changes passed (`teacher-final-build.log`). A subsequent mobile CSS build is recorded in `teacher-mobile-build.log`.
- Existing fixes from Modules 1–3 and this working tree were preserved. `git diff --check` passes.
- Admin Google role routing, blueprint inspection/publication drawer and logout; Institution Admin campus analytics and logout; Student routing, enrolled course delivery and logout were manually exercised in Brave in this workstream.
- Persistent, user-authorized QA course: three modules, eleven lessons, seven attachments. The blueprint was copied through the actual campus-copy RPC, then assigned to a synthetic QA cohort and the authorized Student account. Synthetic assets were uploaded to a dedicated QA bucket. See `live-qa-manifest.json`, `asset-upload-results.json`, `create-live-qa-course.sql`.
- Student: Markdown and all seven attachment links render. YouTube and both uploaded/external MP4 played. Portrait, landscape, scanned, fillable and ten-page PDF viewers loaded. At 320px the PDF clipping defect was reproduced and fixed with FitH; retest showed the full page fitted. Field submission and every PDF variant were not established.
- Teacher: authenticated as the verified SNS account; QA campus/cohort mapping was completed without changing existing account roles. Dashboard, curriculum navigation and QA course loaded. All eleven lessons appear in module/lesson order. Markdown, seven attachment links and the portrait PDF loaded. YouTube played; uploaded MP4 reached 5.055 seconds; uploaded audio reached one second; image rendered.
- Teacher image/preview layout inspected at 320, 375, 430 and 768px in Brave responsive emulation. At 320px the cohort selector overflow was fixed and visually retested. This does not cover all screens or physical devices.
- Rolled-back synthetic SQL integration covered copy authorization, campus mismatch, drafts/deleted sources, duplicate retry and copied content. The secured copy migration is applied; no RLS policies were changed in this Teacher continuation.

## Reproduced failures fixed

- Direct copy RPC allowed actor spoofing and lacked its own authorization. Database function now checks identity, role, campus, publication and duplicate copies.
- Student attachments were absent because lightweight prefetch did not include resources. A lesson-keyed query loads them, reports errors, supports retry and avoids old lesson responses replacing the current lesson.
- Shared media handling now supports exact-host YouTube/Vimeo, direct video, audio, images, PDFs and fallback links; signed file queries are preserved. Teacher now reuses it instead of roughly one hundred lines of older media logic.
- Teacher resource reads now use the same query cache, with invalidation after successful create/delete. Explicit zero lesson duration is retained.
- Teacher flattened lessons previously interleaved modules with matching lesson positions. Shared service orders modules and lessons deterministically and groups the flattened result by module. A regression covers this, and the UI was retested 01–11.
- Teacher initially showed Access denied with incomplete QA campus membership. Completing its QA tenant mapping restored access; this was fixture setup, not evidence that isolation is secure.
- Earlier fixes include blueprint input/role guards, published visibility, missing-row deletion failures, publication controls, URL clearing and login history restoration.

## Performance evidence

- Blueprint loading changed from initial 1 + module count + lesson count requests to modules first, then descendants only on expansion. A component regression verifies request counts and cache reuse.
- Independent lookup/course-page reads run in parallel. Resource reads use a 60-second stale period and existing cache invalidation. Video uses metadata preload, images/iframes lazy loading, and videos play inline.
- Storage range checks returned HTTP 206, byte ranges, CORS and public cache headers (`asset-range-checks.json`). These checks do not establish production latency, throughput or every codec/provider.

## Failed / open

- Focused lint is **not clean**: Teacher + academic service + shared hook/media + new ordering test report 75 errors / 48 warnings (`teacher-final-lint.log`). Teacher accounts for 72 errors / 47 warnings, mostly existing any/effect/unused issues; academic service has three existing any errors, shared image has one optimization warning. Existing Admin/Student/course-console lint debt is documented in report.md. No claim of fully clean code.
- Final security pass remains mandatory: eleven delivery tables lack RLS. Also review permissive academic reads, Teacher campus-wide prefetch/course visibility versus assignment scope, remaining definer functions and advisor findings. User deferred RLS; production release stays blocked.

## Blocked / untested

- Modules 1–3 original Markdown reports were absent at the start; their deployment-limit evidence cannot be reconstructed from the supplied paths.
- Full Teacher mutation/unauthorized/cross-campus CRUD matrices, complete descendant validation and soft-deleted-ancestor creation, concurrent editors/copies, large catalogs/PostgREST limits and production timing remain open.
- Student audio/image playback after enrollment still needs its own browser check; Teacher playback does not prove the Student journey. Mobile widths beyond the Student 320px checks are not claimed.
- Encrypted/corrupt/XFA PDFs, all codecs, private/signed provider expiry, Vimeo/Drive live playback, offline/reconnect, actual iOS/Android devices, PDF form saving and accessibility audit remain untested.
- Forms currently accept resource URLs; QA storage upload used the upload script. A browser file-picker upload workflow is not established by that test.

## Retained QA data

The course, dedicated bucket and QA enrollment/teacher assignments are intentionally retained for user review; identifiers are in `live-qa-manifest.json`. Earlier rolled-back SQL fixtures remain rolled back. No passwords, tokens or keys are included in reports.

Teacher mobile PDF follow-up: the ten-page PDF reported Finished loading PDF at 320px. The final mobile CSS production build passed (`teacher-mobile-build.log`).

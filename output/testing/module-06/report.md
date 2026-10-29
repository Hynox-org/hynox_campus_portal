# Module 6 Groups and delivery

Updated 27 October 2026. Read with Module 5 report and final validation logs.

## Passed

- Admin created QA M56 Collaborative Group, selected only the authorized Test Student, enrolled it and assigned the matching program course through Brave.
- Student subsequently saw that cohort, course and lesson. Institution Admin saw its own campus roster and the QA cohort.
- Teacher cohort assignment is additive and idempotent, preserving colleagues. Rolled-back SQL exercised two teachers sharing curriculum, unauthorized writes, student campus checks, duplicate enrollment/assignment and date constraints.
- Open Admin teacher mapping drawer reflected an external QA mapping without page refresh. Teacher external curriculum changes also updated its open view.
- Student delivery regression uses 30 cohorts and verifies five batched reads, independent of cohort count, without progress writes on GET.
- Institution Admin mobile roster selector fits at 320px after the fix; roster columns remain reachable through horizontal scrolling. Admin mapping drawer was inspected at 320, 375 and 768px.

## Failures reproduced and fixed

- Late institution props displayed a campus while queries still had an empty campus ID. Derived selection now keeps displayed campus and request scope consistent.
- Course assignment picker used an unpopulated allCourses array. It now queries the selected cohort program, clears stale selection on cohort changes and handles loading/errors/retry.
- Cohort teacher mappings and local Admin arrays stayed stale. They now use observed query caches and revision invalidation.
- Delivery reads fetched broad data before filtering. Campus/cohort predicates now restrict database reads; server checks reject caller role spoofing.
- Invalid dates and program changes could strand existing assignments/enrollments. Database guards reject incompatible changes and duplicate active mappings.
- Institution analytics counted the same person in multiple cohorts as multiple students. It now counts unique users and averages their cohort progress before the campus mean; ranking uses stable user IDs. The reproduced fixture changed from three enrollment rows to two students, with 75 percent mean progress.
- Mobile roster selector overflowed at 320px. Controls now stack; visual retest passed.

## Failed or open

- Eleven delivery tables still lack RLS, as deferred by the user. Production release remains blocked.
- Existing lint errors remain in changed legacy files. The final lint log records them.

## Blocked or untested

- Real simultaneous browser sessions for two different teachers were not used; shared editing was checked with two synthetic authenticated SQL identities and one live Teacher browser.
- Production latency/load, realtime quotas, physical phones, exhaustive enrollment lifecycle and progress denominator recalculation are not certified.
- Quiz/activity analytics still need assignment-specific eligibility verification in the learning module.

## Performance and retained data

Revision-only events avoid broadcasting lesson or student records. Changes coalesce for 250 ms; visible pages check revisions every 30 seconds as recovery. These are implementation intervals, not a production latency guarantee. QA cohort/student/course/teacher mappings remain listed in Module 5 live-qa-manifest.json for review; unrelated accounts were preserved.

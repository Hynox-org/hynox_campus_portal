# Module 14 Analytics

30 October 2026. Scope: campus reports, cohort filters, rankings and Student drilldowns. Coding challenge analytics are retained as existing behaviour and are not certified in this pass.

## Trace and changes

Institution report/Student drawer → delivery and learning prefetch actions → scoped catalog, enrollment, attempt and project services → Supabase → shared learningAnalyticsScope → charts and drilldown.

1. Reports filtered attempts only by Student membership, allowing a Student shared by two cohorts to bring another cohort's results into the selected report. Results now carry the actual activity and assignment cohort, and both must match the active scope.
2. The donut/engagement denominator multiplied every Student by every campus activity while the numerator counted historical attempts. Eligibility now counts distinct assigned Student/activity pairs. A failed quiz followed by a passed retake is one passed outcome, not two occupied slots. Draft, deleted and unrelated activities/enrollments are excluded.
3. In-progress quizzes have a separate chart state and do not count as failed finalized results or enter finalized score averages. Scores use the attempt's actual point maximum. Historical forfeits still remain visible in audit counts.
4. Student drilldown now counts passed quiz outcomes, normalizes 8/8 to 100%, filters syllabus courses to the selected cohort's assignments and refreshes cached lesson progress through protected invalidation. It no longer fetches every course's lessons and an unused delivery payload before opening.
5. Removed unused per-cohort Attendance report requests from Analytics. Lesson lists load on expansion instead. Current Student rows follow refreshed enrollment data.
6. Relevant catalog, enrollment, project and quiz report reads use stable 500-row pages. IN filters are deduplicated into 100-ID groups with at most four independent reads in parallel. Any page error rejects the report instead of returning partial totals; results beyond 100,000 rows fail explicitly and require a narrower scope.

## Passed

- Existing unique-Student/equal-weight ranking regression remains in the full suite.
- New scope regressions cover a failed attempt plus passed retake, shared Students in different cohorts, draft/inactive records and in-progress outcomes.
- Paged-read regressions retrieve 1,001 rows over three pages, propagate a later-page error and enforce deduplicated 100-ID/four-request bounds.
- Anonymous REST checks confirmed the nested progress/assignment projections resolve and expose zero rows to the anonymous caller.
- Final npm test, production build, standalone types and all-changed-file lint results are recorded alongside this report. See today's consolidated report for the final counts.

## Failed then fixed

Cross-cohort result contamination, retries inflating outcomes/engagement, raw-score percentages, unused report work, broad drilldown lesson loading and silent REST truncation paths were corrected.

## Blocked and untested

N1-N8 in the manual checklist are assigned to the owner. Today's live browser Analytics views were not operated by Codex. No guarantee is made for all production load, devices, concurrent edits or compromised clients. Nine delivery tables still lack RLS; security-advisors.json records other security findings and remediation links. Production approval remains withheld.

Evidence: src/lib/learning-analytics.test.ts, src/services/query-pages.test.ts, src/app/institution/analytics-tab.test.tsx, rest-projections.log, tests-final.log, build-final.log, types-final.log and lint-final.json.

# Progress rules confirmed with the user

29 October 2026. Completion includes eligible course lessons and required learning activities assigned to the student for that course. Optional activities do not block 100 percent. The calculation must account for all eligible cohorts rather than assuming one enrollment.

Verification must distinguish passed quizzes from failed/submitted attempts, approved projects from pending/revision/rejected work and accepted coding challenges from queued/failed work. Duplicate attempts or repeated assignments must not double count an activity. Draft, archived, deleted, unrelated and inaccessible content must not inflate totals. Empty courses remain at zero. Percentages are rounded for display, while completed status requires exact completed and total counts to match.

Reproduced by code trace: syncCourseProgress uses maybeSingle on all student enrollments, ignores assignment is_required, excludes neither draft nor archived activities, suppresses errors in several evidence reads, and overwrites started_at on each update. Current dashboard reads stored totals, which can remain stale after curriculum changes. Regression and database verification are in progress; these are not yet fixed or passed cases.

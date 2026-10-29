# Activity and quiz audit in progress

29 October 2026. Findings below are reproduced by code trace or SQL fixture; they are not yet fixed or passed cases.

- Cohort-only Teacher cannot archive a mapped activity: update affects zero rows under current tenant-only learning policies. A Module 7 fixture exposed this and was changed to use Super Admin for calculation setup. Assigned Teacher access must be fixed and tested in Module 8.
- Most learning service and direct-action reads/mutations lack explicit current-user/assignment guards. Existing learning policies include tenant-wide ALL permissions and permissive reads. Scoped learning security changes are required; the broader eleven delivery-table RLS pass remains deferred.
- Activity/subclass creation and edits are multiple non-atomic requests. Question/options replacement deletes options before insertion succeeds. Need transactional operations, validation and no-data-loss retry tests.
- Quiz session response includes is_correct and correctIndex before submission. Raw option-column access must also be secured, not only the UI response.
- Quiz start uses the first assignment without student/cohort filtering, trusts supplied progress IDs and count-checks attempts without locking. Students with no enrollment are not rejected by the current start code.
- Retake approval decrements a progress counter, while start enforces the count of all historical attempts. Approval therefore does not reliably grant another attempt and is not idempotent.
- Quiz grading compares raw question points to the activity passing score without reconciling different max-score scales. Submission is not transactional/idempotent under concurrent retries, and late/read errors can leave unfinished attempts.
- Question edits after attempts begin can change grading and delete stored answer references. Need immutable attempted quizzes or versioned questions.
- Staff quiz-attempt listing overwrites attempt.max_score with activity.max_score, producing incorrect displayed percentages when question totals differ.
- Standalone judge worker uses anonymous credentials; runner progress recalculation depends on HTTP cookies. Need explicit server-only worker credentials and a verified worker progress path without exposing keys.
- Student course sidebar computed a lesson-only percentage. That issue is fixed in Module 7 and its regression now passes; required activities are shown separately there.

Next implementation: shared activity/child ownership helpers; runtime input validation; transactional activity/question/assignment operations; guarded learning RLS and answer-key projection; atomic attempts, submission and retake credits; live cache invalidation; focused lint/types/tests/build; rolled-back SQL fixtures. Manual Brave verification follows code and database verification.

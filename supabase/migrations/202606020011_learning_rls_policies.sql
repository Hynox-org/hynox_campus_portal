-- Migration: Learning Schema RLS Policies
-- Path: supabase/migrations/202606020011_learning_rls_policies.sql

-- 1. Lookups: SELECT for authenticated, ALL for super_admin
CREATE POLICY select_activity_types ON learning.activity_types FOR SELECT TO authenticated USING (true);
CREATE POLICY select_activity_statuses ON learning.activity_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY select_programming_languages ON learning.programming_languages FOR SELECT TO authenticated USING (true);
CREATE POLICY select_challenge_submission_statuses ON learning.challenge_submission_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY select_student_activity_statuses ON learning.student_activity_statuses FOR SELECT TO authenticated USING (true);

-- 2. Core Activities Table
CREATE POLICY activities_policy ON learning.activities
FOR ALL
TO authenticated
USING (
  tenant_id = (SELECT users.tenant_id FROM core.users WHERE users.auth_user_id = auth.uid() AND users.deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles))
);

-- 3. Quizzes
CREATE POLICY quizzes_policy ON learning.quizzes
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.activities a WHERE a.id = activity_id)
);

-- 4. Quiz Questions
CREATE POLICY quiz_questions_policy ON learning.quiz_questions
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.quizzes q WHERE q.id = quiz_id)
);

-- 5. Quiz Options
CREATE POLICY quiz_options_policy ON learning.quiz_options
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.quiz_questions qq WHERE qq.id = question_id)
);

-- 6. Quiz Attempts
CREATE POLICY quiz_attempts_policy ON learning.quiz_attempts
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.quizzes q WHERE q.id = quiz_id)
);

-- 7. Quiz Answers
CREATE POLICY quiz_answers_policy ON learning.quiz_answers
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.quiz_attempts qa WHERE qa.id = attempt_id)
);

-- 8. Projects
CREATE POLICY projects_policy ON learning.projects
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.activities a WHERE a.id = activity_id)
);

-- 9. Project Submissions
CREATE POLICY project_submissions_policy ON learning.project_submissions
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.projects p WHERE p.id = project_id)
);

-- 10. Project Reviews
CREATE POLICY project_reviews_policy ON learning.project_reviews
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.project_submissions ps WHERE ps.id = submission_id)
);

-- 11. Programming Challenges
CREATE POLICY programming_challenges_policy ON learning.programming_challenges
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.activities a WHERE a.id = activity_id)
);

-- 12. Challenge Examples
CREATE POLICY challenge_examples_policy ON learning.challenge_examples
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.programming_challenges pc WHERE pc.id = challenge_id)
);

-- 13. Challenge Test Cases
CREATE POLICY challenge_test_cases_policy ON learning.challenge_test_cases
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.programming_challenges pc WHERE pc.id = challenge_id)
);

-- 14. Challenge Submissions
CREATE POLICY challenge_submissions_policy ON learning.challenge_submissions
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.programming_challenges pc WHERE pc.id = challenge_id)
);

-- 15. Challenge Submission Results
CREATE POLICY challenge_submission_results_policy ON learning.challenge_submission_results
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.challenge_submissions cs WHERE cs.id = submission_id)
);

-- 16. Challenge Test Case Results
CREATE POLICY challenge_test_case_results_policy ON learning.challenge_test_case_results
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.challenge_submissions cs WHERE cs.id = submission_id)
);

-- 17. Challenge Execution Queue
CREATE POLICY challenge_execution_queue_policy ON learning.challenge_execution_queue
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.challenge_submissions cs WHERE cs.id = submission_id)
);

-- 18. Challenge Execution Logs
CREATE POLICY challenge_execution_logs_policy ON learning.challenge_execution_logs
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.challenge_submissions cs WHERE cs.id = submission_id)
);

-- 19. Activity Assignments
CREATE POLICY activity_assignments_policy ON learning.activity_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.activities a WHERE a.id = activity_id)
);

-- 20. Student Activity Progress
CREATE POLICY student_activity_progress_policy ON learning.student_activity_progress
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM learning.activities a WHERE a.id = activity_id)
);

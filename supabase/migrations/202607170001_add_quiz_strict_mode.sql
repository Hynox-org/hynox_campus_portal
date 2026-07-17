-- Adds proctored/lockdown mode support for quizzes: an admin-configurable
-- strict_mode flag on quizzes, and forfeiture tracking on quiz_attempts for
-- attempts that are zeroed out due to leaving the quiz environment
-- (fullscreen exit, tab switch, back navigation) instead of a normal submit.

ALTER TABLE learning.quizzes
  ADD COLUMN strict_mode boolean NOT NULL DEFAULT false;

ALTER TABLE learning.quizzes
  ADD CONSTRAINT quizzes_strict_mode_requires_time_limit
  CHECK (NOT strict_mode OR time_limit_minutes IS NOT NULL);

ALTER TABLE learning.quiz_attempts
  ADD COLUMN forfeited boolean NOT NULL DEFAULT false,
  ADD COLUMN forfeit_reason text,
  ADD COLUMN violation_count integer NOT NULL DEFAULT 0;

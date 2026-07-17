-- Adds proctored/lockdown mode support for programming challenges (mirrors
-- 202607170001_add_quiz_strict_mode.sql), and per-language starter code
-- templates so the LeetCode-style IDE can offer a correct starter snippet
-- for whichever of the 6 supported languages the student picks.
--
-- Forfeiture is tracked on learning.student_activity_progress rather than
-- challenge_submissions: unlike a quiz_attempts row (created the moment a
-- quiz starts), a challenge_submissions row only exists once the student
-- clicks Submit, so it can't represent an in-progress lockdown violation.
-- student_activity_progress exists for the whole session and already backs
-- other activity types, so it's the correct home for this.

ALTER TABLE learning.programming_challenges
  ADD COLUMN strict_mode boolean NOT NULL DEFAULT false;

ALTER TABLE learning.student_activity_progress
  ADD COLUMN forfeited boolean NOT NULL DEFAULT false,
  ADD COLUMN forfeit_reason text,
  ADD COLUMN violation_count integer NOT NULL DEFAULT 0;

CREATE TABLE learning.challenge_starter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES learning.programming_challenges(id) ON DELETE CASCADE,
    language TEXT NOT NULL REFERENCES learning.programming_languages(code) ON UPDATE CASCADE,
    starter_code TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (challenge_id, language)
);

CREATE INDEX idx_challenge_starter_templates_challenge_id ON learning.challenge_starter_templates(challenge_id);

ALTER TABLE learning.challenge_starter_templates ENABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON learning.challenge_starter_templates TO postgres, service_role, authenticated, anon;

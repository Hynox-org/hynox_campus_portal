-- Migration: Create Quiz Attempts and Answers Tables
-- Path: supabase/migrations/202606020005_create_quiz_attempts.sql

-- 1. Create Table: learning.quiz_attempts
CREATE TABLE learning.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES learning.quizzes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    student_activity_progress_id UUID NOT NULL REFERENCES learning.student_activity_progress(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    score NUMERIC(6,2),
    max_score NUMERIC(6,2),
    passed BOOLEAN,
    time_spent_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Table: learning.quiz_answers
CREATE TABLE learning.quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES learning.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES learning.quiz_questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES learning.quiz_options(id) ON DELETE SET NULL,
    answer_text TEXT,
    is_correct BOOLEAN,
    points_awarded NUMERIC(6,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uidx_quiz_answers_attempt_question UNIQUE(attempt_id, question_id)
);

-- 3. Create Indexes
CREATE INDEX idx_quiz_attempts_quiz_id ON learning.quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_student_id ON learning.quiz_attempts(student_id);
CREATE INDEX idx_quiz_answers_attempt_id ON learning.quiz_answers(attempt_id);
CREATE INDEX idx_quiz_answers_question_id ON learning.quiz_answers(question_id);

-- 4. Enable RLS
ALTER TABLE learning.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.quiz_answers ENABLE ROW LEVEL SECURITY;

-- 5. Grant Permissions
GRANT ALL PRIVILEGES ON learning.quiz_attempts TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.quiz_answers TO postgres, service_role, authenticated, anon;

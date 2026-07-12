-- Migration: Create Quiz Engine Foundation
-- Path: supabase/migrations/202606020004_create_quiz_foundation.sql

-- 1. Create Table: learning.quizzes
CREATE TABLE learning.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL UNIQUE REFERENCES learning.activities(id) ON DELETE CASCADE,
    time_limit_minutes INTEGER,
    max_attempts INTEGER DEFAULT 1,
    shuffle_questions BOOLEAN DEFAULT false,
    shuffle_options BOOLEAN DEFAULT false,
    show_results_immediately BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Table: learning.quiz_questions
CREATE TABLE learning.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES learning.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
    points NUMERIC(6,2) DEFAULT 1,
    position INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Table: learning.quiz_options
CREATE TABLE learning.quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES learning.quiz_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Indexes
CREATE INDEX idx_quiz_questions_quiz_id ON learning.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_options_question_id ON learning.quiz_options(question_id);
CREATE INDEX idx_quiz_questions_position ON learning.quiz_questions(position);
CREATE INDEX idx_quiz_options_position ON learning.quiz_options(position);

-- 5. Enable RLS
ALTER TABLE learning.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.quiz_options ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions
GRANT ALL PRIVILEGES ON learning.quizzes TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.quiz_questions TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.quiz_options TO postgres, service_role, authenticated, anon;

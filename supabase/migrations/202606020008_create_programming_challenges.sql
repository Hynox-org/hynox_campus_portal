-- Migration: Create Programming Challenges Definition Layer
-- Path: supabase/migrations/202606020008_create_programming_challenges.sql

-- 1. Create Table: learning.programming_challenges
CREATE TABLE learning.programming_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL UNIQUE REFERENCES learning.activities(id) ON DELETE CASCADE,
    difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    problem_statement TEXT NOT NULL,
    input_format TEXT,
    output_format TEXT,
    constraints_text TEXT,
    starter_code TEXT,
    time_limit_ms INTEGER DEFAULT 1000,
    memory_limit_mb INTEGER DEFAULT 256,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Table: learning.challenge_examples
CREATE TABLE learning.challenge_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES learning.programming_challenges(id) ON DELETE CASCADE,
    example_number INTEGER NOT NULL,
    input_example TEXT NOT NULL,
    output_example TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Table: learning.challenge_test_cases
CREATE TABLE learning.challenge_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES learning.programming_challenges(id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Indexes
CREATE INDEX idx_challenge_examples_challenge_id ON learning.challenge_examples(challenge_id);
CREATE INDEX idx_challenge_test_cases_challenge_id ON learning.challenge_test_cases(challenge_id);
CREATE INDEX idx_challenge_test_cases_is_hidden ON learning.challenge_test_cases(is_hidden);

-- 5. Enable RLS
ALTER TABLE learning.programming_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_test_cases ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions
GRANT ALL PRIVILEGES ON learning.programming_challenges TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_examples TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_test_cases TO postgres, service_role, authenticated, anon;

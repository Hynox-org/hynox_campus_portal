-- Migration: Create Challenge Submissions Architecture
-- Path: supabase/migrations/202606020009_create_challenge_submissions.sql

-- 1. Create Lookup Table: learning.challenge_submission_statuses
CREATE TABLE learning.challenge_submission_statuses (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

-- Seed learning.challenge_submission_statuses
INSERT INTO learning.challenge_submission_statuses (code, description) VALUES
('pending', 'Submission is queued for grading'),
('running', 'Submission is currently running tests'),
('accepted', 'Code passed all test cases successfully'),
('wrong_answer', 'Code generated output mismatching expected output on test cases'),
('runtime_error', 'Code crashed or encountered exception during execution'),
('compile_error', 'Code failed to compile/transpile'),
('time_limit_exceeded', 'Code execution duration exceeded the allocated time limit'),
('memory_limit_exceeded', 'Code memory allocation exceeded the allocated memory limit')
ON CONFLICT (code) DO NOTHING;

-- 2. Create Table: learning.challenge_submissions
CREATE TABLE learning.challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES learning.programming_challenges(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    student_activity_progress_id UUID NOT NULL REFERENCES learning.student_activity_progress(id) ON DELETE CASCADE,
    language TEXT NOT NULL CHECK (language IN ('javascript', 'typescript', 'python', 'java', 'c', 'cpp')),
    source_code TEXT NOT NULL,
    submission_status_code TEXT NOT NULL DEFAULT 'pending' REFERENCES learning.challenge_submission_statuses(code),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Table: learning.challenge_submission_results
CREATE TABLE learning.challenge_submission_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE REFERENCES learning.challenge_submissions(id) ON DELETE CASCADE,
    total_test_cases INTEGER DEFAULT 0,
    passed_test_cases INTEGER DEFAULT 0,
    failed_test_cases INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    memory_used_kb INTEGER,
    score NUMERIC(6,2),
    result_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Table: learning.challenge_test_case_results
CREATE TABLE learning.challenge_test_case_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES learning.challenge_submissions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES learning.challenge_test_cases(id) ON DELETE CASCADE,
    passed BOOLEAN,
    actual_output TEXT,
    expected_output TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create Indexes
CREATE INDEX idx_challenge_submissions_challenge_id ON learning.challenge_submissions(challenge_id);
CREATE INDEX idx_challenge_submissions_student_id ON learning.challenge_submissions(student_id);
CREATE INDEX idx_challenge_submissions_status_code ON learning.challenge_submissions(submission_status_code);
CREATE INDEX idx_challenge_submission_results_submission_id ON learning.challenge_submission_results(submission_id);
CREATE INDEX idx_challenge_test_case_results_submission_id ON learning.challenge_test_case_results(submission_id);

-- 6. Enable RLS
ALTER TABLE learning.challenge_submission_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_submission_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_test_case_results ENABLE ROW LEVEL SECURITY;

-- 7. Grant Permissions
GRANT ALL PRIVILEGES ON learning.challenge_submission_statuses TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_submissions TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_submission_results TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_test_case_results TO postgres, service_role, authenticated, anon;

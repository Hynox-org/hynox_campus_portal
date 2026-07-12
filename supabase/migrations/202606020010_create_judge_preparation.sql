-- Migration: Create Judge Engine Preparation Layer
-- Path: supabase/migrations/202606020010_create_judge_preparation.sql

-- 1. Create Lookup Table: learning.programming_languages
CREATE TABLE learning.programming_languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed learning.programming_languages
INSERT INTO learning.programming_languages (code, name, version) VALUES
('javascript', 'JavaScript', 'Node.js 22'),
('typescript', 'TypeScript', 'tsc / Node.js 22'),
('python', 'Python', 'Python 3.12'),
('java', 'Java', 'OpenJDK 21'),
('c', 'C', 'GCC 13'),
('cpp', 'C++', 'GCC 13')
ON CONFLICT (code) DO NOTHING;

-- Tie existing challenge_submissions.language to programming_languages lookup table
ALTER TABLE learning.challenge_submissions
    ADD CONSTRAINT fk_challenge_submissions_language
    FOREIGN KEY (language)
    REFERENCES learning.programming_languages(code)
    ON UPDATE CASCADE;

-- 2. Create Table: learning.challenge_execution_queue
CREATE TABLE learning.challenge_execution_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE REFERENCES learning.challenge_submissions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Table: learning.challenge_execution_logs
CREATE TABLE learning.challenge_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES learning.challenge_submissions(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN ('compile', 'runtime', 'system')),
    log_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Indexes
CREATE INDEX idx_challenge_execution_queue_status ON learning.challenge_execution_queue(status);
CREATE INDEX idx_challenge_execution_queue_created_at ON learning.challenge_execution_queue(created_at);
CREATE INDEX idx_challenge_execution_logs_submission_id ON learning.challenge_execution_logs(submission_id);

-- 5. Enable RLS
ALTER TABLE learning.programming_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_execution_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.challenge_execution_logs ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions
GRANT ALL PRIVILEGES ON learning.programming_languages TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_execution_queue TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.challenge_execution_logs TO postgres, service_role, authenticated, anon;

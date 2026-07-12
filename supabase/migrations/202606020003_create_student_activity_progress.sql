-- Migration: Create Student Activity Progress Table and Statuses
-- Path: supabase/migrations/202606020003_create_student_activity_progress.sql

-- 1. Create Lookup Table: learning.student_activity_statuses
CREATE TABLE learning.student_activity_statuses (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed learning.student_activity_statuses
INSERT INTO learning.student_activity_statuses (code, name, description) VALUES
('assigned', 'Assigned', 'Activity is assigned to the student'),
('started', 'Started', 'Student has started the activity'),
('submitted', 'Submitted', 'Student has submitted their work'),
('completed', 'Completed', 'Student has successfully completed the activity'),
('review_pending', 'Review Pending', 'Submission is awaiting instructor review'),
('reviewed', 'Reviewed', 'Submission has been reviewed by an instructor'),
('failed', 'Failed', 'Student did not meet the completion criteria')
ON CONFLICT (code) DO NOTHING;

-- 2. Create Table: learning.student_activity_progress
CREATE TABLE learning.student_activity_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning.activities(id) ON DELETE CASCADE,
    activity_assignment_id UUID NOT NULL REFERENCES learning.activity_assignments(id) ON DELETE CASCADE,
    status_code TEXT NOT NULL DEFAULT 'assigned' REFERENCES learning.student_activity_statuses(code),
    score NUMERIC(6,2),
    max_score NUMERIC(6,2),
    attempt_number INTEGER DEFAULT 1,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uidx_student_activity_progress_student_assignment UNIQUE(student_id, activity_assignment_id)
);

-- 3. Create Indexes
CREATE INDEX idx_student_activity_progress_student_id ON learning.student_activity_progress(student_id);
CREATE INDEX idx_student_activity_progress_activity_id ON learning.student_activity_progress(activity_id);
CREATE INDEX idx_student_activity_progress_assignment_id ON learning.student_activity_progress(activity_assignment_id);
CREATE INDEX idx_student_activity_progress_status_code ON learning.student_activity_progress(status_code);
CREATE INDEX idx_student_activity_progress_completed_at ON learning.student_activity_progress(completed_at);
CREATE INDEX idx_student_activity_progress_deleted_at ON learning.student_activity_progress(deleted_at);

-- 4. Enable RLS
ALTER TABLE learning.student_activity_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.student_activity_progress ENABLE ROW LEVEL SECURITY;

-- 5. Grant Permissions
GRANT ALL PRIVILEGES ON learning.student_activity_statuses TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.student_activity_progress TO postgres, service_role, authenticated, anon;

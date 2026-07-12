-- Migration: Create Projects Architecture Tables
-- Path: supabase/migrations/202606020006_create_projects_architecture.sql

-- 1. Create Table: learning.projects
CREATE TABLE learning.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL UNIQUE REFERENCES learning.activities(id) ON DELETE CASCADE,
    project_overview TEXT NOT NULL,
    requirements TEXT,
    deliverables TEXT,
    submission_instructions TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_hours INTEGER,
    max_score NUMERIC(6,2) DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Table: learning.project_submissions
CREATE TABLE learning.project_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES learning.projects(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    student_activity_progress_id UUID NOT NULL REFERENCES learning.student_activity_progress(id) ON DELETE CASCADE,
    github_url TEXT NOT NULL,
    submission_notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uidx_project_submissions_project_student UNIQUE(project_id, student_id)
);

-- 3. Create Table: learning.project_reviews
CREATE TABLE learning.project_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE REFERENCES learning.project_submissions(id) ON DELETE CASCADE,
    reviewed_by UUID NOT NULL REFERENCES core.users(id) ON DELETE SET NULL,
    score NUMERIC(6,2),
    feedback TEXT,
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'revision_requested')),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Indexes
CREATE INDEX idx_projects_activity_id ON learning.projects(activity_id);
CREATE INDEX idx_project_submissions_project_id ON learning.project_submissions(project_id);
CREATE INDEX idx_project_submissions_student_id ON learning.project_submissions(student_id);
CREATE INDEX idx_project_submissions_progress_id ON learning.project_submissions(student_activity_progress_id);
CREATE INDEX idx_project_reviews_submission_id ON learning.project_reviews(submission_id);
CREATE INDEX idx_project_reviews_reviewed_by ON learning.project_reviews(reviewed_by);

-- 5. Enable RLS
ALTER TABLE learning.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.project_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.project_reviews ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions
GRANT ALL PRIVILEGES ON learning.projects TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.project_submissions TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON learning.project_reviews TO postgres, service_role, authenticated, anon;

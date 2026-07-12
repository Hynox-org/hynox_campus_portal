-- Migration: Create Course Progress Table
-- Path: supabase/migrations/202606010008_create_course_progress_table.sql

-- 1. Create course_progress Table
CREATE TABLE delivery.course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
    status_code TEXT NOT NULL DEFAULT 'not_started' REFERENCES delivery.progress_statuses(code),
    completed_lessons INTEGER NOT NULL DEFAULT 0 CHECK (completed_lessons >= 0),
    total_lessons INTEGER NOT NULL DEFAULT 0 CHECK (total_lessons >= 0),
    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uidx_course_progress_user_course UNIQUE (user_id, course_id)
);

-- 2. Create Indexes
CREATE INDEX idx_course_progress_user_id ON delivery.course_progress (user_id);
CREATE INDEX idx_course_progress_course_id ON delivery.course_progress (course_id);
CREATE INDEX idx_course_progress_status_code ON delivery.course_progress (status_code);
CREATE INDEX idx_course_progress_last_accessed ON delivery.course_progress (last_accessed_at);

-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.course_progress TO postgres, service_role, authenticated, anon;

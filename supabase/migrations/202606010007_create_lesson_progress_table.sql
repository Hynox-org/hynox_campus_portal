-- Migration: Create Lesson Progress Table
-- Path: supabase/migrations/202606010007_create_lesson_progress_table.sql

-- 1. Create lesson_progress Table
CREATE TABLE delivery.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES academic.lessons(id) ON DELETE CASCADE,
    status_code TEXT NOT NULL DEFAULT 'not_started' REFERENCES delivery.progress_statuses(code),
    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uidx_lesson_progress_user_lesson UNIQUE (user_id, lesson_id)
);

-- 2. Create Indexes
CREATE INDEX idx_lesson_progress_user_id ON delivery.lesson_progress (user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON delivery.lesson_progress (lesson_id);
CREATE INDEX idx_lesson_progress_status_code ON delivery.lesson_progress (status_code);
CREATE INDEX idx_lesson_progress_last_accessed ON delivery.lesson_progress (last_accessed_at);

-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.lesson_progress TO postgres, service_role, authenticated, anon;

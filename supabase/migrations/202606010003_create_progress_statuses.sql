-- Migration: Create Progress Statuses
-- Path: supabase/migrations/202606010003_create_progress_statuses.sql

-- 1. Create progress_statuses Lookup Table
CREATE TABLE delivery.progress_statuses (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

-- 2. Seed progress_statuses Table
INSERT INTO delivery.progress_statuses (code, description) VALUES
('not_started', 'Student has not started the lesson/course'),
('in_progress', 'Student has started but not completed'),
('completed', 'Student successfully completed')
ON CONFLICT (code) DO NOTHING;

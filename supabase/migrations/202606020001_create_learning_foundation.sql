-- Migration: Create Learning Schema Foundation
-- Path: supabase/migrations/202606020001_create_learning_foundation.sql

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS learning;

-- 2. Grant Permissions
GRANT USAGE ON SCHEMA learning TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA learning TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA learning TO postgres, service_role, authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA learning GRANT ALL ON TABLES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA learning GRANT ALL ON SEQUENCES TO postgres, service_role, authenticated, anon;

-- 3. Create Lookup Table: learning.activity_types
CREATE TABLE learning.activity_types (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed learning.activity_types
INSERT INTO learning.activity_types (code, name, description) VALUES
('quiz', 'Quiz', 'Interactive questionnaire with multiple choice, true/false, or other question formats'),
('project', 'Project', 'Practical, hands-on project assignment requiring file or link submissions'),
('programming', 'Programming Challenge', 'Coding challenge with automated test cases and grading'),
('assignment', 'Assignment', 'General academic assignment or written response task')
ON CONFLICT (code) DO NOTHING;

-- 4. Create Lookup Table: learning.activity_statuses
CREATE TABLE learning.activity_statuses (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed learning.activity_statuses
INSERT INTO learning.activity_statuses (code, name, description) VALUES
('draft', 'Draft', 'Activity is in draft status and not visible to students'),
('published', 'Published', 'Activity is published and active'),
('archived', 'Archived', 'Activity is archived and no longer active')
ON CONFLICT (code) DO NOTHING;

-- 5. Create Core Table: learning.activities
CREATE TABLE learning.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES academic.lessons(id) ON DELETE CASCADE,
    activity_type_code TEXT NOT NULL REFERENCES learning.activity_types(code),
    status_code TEXT NOT NULL DEFAULT 'draft' REFERENCES learning.activity_statuses(code),
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    max_score INTEGER DEFAULT 100,
    passing_score INTEGER DEFAULT 0,
    position INTEGER DEFAULT 1,
    is_mandatory BOOLEAN DEFAULT true,
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 6. Create Indexes
CREATE INDEX idx_activities_tenant_id ON learning.activities(tenant_id);
CREATE INDEX idx_activities_institution_id ON learning.activities(institution_id);
CREATE INDEX idx_activities_lesson_id ON learning.activities(lesson_id);
CREATE INDEX idx_activities_type_code ON learning.activities(activity_type_code);
CREATE INDEX idx_activities_status_code ON learning.activities(status_code);
CREATE INDEX idx_activities_deleted_at ON learning.activities(deleted_at);

-- 7. Enable RLS
ALTER TABLE learning.activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.activity_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.activities ENABLE ROW LEVEL SECURITY;

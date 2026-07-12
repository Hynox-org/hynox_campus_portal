-- Migration: Create Course Assignments Table
-- Path: supabase/migrations/202606010006_create_course_assignments_table.sql

-- 1. Create course_assignments Table
CREATE TABLE delivery.course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES delivery.cohorts(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
    start_date DATE,
    due_date DATE,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Create Constraints and Indexes
CREATE UNIQUE INDEX uidx_course_assignments_cohort_course ON delivery.course_assignments (cohort_id, course_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_course_assignments_cohort_id ON delivery.course_assignments (cohort_id);
CREATE INDEX idx_course_assignments_course_id ON delivery.course_assignments (course_id);
CREATE INDEX idx_course_assignments_created_at ON delivery.course_assignments (created_at);

-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.course_assignments TO postgres, service_role, authenticated, anon;

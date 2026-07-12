-- Migration: Create Enrollments Table
-- Path: supabase/migrations/202606010005_create_enrollments_table.sql

-- 1. Create enrollments Table
CREATE TABLE delivery.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES delivery.cohorts(id) ON DELETE CASCADE,
    status_code TEXT NOT NULL REFERENCES delivery.enrollment_statuses(code),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Create Constraints and Indexes
CREATE UNIQUE INDEX uidx_enrollments_user_cohort ON delivery.enrollments (user_id, cohort_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_enrollments_user_id ON delivery.enrollments (user_id);
CREATE INDEX idx_enrollments_cohort_id ON delivery.enrollments (cohort_id);
CREATE INDEX idx_enrollments_status_code ON delivery.enrollments (status_code);
CREATE INDEX idx_enrollments_created_at ON delivery.enrollments (created_at);

-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.enrollments TO postgres, service_role, authenticated, anon;

-- Migration: Create Activity Assignments Table
-- Path: supabase/migrations/202606020002_create_activity_assignments.sql

-- 1. Create Table: learning.activity_assignments
CREATE TABLE learning.activity_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning.activities(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES delivery.cohorts(id) ON DELETE CASCADE,
    is_required BOOLEAN NOT NULL DEFAULT true,
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uidx_activity_assignments_activity_cohort UNIQUE(activity_id, cohort_id)
);

-- 2. Create Indexes
CREATE INDEX idx_activity_assignments_activity_id ON learning.activity_assignments(activity_id);
CREATE INDEX idx_activity_assignments_cohort_id ON learning.activity_assignments(cohort_id);
CREATE INDEX idx_activity_assignments_available_from ON learning.activity_assignments(available_from);
CREATE INDEX idx_activity_assignments_available_until ON learning.activity_assignments(available_until);
CREATE INDEX idx_activity_assignments_deleted_at ON learning.activity_assignments(deleted_at);

-- 3. Enable RLS
ALTER TABLE learning.activity_assignments ENABLE ROW LEVEL SECURITY;

-- 4. Grant Permissions
GRANT ALL PRIVILEGES ON learning.activity_assignments TO postgres, service_role, authenticated, anon;

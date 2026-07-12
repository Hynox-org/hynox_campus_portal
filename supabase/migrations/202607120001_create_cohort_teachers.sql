-- Migration: Create Cohort Teachers Mapping Table
-- Path: supabase/migrations/202607120001_create_cohort_teachers.sql

-- 1. Create cohort_teachers Table
CREATE TABLE IF NOT EXISTS delivery.cohort_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES delivery.cohorts(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uidx_cohort_teachers UNIQUE (cohort_id, teacher_id)
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS idx_cohort_teachers_cohort ON delivery.cohort_teachers(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_teachers_teacher ON delivery.cohort_teachers(teacher_id);

-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.cohort_teachers TO postgres, service_role, authenticated, anon;

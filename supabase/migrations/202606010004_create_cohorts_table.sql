-- Migration: Create Cohorts Table
-- Path: supabase/migrations/202606010004_create_cohorts_table.sql

-- 1. Create cohorts Table
CREATE TABLE delivery.cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institution.institutions(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES academic.programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status_code TEXT NOT NULL REFERENCES delivery.cohort_statuses(code),
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Create Constraints and Indexes
CREATE UNIQUE INDEX uidx_cohorts_institution_code ON delivery.cohorts (institution_id, code) WHERE deleted_at IS NULL;

CREATE INDEX idx_cohorts_program_id ON delivery.cohorts (program_id);
CREATE INDEX idx_cohorts_institution_id ON delivery.cohorts (institution_id);
CREATE INDEX idx_cohorts_tenant_id ON delivery.cohorts (tenant_id);
CREATE INDEX idx_cohorts_code ON delivery.cohorts (code);
CREATE INDEX idx_cohorts_status_code ON delivery.cohorts (status_code);

-- 3. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.cohorts TO postgres, service_role, authenticated, anon;

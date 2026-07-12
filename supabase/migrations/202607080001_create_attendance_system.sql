-- Migration: Create Attendance Tables
-- Path: supabase/migrations/202607080001_create_attendance_system.sql

-- 1. Create attendance_sessions Table
CREATE TABLE delivery.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES delivery.cohorts(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    holiday_name TEXT,
    marked_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Create attendance_records Table
CREATE TABLE delivery.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES delivery.attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 3. Create Constraints and Indexes
CREATE UNIQUE INDEX uidx_attendance_sessions_cohort_date ON delivery.attendance_sessions (cohort_id, session_date) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uidx_attendance_records_session_student ON delivery.attendance_records (session_id, student_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_attendance_sessions_cohort ON delivery.attendance_sessions (cohort_id);
CREATE INDEX idx_attendance_records_session ON delivery.attendance_records (session_id);
CREATE INDEX idx_attendance_records_student ON delivery.attendance_records (student_id);

-- 4. Grant Permissions
GRANT ALL PRIVILEGES ON delivery.attendance_sessions TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON delivery.attendance_records TO postgres, service_role, authenticated, anon;

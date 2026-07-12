-- Migration: Create Enrollment Statuses
-- Path: supabase/migrations/202606010002_create_enrollment_statuses.sql

-- 1. Create enrollment_statuses Lookup Table
CREATE TABLE delivery.enrollment_statuses (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

-- 2. Seed enrollment_statuses Table
INSERT INTO delivery.enrollment_statuses (code, description) VALUES
('active', 'Student is actively enrolled'),
('completed', 'Student completed the cohort/program'),
('suspended', 'Student access temporarily disabled'),
('withdrawn', 'Student voluntarily left the cohort')
ON CONFLICT (code) DO NOTHING;

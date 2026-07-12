-- Migration: Create Delivery Schema and Cohort Statuses
-- Path: supabase/migrations/202606010001_create_delivery_schema.sql

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS delivery;

-- 2. Grant Permissions
GRANT USAGE ON SCHEMA delivery TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA delivery TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA delivery TO postgres, service_role, authenticated, anon;

-- 3. Create cohort_statuses Lookup Table
CREATE TABLE delivery.cohort_statuses (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

-- 4. Seed cohort_statuses Table
INSERT INTO delivery.cohort_statuses (code, description) VALUES
('active', 'Cohort currently running'),
('inactive', 'Cohort temporarily disabled'),
('completed', 'Cohort finished successfully'),
('archived', 'Historical cohort retained for records')
ON CONFLICT (code) DO NOTHING;

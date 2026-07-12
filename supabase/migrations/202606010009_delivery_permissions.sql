-- Migration: Grant Delivery Schema Permissions and Default Privileges
-- Path: supabase/migrations/202606010009_delivery_permissions.sql

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA delivery TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA delivery TO postgres, service_role, authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA delivery GRANT ALL ON TABLES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA delivery GRANT ALL ON SEQUENCES TO postgres, service_role, authenticated, anon;

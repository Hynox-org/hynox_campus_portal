-- Authentication catalogs are client-readable configuration, not client-managed permissions.
SET lock_timeout = '5s';
DO $catalogs$
DECLARE catalog text;
BEGIN
  FOREACH catalog IN ARRAY ARRAY['user_statuses','onboarding_sources','role_permissions','permissions','invitation_statuses','invitation_types'] LOOP
    EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',catalog);
    EXECUTE format('REVOKE ALL ON core.%I FROM anon, authenticated',catalog);
    EXECUTE format('GRANT SELECT ON core.%I TO anon, authenticated',catalog);
    EXECUTE format('CREATE POLICY auth_catalog_read ON core.%I FOR SELECT TO anon, authenticated USING (true)',catalog);
  END LOOP;
END;
$catalogs$;
ALTER FUNCTION core.get_user_tenant_id(uuid) SET search_path = core, pg_catalog;
REVOKE EXECUTE ON FUNCTION core.get_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION core.get_current_user() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
DO $checks$
DECLARE catalog text;
BEGIN
  FOREACH catalog IN ARRAY ARRAY['user_statuses','onboarding_sources','role_permissions','permissions','invitation_statuses','invitation_types'] LOOP
    ASSERT NOT has_table_privilege('anon','core.'||catalog,'UPDATE'), 'Anonymous catalog mutation';
    ASSERT NOT has_table_privilege('authenticated','core.'||catalog,'TRUNCATE'), 'Authenticated catalog truncate';
    ASSERT has_table_privilege('authenticated','core.'||catalog,'SELECT'), 'Catalog read regression';
  END LOOP;
END;
$checks$;

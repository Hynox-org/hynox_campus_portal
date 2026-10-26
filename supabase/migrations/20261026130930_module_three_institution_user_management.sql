-- Module 03: institution boundaries, safe deletion and administrator lockout protection.
SET lock_timeout='5s';
REVOKE ALL ON institution.institutions,institution.institution_admins FROM anon;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON institution.institutions,institution.institution_admins FROM authenticated;
ALTER POLICY institutions_update ON institution.institutions
  USING(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)))
  WITH CHECK(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)));
ALTER POLICY institution_admins_insert ON institution.institution_admins
  WITH CHECK(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)));
ALTER POLICY institution_admins_update ON institution.institution_admins
  USING(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)))
  WITH CHECK(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)));
ALTER POLICY institution_admins_delete ON institution.institution_admins
  USING(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)));
ALTER POLICY users_delete ON core.users
  USING(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)));
DO $catalogs$ DECLARE catalog text; BEGIN
  FOREACH catalog IN ARRAY ARRAY['institution_types','institution_statuses'] LOOP
    EXECUTE format('ALTER TABLE institution.%I ENABLE ROW LEVEL SECURITY',catalog);
    EXECUTE format('REVOKE ALL ON institution.%I FROM anon,authenticated',catalog);
    EXECUTE format('GRANT SELECT ON institution.%I TO anon,authenticated',catalog);
    EXECUTE format('CREATE POLICY institution_catalog_read ON institution.%I FOR SELECT TO anon,authenticated USING(true)',catalog);
  END LOOP;
END; $catalogs$;
CREATE UNIQUE INDEX institutions_code_case_unique ON institution.institutions(lower(institution_code));
ALTER TABLE institution.institutions
  ADD CONSTRAINT institution_name_valid CHECK(length(btrim(name)) BETWEEN 1 AND 160 AND name !~ '[[:cntrl:]]'),
  ADD CONSTRAINT institution_code_valid CHECK(institution_code ~ '^[A-Za-z0-9_-]{1,64}$'),
  ADD CONSTRAINT institution_contact_lengths CHECK(
    coalesce(length(email),0)<=254 AND coalesce(length(phone),0)<=40 AND coalesce(length(address),0)<=2000
    AND coalesce(length(website),0)<=2048 AND coalesce(length(logo_url),0)<=2048),
  ADD CONSTRAINT institution_website_protocol CHECK(website IS NULL OR website ~* '^https?://[^[:space:]]+$'),
  ADD CONSTRAINT institution_logo_protocol CHECK(logo_url IS NULL OR logo_url ~* '^https?://[^[:space:]]+$');

CREATE FUNCTION core.protect_super_admin_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
DECLARE target uuid; identity_id uuid; removing boolean:=false;
BEGIN
  IF TG_TABLE_NAME='users' THEN
    target:=OLD.id; identity_id:=OLD.auth_user_id;
    IF TG_OP='DELETE' THEN removing:=true;
    ELSE removing:=OLD.status='active' AND (NEW.status<>'active' OR NEW.deleted_at IS NOT NULL OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id); END IF;
  ELSE
    target:=OLD.user_id;
    IF NOT EXISTS(SELECT 1 FROM core.roles WHERE id=OLD.role_id AND name='super_admin') THEN
      IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    SELECT auth_user_id INTO identity_id FROM core.users WHERE id=target;
    IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
    removing:=TG_OP='DELETE';
    IF TG_OP='UPDATE' THEN removing:=NEW.role_id IS DISTINCT FROM OLD.role_id OR NEW.user_id IS DISTINCT FROM OLD.user_id; END IF;
  END IF;
  IF removing AND EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=target AND r.name='super_admin') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('campus:super-admin-protection',0));
    IF identity_id=auth.uid() THEN RAISE EXCEPTION 'You cannot remove or disable your own super-admin access'; END IF;
    IF EXISTS(SELECT 1 FROM core.users WHERE id=target AND status='active' AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM core.users u JOIN core.user_roles ur ON ur.user_id=u.id JOIN core.roles r ON r.id=ur.role_id
        WHERE u.id<>target AND u.status='active' AND u.deleted_at IS NULL AND u.auth_user_id IS NOT NULL AND r.name='super_admin') THEN
      RAISE EXCEPTION 'The last active super administrator cannot be removed or disabled';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
REVOKE ALL ON FUNCTION core.protect_super_admin_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_super_admin_account BEFORE DELETE OR UPDATE ON core.users
FOR EACH ROW EXECUTE FUNCTION core.protect_super_admin_account();
CREATE TRIGGER protect_super_admin_role BEFORE DELETE OR UPDATE ON core.user_roles
FOR EACH ROW EXECUTE FUNCTION core.protect_super_admin_account();

CREATE FUNCTION core.delete_managed_user(target_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
DECLARE actor record; account core.users%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT ('super_admin'=ANY(actor.roles)) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF target_user_id=actor.user_id THEN RAISE EXCEPTION 'You cannot delete your own account'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('campus:super-admin-protection',0));
  SELECT * INTO account FROM core.users WHERE id=target_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF account.auth_user_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM storage.objects WHERE owner_id=account.auth_user_id::text OR owner=account.auth_user_id
  ) THEN RAISE EXCEPTION 'Remove the account-owned storage files before deleting this user'; END IF;
  IF account.auth_user_id IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id=account.auth_user_id::text;
    DELETE FROM auth.sessions WHERE user_id=account.auth_user_id;
  END IF;
  DELETE FROM learning.project_reviews WHERE reviewed_by=account.id;
  DELETE FROM core.users WHERE id=account.id;
  IF account.auth_user_id IS NOT NULL THEN DELETE FROM auth.users WHERE id=account.auth_user_id; END IF;
  RETURN jsonb_build_object('id',account.id,'deleted',true);
END; $$;
REVOKE ALL ON FUNCTION core.delete_managed_user(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION core.delete_managed_user(uuid) TO authenticated;

CREATE FUNCTION institution.guard_institution_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=institution,core,pg_catalog AS $$
DECLARE dependency record; occupied boolean;
BEGIN
  -- Parent-row locking also serializes new foreign-key references against deletion.
  FOR dependency IN
    SELECT n.nspname AS schema_name,c.relname AS table_name,a.attname AS column_name
    FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=fk.conkey[1]
    WHERE fk.contype='f' AND fk.confrelid='institution.institutions'::regclass
      AND NOT(n.nspname='core' AND c.relname='audit_logs')
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',dependency.schema_name,dependency.table_name,dependency.column_name)
      INTO occupied USING OLD.id;
    IF occupied THEN RAISE EXCEPTION 'Institution still has linked users, staff or learning records. Remove those links before deletion'; END IF;
  END LOOP;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION institution.guard_institution_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_institution_delete BEFORE DELETE ON institution.institutions
FOR EACH ROW EXECUTE FUNCTION institution.guard_institution_delete();

CREATE FUNCTION institution.delete_managed_institution(institution_id_value uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=institution,core,pg_catalog AS $$
DECLARE actor record;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT ('super_admin'=ANY(actor.roles)) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM institution.institutions WHERE id=institution_id_value FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Institution not found'; END IF;
  DELETE FROM institution.institutions WHERE id=institution_id_value;
  RETURN jsonb_build_object('id',institution_id_value,'deleted',true);
END; $$;
REVOKE ALL ON FUNCTION institution.delete_managed_institution(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION institution.delete_managed_institution(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

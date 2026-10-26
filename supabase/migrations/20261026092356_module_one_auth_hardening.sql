-- Module 01: database authorization and an atomic verified-login handoff.
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION core.get_current_user()
RETURNS TABLE(user_id uuid, tenant_id uuid, roles text[], status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, auth, pg_catalog AS $$
  SELECT u.id, u.tenant_id,
    coalesce(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL AND (
      coalesce(a.raw_app_meta_data->>'shared_dashboard_login', 'false') <> 'true'
      OR coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
        ->> 'x-campus-dashboard-role' = a.id::text || ':' || r.name
    )), '{}'::text[]), u.status
  FROM core.users u JOIN auth.users a ON a.id = u.auth_user_id
  LEFT JOIN core.user_roles ur ON ur.user_id = u.id LEFT JOIN core.roles r ON r.id = ur.role_id
  WHERE u.auth_user_id = auth.uid() AND u.deleted_at IS NULL AND u.status = 'active'
  GROUP BY u.id, u.tenant_id, u.status;
$$;

-- The role catalog is read-only application data, never a client privilege editor.
ALTER TABLE core.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_catalog_read ON core.roles FOR SELECT TO authenticated USING (true);
REVOKE ALL ON core.roles FROM anon, authenticated;
GRANT SELECT ON core.roles TO authenticated;
REVOKE ALL ON core.users, core.user_roles, core.user_invitations FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON core.users, core.user_roles, core.user_invitations FROM authenticated;

-- Active staff must be scoped to the target row, not to their own ID twice.
ALTER POLICY users_select ON core.users TO authenticated USING (
  (auth_user_id = (SELECT auth.uid()) AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR (cu.tenant_id = users.tenant_id AND cu.roles && ARRAY['institution_admin','teacher','trainer']))
);
ALTER POLICY users_insert ON core.users WITH CHECK (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = users.tenant_id
      AND users.status = 'invited' AND users.auth_user_id IS NULL))
);
ALTER POLICY users_update ON core.users USING (
  (auth_user_id = (SELECT auth.uid()) AND status = 'active' AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = users.tenant_id))
) WITH CHECK (
  (auth_user_id = (SELECT auth.uid()) AND status = 'active' AND deleted_at IS NULL)
  OR EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = users.tenant_id))
);

CREATE OR REPLACE FUNCTION core.guard_user_identity_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = core, auth, pg_catalog AS $$
BEGIN
  -- Validated login RPCs and trusted administration run as database/backend roles.
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)) THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - ARRAY['full_name','phone','avatar_url','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['full_name','phone','avatar_url','updated_at']) THEN
    RAISE EXCEPTION 'Identity, institution and account status require authorized administration' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION core.guard_user_identity_changes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_user_identity BEFORE UPDATE ON core.users
FOR EACH ROW EXECUTE FUNCTION core.guard_user_identity_changes();

-- A campus administrator may assign only the student role inside their own campus.
ALTER POLICY user_roles_select ON core.user_roles USING (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE cu.user_id = user_roles.user_id
    OR 'super_admin' = ANY(cu.roles) OR (cu.roles && ARRAY['institution_admin','teacher','trainer']
      AND cu.tenant_id = core.get_user_tenant_id(user_roles.user_id)))
);
ALTER POLICY user_roles_insert ON core.user_roles WITH CHECK (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_roles.user_id)
      AND EXISTS (SELECT 1 FROM core.roles r WHERE r.id = user_roles.role_id AND r.name = 'student')))
);
ALTER POLICY user_roles_update ON core.user_roles USING (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_roles.user_id)
      AND EXISTS (SELECT 1 FROM core.roles r WHERE r.id = user_roles.role_id AND r.name = 'student')))
) WITH CHECK (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_roles.user_id)
      AND EXISTS (SELECT 1 FROM core.roles r WHERE r.id = user_roles.role_id AND r.name = 'student')))
);
ALTER POLICY user_roles_delete ON core.user_roles USING (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = core.get_user_tenant_id(user_roles.user_id)
      AND EXISTS (SELECT 1 FROM core.roles r WHERE r.id = user_roles.role_id AND r.name = 'student')))
);
ALTER POLICY user_invitations_select ON core.user_invitations TO authenticated USING (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE cu.user_id = user_invitations.user_id
    OR 'super_admin' = ANY(cu.roles) OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = user_invitations.tenant_id))
);
ALTER POLICY user_invitations_insert ON core.user_invitations WITH CHECK (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = user_invitations.tenant_id
      AND cu.tenant_id = core.get_user_tenant_id(user_invitations.user_id)
      AND user_invitations.invitation_type = 'student_onboarding'))
);
ALTER POLICY user_invitations_update ON core.user_invitations WITH CHECK (
  EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin' = ANY(cu.roles)
    OR ('institution_admin' = ANY(cu.roles) AND cu.tenant_id = user_invitations.tenant_id
      AND cu.tenant_id = core.get_user_tenant_id(user_invitations.user_id)
      AND user_invitations.invitation_type = 'student_onboarding'))
);

CREATE OR REPLACE FUNCTION core.set_user_role_claim(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, auth, pg_catalog AS $$
DECLARE role_names jsonb; primary_name text;
BEGIN
  IF current_setting('role', true) IN ('anon','authenticated') AND (
    auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM core.get_current_user() cu
      WHERE cu.user_id IS NOT NULL AND (target_user_id = auth.uid() OR 'super_admin' = ANY(cu.roles)))
  ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(jsonb_agg(r.name ORDER BY r.priority DESC, r.name), '["public"]'::jsonb),
    coalesce((array_agg(r.name ORDER BY r.priority DESC, r.name))[1], 'public')
  INTO role_names, primary_name
  FROM core.users u JOIN core.user_roles ur ON ur.user_id = u.id JOIN core.roles r ON r.id = ur.role_id
  WHERE u.auth_user_id = target_user_id AND u.status = 'active' AND u.deleted_at IS NULL;
  UPDATE auth.users SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', primary_name, 'roles', role_names) WHERE id = target_user_id;
END;
$$;
REVOKE ALL ON FUNCTION core.set_user_role_claim(uuid) FROM PUBLIC, anon;

-- Auth INSERT alone is not proof of verified email ownership of a pre-provisioned account.
CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, auth, pg_catalog AS $$
DECLARE account core.users%ROWTYPE; matches integer;
BEGIN
  SELECT count(*) INTO matches FROM core.users WHERE lower(email) = lower(NEW.email);
  IF matches > 0 THEN
    -- Preserve verified OAuth onboarding for deployed clients, without trusting signup metadata.
    IF matches <> 1 OR NEW.email_confirmed_at IS NULL OR NEW.raw_app_meta_data->>'shared_dashboard_login' = 'true' THEN RETURN NEW; END IF;
    SELECT * INTO account FROM core.users WHERE lower(email) = lower(NEW.email) FOR UPDATE;
    IF account.deleted_at IS NOT NULL OR account.status <> 'invited' OR account.auth_user_id IS NOT NULL THEN RETURN NEW; END IF;
    PERFORM 1 FROM core.user_invitations WHERE user_id = account.id AND status IN ('created','sent','pending')
      AND expires_at > statement_timestamp() FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;
    UPDATE core.users SET auth_user_id = NEW.id, status = 'active', updated_at = now() WHERE id = account.id;
    UPDATE core.user_invitations SET status = 'accepted', accepted_at = now(), updated_at = now()
      WHERE user_id = account.id AND status IN ('created','sent','pending') AND expires_at > statement_timestamp();
    PERFORM core.set_user_role_claim(NEW.id);
    RETURN NEW;
  END IF;
  INSERT INTO core.users(id,auth_user_id,full_name,email,phone,avatar_url,tenant_id,status,onboarding_source)
  VALUES (NEW.id, NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',''),
    NEW.email, NEW.phone, coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture',''),
    NULL, 'active', 'public_signup');
  INSERT INTO core.user_roles(user_id,role_id) SELECT NEW.id,r.id FROM core.roles r WHERE r.name = 'public';
  PERFORM core.set_user_role_claim(NEW.id);
  RETURN NEW;
END;
$$;

-- One bounded transaction: validated identity, locked invitation/account, link, acceptance, claims.
CREATE OR REPLACE FUNCTION core.complete_login()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, auth, pg_catalog AS $$
DECLARE account core.users%ROWTYPE; identity auth.users%ROWTYPE; matches integer; accepted_at_time timestamptz := statement_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AccountUnavailable' USING ERRCODE = '42501'; END IF;
  SELECT * INTO identity FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND OR identity.email_confirmed_at IS NULL OR identity.email IS NULL THEN
    RAISE EXCEPTION 'AccountUnavailable' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO account FROM core.users WHERE auth_user_id = identity.id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT count(*) INTO matches FROM core.users WHERE lower(email) = lower(identity.email);
    IF matches = 0 THEN RETURN NULL; END IF;
    IF matches <> 1 THEN RAISE EXCEPTION 'AccountUnavailable' USING ERRCODE = '42501'; END IF;
    SELECT * INTO account FROM core.users WHERE lower(email) = lower(identity.email) FOR UPDATE;
  END IF;
  IF account.deleted_at IS NOT NULL OR (account.status <> 'active' AND NOT (account.status = 'invited' AND account.auth_user_id IS NULL)) THEN
    RAISE EXCEPTION 'AccountUnavailable' USING ERRCODE = '42501';
  END IF;
  IF account.auth_user_id IS NOT NULL AND account.auth_user_id <> identity.id THEN
    RAISE EXCEPTION 'AccountMismatch' USING ERRCODE = '42501';
  END IF;
  IF account.auth_user_id IS NULL THEN
    IF identity.raw_app_meta_data->>'shared_dashboard_login' = 'true' THEN RAISE EXCEPTION 'AccountUnavailable' USING ERRCODE = '42501'; END IF;
    PERFORM 1 FROM core.user_invitations WHERE user_id = account.id AND status IN ('created','sent','pending')
      AND expires_at > accepted_at_time FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AccountUnavailable' USING ERRCODE = '42501'; END IF;
    UPDATE core.users SET auth_user_id = identity.id, status = 'active', updated_at = now() WHERE id = account.id;
  END IF;
  UPDATE core.user_invitations SET status = 'accepted', accepted_at = accepted_at_time, updated_at = now()
    WHERE user_id = account.id AND status IN ('created','sent','pending') AND expires_at > accepted_at_time;
  PERFORM core.set_user_role_claim(identity.id);
  RETURN jsonb_build_object('id',account.id,'status','active');
END;
$$;
REVOKE ALL ON FUNCTION core.complete_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION core.complete_login() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION core.get_user_primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION core.get_user_primary_role(uuid) TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_users_login_email ON core.users(lower(email));
NOTIFY pgrst, 'reload schema';

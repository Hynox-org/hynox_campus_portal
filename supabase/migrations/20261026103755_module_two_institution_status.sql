-- Onboarding and regeneration must respect institution suspension as well as user status.
SET lock_timeout='5s';
CREATE OR REPLACE FUNCTION core.provision_onboarding(rows jsonb, dedicated_super boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
DECLARE
  actor record; item jsonb; result jsonb := '[]'; account core.users%ROWTYPE;
  invitation core.user_invitations%ROWTYPE; role_name text; role_id_value uuid;
  email_value text; name_value text; tenant_value uuid; invitation_type_value text;
  institution_name text; matches integer; row_error text;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT (actor.roles && ARRAY['super_admin','institution_admin']) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(rows) IS DISTINCT FROM 'array' OR jsonb_array_length(rows) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'A batch must contain 1 to 100 users';
  END IF;
  IF dedicated_super AND NOT ('super_admin'=ANY(actor.roles)) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(rows) LOOP
    BEGIN
      email_value := lower(btrim(item->>'email')); name_value := btrim(item->>'name');
      role_name := lower(btrim(item->>'role'));
      IF email_value IS NULL OR length(email_value)>254 OR email_value !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
        OR name_value IS NULL OR length(name_value) NOT BETWEEN 1 AND 200 OR name_value ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'Invalid name or email';
      END IF;
      IF role_name IS NULL OR NOT (role_name=ANY(ARRAY['student','institution_admin','teacher','trainer','mentor','super_admin']))
        OR (role_name='super_admin') IS DISTINCT FROM dedicated_super THEN RAISE EXCEPTION 'Unsupported onboarding role'; END IF;
      tenant_value := CASE WHEN role_name IN ('teacher','trainer','super_admin') THEN NULL ELSE nullif(item->>'institution_id','')::uuid END;
      IF role_name NOT IN ('teacher','trainer','super_admin') AND tenant_value IS NULL THEN RAISE EXCEPTION 'Institution is required'; END IF;
      IF NOT ('super_admin'=ANY(actor.roles)) AND (role_name<>'student' OR tenant_value IS DISTINCT FROM actor.tenant_id) THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
      END IF;
      institution_name := 'Hynox Campus';
      IF tenant_value IS NOT NULL THEN
        SELECT name INTO institution_name FROM institution.institutions WHERE id=tenant_value AND status NOT IN ('inactive','suspended');
        IF NOT FOUND THEN RAISE EXCEPTION 'Institution not found'; END IF;
      END IF;
      SELECT id INTO STRICT role_id_value FROM core.roles WHERE name=role_name;
      invitation_type_value := CASE role_name WHEN 'student' THEN 'student_onboarding'
        WHEN 'institution_admin' THEN 'institution_admin_invite' WHEN 'mentor' THEN 'mentor_invite'
        WHEN 'super_admin' THEN 'super_admin_invite' ELSE 'trainer_onboarding' END;
      PERFORM pg_advisory_xact_lock(hashtextextended(email_value,781));
      SELECT count(*) INTO matches FROM core.users WHERE lower(email)=email_value;
      IF matches>1 THEN RAISE EXCEPTION 'Ambiguous existing email; administrator review required'; END IF;
      IF matches=1 THEN
        SELECT * INTO account FROM core.users WHERE lower(email)=email_value FOR UPDATE;
        IF account.deleted_at IS NOT NULL OR account.status<>'invited' OR account.auth_user_id IS NOT NULL THEN
          RAISE EXCEPTION 'Account is already active or unavailable; onboarding cannot change it';
        END IF;
        IF account.tenant_id IS DISTINCT FROM tenant_value OR EXISTS(
          SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id
          WHERE ur.user_id=account.id AND r.name<>role_name
        ) THEN RAISE EXCEPTION 'Existing account has a different role or institution'; END IF;
      ELSE
        INSERT INTO core.users(full_name,email,tenant_id,status,onboarding_source)
        VALUES(name_value,email_value,tenant_value,'invited',CASE WHEN dedicated_super THEN 'admin_created' ELSE 'excel_import' END)
        RETURNING * INTO account;
      END IF;
      INSERT INTO core.user_roles(user_id,role_id) VALUES(account.id,role_id_value) ON CONFLICT DO NOTHING;
      IF role_name='institution_admin' THEN
        INSERT INTO institution.institution_admins(institution_id,user_id,assigned_by)
          VALUES(tenant_value,account.id,actor.user_id) ON CONFLICT DO NOTHING;
      END IF;
      SELECT * INTO invitation FROM core.user_invitations WHERE user_id=account.id
        AND invitation_type=invitation_type_value AND status IN ('created','sent','pending')
        AND expires_at>statement_timestamp() ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
      IF NOT FOUND THEN
        UPDATE core.user_invitations SET status='revoked',mail_state='cancelled',mail_lease=NULL,mail_lease_until=NULL,updated_at=now()
          WHERE user_id=account.id AND status IN ('created','sent','pending','failed');
        INSERT INTO core.user_invitations(user_id,tenant_id,invited_by,expires_at,invitation_type,mail_state)
        VALUES(account.id,tenant_value,actor.user_id,now()+interval '7 days',invitation_type_value,'queued')
        RETURNING * INTO invitation;
      END IF;
      result := result || jsonb_build_array(jsonb_build_object('email',email_value,'status','success',
        'id',invitation.id,'token',invitation.token,'expires_at',invitation.expires_at,'invitation_type',invitation_type_value,
        'institution_name',institution_name,'queued',invitation.mail_state IN ('queued','processing')));
    EXCEPTION WHEN raise_exception OR insufficient_privilege OR invalid_text_representation THEN
      GET STACKED DIAGNOSTICS row_error=MESSAGE_TEXT;
      result := result || jsonb_build_array(jsonb_build_object('email',coalesce(email_value,''),'status','error','error',row_error));
    WHEN OTHERS THEN
      result := result || jsonb_build_array(jsonb_build_object('email',coalesce(email_value,''),'status','error','error','Unable to provision this account; retry or contact an administrator'));
    END;
  END LOOP;
  RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION core.regenerate_onboarding(invitation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
DECLARE actor record; account core.users%ROWTYPE; invitation core.user_invitations%ROWTYPE; target uuid;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT (actor.roles && ARRAY['super_admin','institution_admin']) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  SELECT user_id INTO target FROM core.user_invitations WHERE id=invitation_id;
  SELECT * INTO account FROM core.users WHERE id=target FOR UPDATE;
  IF NOT FOUND OR account.deleted_at IS NOT NULL OR account.status<>'invited' OR account.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation is unavailable or account is already activated';
  END IF;
  IF account.tenant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM institution.institutions WHERE id=account.tenant_id AND status NOT IN ('inactive','suspended')) THEN RAISE EXCEPTION 'Institution unavailable'; END IF;
  SELECT * INTO invitation FROM core.user_invitations WHERE id=invitation_id FOR UPDATE;
  IF NOT ('super_admin'=ANY(actor.roles)) AND (
    invitation.tenant_id IS DISTINCT FROM actor.tenant_id OR account.tenant_id IS DISTINCT FROM actor.tenant_id
    OR invitation.invitation_type<>'student_onboarding'
    OR EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=account.id AND r.name<>'student')
  ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF invitation.status='accepted' THEN RAISE EXCEPTION 'Invitation already accepted'; END IF;
  IF invitation.mail_state='processing' AND invitation.mail_lease_until>now() THEN RAISE EXCEPTION 'Email is being processed; retry shortly'; END IF;
  UPDATE core.user_invitations SET status='revoked',mail_state='cancelled',mail_lease=NULL,mail_lease_until=NULL,updated_at=now()
    WHERE user_id=account.id AND id<>invitation_id AND status IN ('created','sent','pending','failed');
  UPDATE core.user_invitations SET token=gen_random_uuid(),expires_at=now()+interval '7 days',status='created',
    invited_by=actor.user_id,mail_state='queued',mail_attempts=0,mail_next_attempt_at=now(),
    mail_lease=NULL,mail_lease_until=NULL,mail_message_id=NULL,updated_at=now()
    WHERE id=invitation_id RETURNING * INTO invitation;
  RETURN to_jsonb(invitation) || jsonb_build_object('email',account.email);
END; $$;
CREATE OR REPLACE FUNCTION core.assign_onboarding_admin(institution_id_value uuid,email_value text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
DECLARE actor record; account core.users%ROWTYPE; matches integer;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT ('super_admin'=ANY(actor.roles)) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM institution.institutions WHERE id=institution_id_value AND status NOT IN ('inactive','suspended')) THEN RAISE EXCEPTION 'Institution unavailable'; END IF;
  SELECT count(*) INTO matches FROM core.users WHERE lower(email)=lower(btrim(email_value));
  IF matches<>1 THEN RAISE EXCEPTION 'Account unavailable; onboard the user first'; END IF;
  SELECT * INTO account FROM core.users WHERE lower(email)=lower(btrim(email_value)) FOR UPDATE;
  IF account.deleted_at IS NOT NULL OR account.status NOT IN ('active','invited')
    OR (account.tenant_id IS NOT NULL AND account.tenant_id<>institution_id_value) THEN RAISE EXCEPTION 'Account unavailable or belongs to another institution'; END IF;
  INSERT INTO institution.institution_admins(institution_id,user_id,assigned_by)
    VALUES(institution_id_value,account.id,actor.user_id) ON CONFLICT DO NOTHING;
  INSERT INTO core.user_roles(user_id,role_id) SELECT account.id,id FROM core.roles WHERE name='institution_admin' ON CONFLICT DO NOTHING;
  UPDATE core.users SET tenant_id=institution_id_value WHERE id=account.id;
  IF account.auth_user_id IS NOT NULL THEN PERFORM core.set_user_role_claim(account.auth_user_id); END IF;
  RETURN account.id;
END; $$;
NOTIFY pgrst,'reload schema';

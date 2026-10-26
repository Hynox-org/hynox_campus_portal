-- Module 02: atomic provisioning and a durable, leased email outbox.
SET lock_timeout = '5s';
ALTER TABLE core.user_invitations
  ADD COLUMN mail_state text NOT NULL DEFAULT 'none' CHECK (mail_state IN ('none','queued','processing','sent','failed','cancelled')),
  ADD COLUMN mail_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN mail_next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN mail_lease uuid,
  ADD COLUMN mail_lease_until timestamptz,
  ADD COLUMN mail_message_id text;
CREATE INDEX invitation_outbox_ready ON core.user_invitations(mail_next_attempt_at,created_at)
  WHERE mail_state IN ('queued','processing');
CREATE INDEX invitation_tenant_created ON core.user_invitations(tenant_id,created_at DESC,id);

CREATE FUNCTION core.cancel_closed_invitation_mail() RETURNS trigger
LANGUAGE plpgsql SET search_path=core,pg_catalog AS $$
BEGIN
  IF NEW.status IN ('accepted','expired','revoked') AND NEW.mail_state IN ('queued','processing') THEN
    NEW.mail_state:='cancelled'; NEW.mail_lease:=NULL; NEW.mail_lease_until:=NULL;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION core.cancel_closed_invitation_mail() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cancel_closed_invitation_mail BEFORE UPDATE ON core.user_invitations
FOR EACH ROW EXECUTE FUNCTION core.cancel_closed_invitation_mail();

-- Preserve legacy duplicate accounts, but reject new ambiguous identities, including races.
CREATE FUNCTION core.guard_new_email_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_catalog AS $$
BEGIN
  IF TG_OP='UPDATE' AND lower(NEW.email)=lower(OLD.email) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(NEW.email),781));
  IF EXISTS(SELECT 1 FROM core.users WHERE lower(email)=lower(NEW.email) AND id<>NEW.id) THEN
    RAISE EXCEPTION 'Email already exists' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION core.guard_new_email_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_new_email_identity BEFORE INSERT OR UPDATE OF email ON core.users
FOR EACH ROW EXECUTE FUNCTION core.guard_new_email_identity();

CREATE FUNCTION core.provision_onboarding(rows jsonb, dedicated_super boolean DEFAULT false)
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
        SELECT name INTO institution_name FROM institution.institutions WHERE id=tenant_value;
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
REVOKE ALL ON FUNCTION core.provision_onboarding(jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION core.provision_onboarding(jsonb,boolean) TO authenticated;

CREATE FUNCTION core.regenerate_onboarding(invitation_id uuid)
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
REVOKE ALL ON FUNCTION core.regenerate_onboarding(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION core.regenerate_onboarding(uuid) TO authenticated;

CREATE FUNCTION core.claim_onboarding_mail()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_catalog AS $$
DECLARE invitation core.user_invitations%ROWTYPE; account core.users%ROWTYPE; institution_name text;
BEGIN
  -- Only the backend worker can execute this function. One lease bounds one provider request.
  UPDATE core.user_invitations SET mail_state='failed',status='failed',mail_lease=NULL,mail_lease_until=NULL
    WHERE mail_state='processing' AND mail_attempts>=5 AND mail_lease_until<now() AND status IN ('created','sent','pending');
  UPDATE core.user_invitations SET mail_state='cancelled',status='expired',mail_lease=NULL,mail_lease_until=NULL
    WHERE mail_state IN ('queued','processing') AND expires_at<=now() AND status IN ('created','sent','pending');
  SELECT * INTO invitation FROM core.user_invitations
    WHERE status IN ('created','sent','pending') AND expires_at>now() AND mail_attempts<5
      AND ((mail_state='queued' AND mail_next_attempt_at<=now()) OR (mail_state='processing' AND mail_lease_until<now()))
    ORDER BY mail_next_attempt_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO account FROM core.users WHERE id=invitation.user_id;
  IF account.deleted_at IS NOT NULL OR account.status<>'invited' OR account.auth_user_id IS NOT NULL THEN
    UPDATE core.user_invitations SET mail_state='cancelled',mail_lease=NULL,mail_lease_until=NULL WHERE id=invitation.id;
    RETURN NULL;
  END IF;
  UPDATE core.user_invitations SET mail_state='processing',mail_attempts=mail_attempts+1,
    mail_lease=gen_random_uuid(),mail_lease_until=now()+interval '2 minutes'
    WHERE id=invitation.id RETURNING * INTO invitation;
  SELECT name INTO institution_name FROM institution.institutions WHERE id=invitation.tenant_id;
  RETURN jsonb_build_object('id',invitation.id,'token',invitation.token,'lease',invitation.mail_lease,
    'email',account.email,'name',account.full_name,'invitation_type',invitation.invitation_type,
    'institution_name',coalesce(institution_name,'Hynox Campus'));
END; $$;
REVOKE ALL ON FUNCTION core.claim_onboarding_mail() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION core.claim_onboarding_mail() TO service_role;

CREATE FUNCTION core.finish_onboarding_mail(invitation_id uuid, token_value uuid, lease_value uuid, succeeded boolean, message_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,pg_catalog AS $$
DECLARE affected integer;
BEGIN
  UPDATE core.user_invitations SET
    mail_state=CASE WHEN succeeded THEN 'sent' WHEN mail_attempts>=5 THEN 'failed' ELSE 'queued' END,
    status=CASE WHEN succeeded THEN 'sent' WHEN mail_attempts>=5 THEN 'failed' ELSE status END,
    mail_next_attempt_at=now()+make_interval(secs => least(900,30*power(2,mail_attempts-1)::integer)),
    mail_message_id=CASE WHEN succeeded THEN left(message_id,500) ELSE NULL END,
    mail_lease=NULL,mail_lease_until=NULL,updated_at=now()
    WHERE id=invitation_id AND token=token_value AND mail_lease=lease_value AND mail_state='processing'
      AND status IN ('created','sent','pending');
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END; $$;
REVOKE ALL ON FUNCTION core.finish_onboarding_mail(uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION core.finish_onboarding_mail(uuid,uuid,uuid,boolean,text) TO service_role;
NOTIFY pgrst,'reload schema';

CREATE FUNCTION core.assign_onboarding_admin(institution_id_value uuid,email_value text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
DECLARE actor record; account core.users%ROWTYPE; matches integer;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT ('super_admin'=ANY(actor.roles)) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM institution.institutions WHERE id=institution_id_value) THEN RAISE EXCEPTION 'Institution unavailable'; END IF;
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
REVOKE ALL ON FUNCTION core.assign_onboarding_admin(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION core.assign_onboarding_admin(uuid,text) TO authenticated;


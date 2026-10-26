-- Synthetic fixtures and their audit records are rolled back inside the exception block.
-- Any failed ASSERT aborts the migration; only the deliberate cleanup exception is caught.
DO $tests$
DECLARE
  tenant_a uuid := gen_random_uuid(); tenant_b uuid := gen_random_uuid();
  actor uuid := gen_random_uuid(); target uuid := gen_random_uuid(); invited uuid := gen_random_uuid();
  identity_id uuid := gen_random_uuid(); expired uuid := gen_random_uuid(); suspended uuid := gen_random_uuid();
  unverified uuid := gen_random_uuid(); student_role uuid; admin_role uuid; response jsonb; affected integer;
BEGIN
  BEGIN
    ASSERT NOT has_table_privilege('anon','core.users','SELECT'), 'Anonymous user enumeration';
    ASSERT NOT has_table_privilege('anon','core.user_invitations','SELECT'), 'Anonymous invitation enumeration';
    ASSERT NOT has_table_privilege('authenticated','core.roles','UPDATE'), 'Role catalog mutation';
    ASSERT NOT has_table_privilege('authenticated','core.users','TRUNCATE'), 'TRUNCATE bypass';
    ASSERT NOT has_function_privilege('anon','core.complete_login()','EXECUTE'), 'Anonymous login RPC';
    ASSERT NOT has_function_privilege('anon','core.set_user_role_claim(uuid)','EXECUTE'), 'Anonymous claim RPC';
    SELECT id INTO student_role FROM core.roles WHERE name='student';
    SELECT id INTO admin_role FROM core.roles WHERE name='institution_admin';
    INSERT INTO institution.institutions(id,name,institution_code,institution_type) VALUES
      (tenant_a,'Module 01 rollback fixture',tenant_a::text,'college'),
      (tenant_b,'Module 01 rollback fixture',tenant_b::text,'college');
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) VALUES
      (actor,actor::text || '@example.invalid',now(),'{}',jsonb_build_object('tenant_id',tenant_b));
    ASSERT (SELECT tenant_id IS NULL FROM core.users WHERE auth_user_id=actor), 'User metadata must not set campus';
    UPDATE core.users SET tenant_id=tenant_a WHERE auth_user_id=actor;
    INSERT INTO core.user_roles(user_id,role_id) VALUES (actor,admin_role);
    INSERT INTO core.users(id,email,tenant_id,status) VALUES
      (target,target::text || '@example.invalid',tenant_b,'invited'),
      (invited,invited::text || '@example.invalid',tenant_a,'invited'),
      (expired,expired::text || '@example.invalid',tenant_a,'invited'),
      (suspended,suspended::text || '@example.invalid',tenant_a,'suspended'),
      (unverified,unverified::text || '@example.invalid',tenant_a,'invited');
    INSERT INTO core.user_roles(user_id,role_id) VALUES (invited,student_role);
    INSERT INTO core.user_invitations(user_id,tenant_id,expires_at,invitation_type) VALUES
      (invited,tenant_a,now()+interval '1 day','student_onboarding'),
      (expired,tenant_a,now()-interval '1 day','student_onboarding'),
      (suspended,tenant_a,now()+interval '1 day','student_onboarding'),
      (unverified,tenant_a,now()+interval '1 day','student_onboarding');
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES
      (identity_id,invited::text || '@example.invalid',now(),'{}'),
      (expired,expired::text || '@example.invalid',now(),'{}'),
      (suspended,suspended::text || '@example.invalid',now(),'{}'),
      (unverified,unverified::text || '@example.invalid',NULL,'{}');
    ASSERT (SELECT auth_user_id=identity_id AND status='active' FROM core.users WHERE id=invited), 'Verified invite must link';
    ASSERT (SELECT status='accepted' FROM core.user_invitations WHERE user_id=invited), 'Invite acceptance';
    ASSERT (SELECT auth_user_id IS NULL FROM core.users WHERE id=expired), 'Expired invite must not link';
    ASSERT (SELECT auth_user_id IS NULL AND status='suspended' FROM core.users WHERE id=suspended), 'Suspended account must not reactivate';
    ASSERT (SELECT auth_user_id IS NULL FROM core.users WHERE id=unverified), 'Unverified email must not link';
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT (SELECT count(*)=1 FROM core.get_current_user()), 'Active campus admin identity';
    ASSERT NOT EXISTS (SELECT 1 FROM core.users WHERE id=target), 'Cross-campus user visibility';
    BEGIN
      UPDATE core.users SET tenant_id=tenant_b WHERE id=actor;
      RAISE EXCEPTION 'Identity guard did not block tenant change';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    UPDATE core.users SET full_name='Allowed profile update' WHERE id=actor;
    GET DIAGNOSTICS affected = ROW_COUNT;
    ASSERT affected=1, 'Profile updates should still work';
    BEGIN
      INSERT INTO core.user_roles(user_id,role_id) VALUES(target,student_role);
      RAISE EXCEPTION 'Cross-campus role grant allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      INSERT INTO core.user_roles(user_id,role_id) VALUES(invited,admin_role);
      RAISE EXCEPTION 'Campus administrator escalation allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      INSERT INTO core.user_invitations(user_id,tenant_id,expires_at,invitation_type)
      VALUES(target,tenant_a,now()+interval '1 day','student_onboarding');
      RAISE EXCEPTION 'Cross-campus invitation allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    INSERT INTO core.user_invitations(user_id,tenant_id,expires_at,invitation_type)
      VALUES(invited,tenant_a,now()+interval '1 day','student_onboarding');
    PERFORM set_config('request.jwt.claim.sub',identity_id::text,true);
    response := core.complete_login();
    ASSERT response->>'id'=invited::text, 'Atomic returning login';
    ASSERT core.complete_login()=response, 'Repeated login is idempotent';
    PERFORM set_config('request.jwt.claim.sub',expired::text,true);
    BEGIN
      PERFORM core.complete_login(); RAISE EXCEPTION 'Expired login allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM set_config('request.jwt.claim.sub',unverified::text,true);
    BEGIN
      PERFORM core.complete_login(); RAISE EXCEPTION 'Unconfirmed login allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    UPDATE auth.users SET email_confirmed_at=now() WHERE id=unverified;
    SET LOCAL ROLE authenticated;
    response := core.complete_login();
    ASSERT response->>'id'=unverified::text, 'Atomic first-login link after email confirmation';
    RESET ROLE;
    ASSERT (SELECT auth_user_id=unverified AND status='active' FROM core.users WHERE id=unverified), 'Atomic account activation';
    ASSERT (SELECT status='accepted' FROM core.user_invitations WHERE user_id=unverified), 'Atomic first-login invitation acceptance';
    UPDATE core.users SET status='suspended' WHERE id=actor;
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT NOT EXISTS (SELECT 1 FROM core.get_current_user()), 'Suspended account retains role';
    BEGIN
      PERFORM core.set_user_role_claim(actor); RAISE EXCEPTION 'Suspended account can refresh claims';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    RAISE SQLSTATE 'ZX001' USING MESSAGE='rollback successful fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END;
$tests$;

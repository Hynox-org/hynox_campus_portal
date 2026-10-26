-- Synthetic records, including trigger audit records, roll back on successful completion.
DO $tests$
DECLARE
  campus uuid:=gen_random_uuid(); other_campus uuid:=gen_random_uuid();
  admin_id uuid:=gen_random_uuid(); campus_admin uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid();
  prefix text:=gen_random_uuid()::text; response jsonb; original jsonb; mail jsonb; regenerated jsonb;
  target uuid; role_name text; payload jsonb; fixture_user uuid;
BEGIN
  BEGIN
    ASSERT NOT has_function_privilege('anon','core.provision_onboarding(jsonb,boolean)','EXECUTE'), 'Anonymous onboarding';
    ASSERT NOT has_function_privilege('authenticated','core.claim_onboarding_mail()','EXECUTE'), 'Client mail dispatch';
    ASSERT NOT has_function_privilege('authenticated','core.finish_onboarding_mail(uuid,uuid,uuid,boolean,text)','EXECUTE'), 'Client mail acknowledgement';
    INSERT INTO institution.institutions(id,name,institution_code,institution_type) VALUES
      (campus,'Module 02 rollback fixture',campus::text,'college'),
      (other_campus,'Module 02 rollback fixture',other_campus::text,'college');
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES
      (admin_id,admin_id::text||'@example.invalid',now(),'{}'),
      (campus_admin,campus_admin::text||'@example.invalid',now(),'{}'),
      (learner,learner::text||'@example.invalid',now(),'{}');
    UPDATE core.users SET tenant_id=campus WHERE id=campus_admin;
    DELETE FROM core.user_roles WHERE user_id IN (admin_id,campus_admin);
    INSERT INTO core.user_roles(user_id,role_id) SELECT admin_id,id FROM core.roles WHERE name='super_admin';
    INSERT INTO core.user_roles(user_id,role_id) SELECT campus_admin,id FROM core.roles WHERE name='institution_admin';
    PERFORM set_config('request.jwt.claim.sub',learner::text,true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM core.provision_onboarding('[]'); RAISE EXCEPTION 'Student can onboard';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM set_config('request.jwt.claim.sub',campus_admin::text,true);
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Student','email',prefix||'@example.invalid','role','student','institution_id',campus)));
    ASSERT response->0->>'status'='success', 'Own-campus student provisioning';
    original:=response->0; target:=(original->>'id')::uuid;
    RESET ROLE;
    UPDATE institution.institutions SET status='suspended' WHERE id=campus;
    SET LOCAL ROLE authenticated;
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Blocked student','email',prefix||'-suspended-campus@example.invalid','role','student','institution_id',campus)));
    ASSERT response->0->>'status'='error', 'Suspended institution can onboard';
    BEGIN
      PERFORM core.regenerate_onboarding(target); RAISE EXCEPTION 'Suspended institution can regenerate';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='Suspended institution can regenerate' THEN RAISE; END IF;
    END;
    RESET ROLE;
    UPDATE institution.institutions SET status='onboarding' WHERE id=campus;
    SET LOCAL ROLE authenticated;
    BEGIN
      UPDATE core.user_invitations SET mail_attempts=99 WHERE id=target;
      RAISE EXCEPTION 'Client can forge email attempts';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Student','email',upper(prefix)||'@EXAMPLE.INVALID','role','student','institution_id',campus)));
    ASSERT response->0->>'id'=original->>'id' AND response->0->>'token'=original->>'token', 'Idempotent normalized re-import';
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Student','email',prefix||'-cross@example.invalid','role','student','institution_id',other_campus)));
    ASSERT response->0->>'status'='error', 'Cross-campus provisioning';
    BEGIN
      PERFORM core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Admin','email',prefix||'-escalate@example.invalid','role','super_admin')),true);
      RAISE EXCEPTION 'Campus admin can invoke dedicated super onboarding';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Teacher','email',prefix||'-teacher@example.invalid','role','teacher')));
    ASSERT response->0->>'status'='error', 'Campus admin teacher escalation';
    BEGIN
      PERFORM core.assign_onboarding_admin(campus,learner::text||'@example.invalid');
      RAISE EXCEPTION 'Campus administrator can assign administrators';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
    FOREACH role_name IN ARRAY ARRAY['teacher','trainer','mentor','institution_admin','super_admin'] LOOP
      response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Role fixture','email',prefix||'-'||role_name||'@example.invalid','role',role_name,'institution_id',campus)),role_name='super_admin');
      ASSERT response->0->>'status'='success', 'Super-admin onboarding role matrix';
      ASSERT response->0->>'invitation_type'=CASE role_name WHEN 'super_admin' THEN 'super_admin_invite' WHEN 'institution_admin' THEN 'institution_admin_invite' WHEN 'mentor' THEN 'mentor_invite' ELSE 'trainer_onboarding' END, 'Correct invitation type';
    END LOOP;
    RESET ROLE;
    ASSERT EXISTS(SELECT 1 FROM institution.institution_admins ia JOIN core.users u ON u.id=ia.user_id WHERE u.email=prefix||'-institution_admin@example.invalid' AND ia.institution_id=campus), 'Institution admin mapping missing';
    SET LOCAL ROLE authenticated;
    ASSERT core.assign_onboarding_admin(campus,learner::text||'@example.invalid')=learner, 'Explicit administrator assignment';
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Bad email','email','invalid','role','student','institution_id',campus)));
    ASSERT response->0->>'status'='error', 'Malformed input accepted';
    response:=core.provision_onboarding(jsonb_build_array(jsonb_build_object('name','Active','email',admin_id::text||'@example.invalid','role','student','institution_id',campus)));
    ASSERT response->0->>'status'='error', 'Active account mutated by onboarding';
    regenerated:=core.regenerate_onboarding(target);
    ASSERT regenerated->>'token'<>original->>'token', 'Regeneration must invalidate old token';
    RESET ROLE;
    ASSERT NOT EXISTS(SELECT 1 FROM core.user_invitations WHERE token=(original->>'token')::uuid), 'Old token still usable';
    UPDATE core.user_invitations SET mail_next_attempt_at=now()-interval '1 year' WHERE id=target;
    SET LOCAL ROLE service_role;
    mail:=core.claim_onboarding_mail();
    ASSERT mail->>'id'=target::text, 'Worker claim failed';
    ASSERT NOT core.finish_onboarding_mail(target,(mail->>'token')::uuid,gen_random_uuid(),true), 'Foreign lease can acknowledge';
    ASSERT core.finish_onboarding_mail(target,(mail->>'token')::uuid,(mail->>'lease')::uuid,false), 'Failed send not retried';
    RESET ROLE;
    ASSERT (SELECT mail_state='queued' AND mail_attempts=1 FROM core.user_invitations WHERE id=target), 'Retry state';
    UPDATE core.user_invitations SET mail_state='processing',mail_lease=gen_random_uuid(),mail_lease_until=now()-interval '1 minute',mail_next_attempt_at=now()-interval '1 year' WHERE id=target;
    SET LOCAL ROLE service_role;
    mail:=core.claim_onboarding_mail();
    ASSERT mail->>'id'=target::text, 'Expired worker lease was not recovered';
    RESET ROLE;
    UPDATE core.user_invitations SET mail_attempts=5,mail_lease_until=now()-interval '1 minute' WHERE id=target;
    SET LOCAL ROLE service_role;
    PERFORM core.claim_onboarding_mail();
    RESET ROLE;
    ASSERT (SELECT mail_state='failed' AND status='failed' FROM core.user_invitations WHERE id=target), 'Final abandoned lease must fail';
    SET LOCAL ROLE authenticated;
    regenerated:=core.regenerate_onboarding(target);
    RESET ROLE;
    UPDATE core.user_invitations SET mail_next_attempt_at=now()-interval '1 year' WHERE id=target;
    SET LOCAL ROLE service_role;
    mail:=core.claim_onboarding_mail();
    RESET ROLE;
    UPDATE core.user_invitations SET status='accepted' WHERE id=target;
    SET LOCAL ROLE service_role;
    ASSERT NOT core.finish_onboarding_mail(target,(mail->>'token')::uuid,(mail->>'lease')::uuid,true), 'Acknowledgement overwrites accepted invitation';
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM core.regenerate_onboarding(target); RAISE EXCEPTION 'Accepted invitation regenerated';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='Accepted invitation regenerated' THEN RAISE; END IF;
    END;
    SELECT jsonb_agg(jsonb_build_object('name','Batch student','email',prefix||'-batch-'||i||'@example.invalid','role','student','institution_id',campus))
      INTO payload FROM generate_series(1,100) i;
    response:=core.provision_onboarding(payload);
    ASSERT jsonb_array_length(response)=100 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(response) r WHERE r->>'status'<>'success'), '100-user transaction batch';
    RESET ROLE;
    ASSERT (SELECT count(*)=100 FROM core.users WHERE email LIKE prefix||'-batch-%'), 'Batch account count';
    ASSERT (SELECT count(*)=100 FROM core.user_roles ur JOIN core.users u ON u.id=ur.user_id WHERE u.email LIKE prefix||'-batch-%'), 'Batch role count';
    ASSERT (SELECT count(*)=100 FROM core.user_invitations ui JOIN core.users u ON u.id=ui.user_id WHERE u.email LIKE prefix||'-batch-%' AND ui.mail_state='queued'), 'Batch queue count';
    -- Module 01 first-login handoff accepts the provisioned account and its role.
    SELECT id INTO fixture_user FROM core.users WHERE email=prefix||'-batch-1@example.invalid';
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES(gen_random_uuid(),prefix||'-batch-1@example.invalid',now(),'{}');
    ASSERT (SELECT status='active' AND auth_user_id IS NOT NULL FROM core.users WHERE id=fixture_user), 'Onboarding to login handoff';
    ASSERT (SELECT status='accepted' FROM core.user_invitations WHERE user_id=fixture_user), 'First-login acceptance';
    RAISE SQLSTATE 'ZX002' USING MESSAGE='rollback successful fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL;
  END;
END;
$tests$;

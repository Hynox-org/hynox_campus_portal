DO $benchmark$
DECLARE campus uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); prefix text:=gen_random_uuid()::text;
  payload jsonb; response jsonb; started timestamptz; elapsed_ms numeric;
BEGIN
  BEGIN
    INSERT INTO institution.institutions(id,name,institution_code,institution_type) VALUES(campus,'Module 02 capacity fixture',campus::text,'college');
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES(actor,actor::text||'@example.invalid',now(),'{}');
    INSERT INTO core.user_roles(user_id,role_id) SELECT actor,id FROM core.roles WHERE name='super_admin';
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    SET LOCAL ROLE authenticated;
    started:=clock_timestamp();
    FOR batch IN 0..24 LOOP
      SELECT jsonb_agg(jsonb_build_object('name','Capacity student','email',prefix||'-'||i||'@example.invalid','role','student','institution_id',campus))
        INTO payload FROM generate_series(batch*100+1,batch*100+100) i;
      response:=core.provision_onboarding(payload);
      ASSERT jsonb_array_length(response)=100 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(response) r WHERE r->>'status'<>'success'), 'Capacity batch failed';
    END LOOP;
    elapsed_ms:=round(extract(epoch FROM clock_timestamp()-started)*1000,1);
    RESET ROLE;
    ASSERT (SELECT count(*)=2500 FROM core.users WHERE tenant_id=campus), 'Capacity user count';
    ASSERT (SELECT count(*)=2500 FROM core.user_invitations WHERE tenant_id=campus AND mail_state='queued'), 'Capacity invitation count';
    RAISE SQLSTATE 'ZX003' USING MESSAGE='rollback capacity fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX003' THEN NULL;
  END;
  PERFORM set_config('module2.benchmark',jsonb_build_object('users',2500,'batches',25,'database_elapsed_ms',elapsed_ms,'fixtures_rolled_back',true,'emails_sent',0)::text,true);
END;
$benchmark$;
SELECT current_setting('module2.benchmark')::jsonb AS capacity_result;

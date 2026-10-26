-- No permanent test data or emails: successful fixtures roll back.
DO $tests$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); empty_id uuid:=gen_random_uuid();
  admin_id uuid:=gen_random_uuid(); campus_admin uuid:=gen_random_uuid(); teacher_id uuid:=gen_random_uuid();
  student_id uuid:=gen_random_uuid(); public_id uuid:=gen_random_uuid(); target_id uuid:=gen_random_uuid();
  role_value text; actor_id uuid; affected integer; result jsonb;
BEGIN
  BEGIN
    ASSERT NOT has_table_privilege('authenticated','institution.institutions','TRUNCATE'),'Institution TRUNCATE bypass';
    ASSERT NOT has_table_privilege('anon','institution.institutions','SELECT'),'Anonymous institution access';
    ASSERT NOT has_table_privilege('authenticated','institution.institution_statuses','UPDATE'),'Client status catalog edits';
    ASSERT NOT has_function_privilege('anon','core.delete_managed_user(uuid)','EXECUTE'),'Anonymous user deletion';
    ASSERT NOT has_function_privilege('anon','public.get_all_teachers()','EXECUTE'),'Anonymous teacher directory';
    ASSERT NOT has_function_privilege('anon','public.get_tenant_teachers(uuid)','EXECUTE'),'Anonymous campus teacher directory';
    ASSERT NOT has_table_privilege('authenticated','academic.tenant_teachers','TRUNCATE'),'Teacher mapping TRUNCATE bypass';
    INSERT INTO institution.institutions(id,name,institution_code,institution_type) VALUES
      (a,'Module 03 rollback fixture',a::text,'college'),(b,'Module 03 rollback fixture',b::text,'college'),
      (empty_id,'Module 03 rollback fixture',empty_id::text,'school');
    INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data)
      SELECT id,id::text||'@example.invalid',now(),'{}'::jsonb FROM unnest(ARRAY[admin_id,campus_admin,teacher_id,student_id,public_id,target_id]) id;
    DELETE FROM core.user_roles WHERE user_id=ANY(ARRAY[admin_id,campus_admin,teacher_id,student_id,target_id]);
    INSERT INTO core.user_roles(user_id,role_id) SELECT admin_id,id FROM core.roles WHERE name='super_admin';
    INSERT INTO core.user_roles(user_id,role_id) SELECT campus_admin,id FROM core.roles WHERE name='institution_admin';
    INSERT INTO core.user_roles(user_id,role_id) SELECT teacher_id,id FROM core.roles WHERE name='teacher';
    INSERT INTO core.user_roles(user_id,role_id) SELECT user_id,id FROM core.roles CROSS JOIN unnest(ARRAY[student_id,target_id]) user_id WHERE name='student';
    UPDATE core.users SET tenant_id=a WHERE id=ANY(ARRAY[campus_admin,teacher_id,student_id,target_id]);
    FOREACH actor_id IN ARRAY ARRAY[campus_admin,teacher_id,student_id,public_id] LOOP
      PERFORM set_config('request.jwt.claim.sub',actor_id::text,true);
      SET LOCAL ROLE authenticated;
      BEGIN
        PERFORM core.delete_managed_user(target_id); RAISE EXCEPTION 'Non-super user can delete';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN
        PERFORM institution.delete_managed_institution(empty_id); RAISE EXCEPTION 'Non-super user can delete institution';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      UPDATE institution.institutions SET status='suspended' WHERE id=a;
      GET DIAGNOSTICS affected=ROW_COUNT;
      ASSERT affected=0,'Non-super role changes institution status';
      DELETE FROM core.users WHERE id=target_id;
      GET DIAGNOSTICS affected=ROW_COUNT;
      ASSERT affected=0,'Non-super role deletes user directly';
      ASSERT NOT EXISTS(SELECT 1 FROM institution.institutions WHERE id=b),'Cross-campus institution visibility';
      BEGIN
        PERFORM * FROM public.get_all_teachers(); RAISE EXCEPTION 'Non-super reads global teacher directory';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN
        INSERT INTO academic.tenant_teachers(user_id,tenant_id) VALUES(actor_id,b);
        RAISE EXCEPTION 'Non-super grants campus access';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN
        PERFORM * FROM public.get_tenant_teachers(b); RAISE EXCEPTION 'Cross-campus teacher directory';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      IF actor_id<>public_id THEN ASSERT EXISTS(SELECT 1 FROM institution.institutions WHERE id=a),'Own-campus institution visibility'; END IF;
      RESET ROLE;
    END LOOP;
    PERFORM set_config('request.jwt.claim.sub',campus_admin::text,true);
    SET LOCAL ROLE authenticated;
    BEGIN
      INSERT INTO institution.institution_admins(institution_id,user_id) VALUES(a,student_id);
      RAISE EXCEPTION 'Campus admin can delegate administrator mapping';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT EXISTS(SELECT 1 FROM institution.institutions WHERE id=b),'Super-admin global institution visibility';
    ASSERT EXISTS(SELECT 1 FROM public.get_all_teachers() WHERE id=teacher_id),'Super-admin teacher directory';
    BEGIN
      PERFORM core.delete_managed_user(admin_id); RAISE EXCEPTION 'Self deletion permitted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM='Self deletion permitted' THEN RAISE; END IF; END;
    BEGIN
      DELETE FROM core.user_roles WHERE user_id=admin_id AND role_id=(SELECT id FROM core.roles WHERE name='super_admin');
      RAISE EXCEPTION 'Own super-admin role removal permitted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM='Own super-admin role removal permitted' THEN RAISE; END IF; END;
    BEGIN
      UPDATE core.users SET status='suspended' WHERE id=admin_id;
      RAISE EXCEPTION 'Own super-admin suspension permitted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM='Own super-admin suspension permitted' THEN RAISE; END IF; END;
    BEGIN
      INSERT INTO institution.institutions(name,institution_code,institution_type) VALUES('Duplicate',upper(a::text),'college');
      RAISE EXCEPTION 'Case-variant institution code accepted';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
      UPDATE institution.institutions SET website='javascript:alert(1)' WHERE id=a;
      RAISE EXCEPTION 'Unsafe institution URL accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      PERFORM institution.delete_managed_institution(a); RAISE EXCEPTION 'Institution with users deleted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM='Institution with users deleted' THEN RAISE; END IF; END;
    result:=institution.delete_managed_institution(empty_id);
    ASSERT result->>'deleted'='true','Empty institution deletion';
    result:=core.delete_managed_user(target_id);
    ASSERT result->>'deleted'='true','Managed user deletion';
    RESET ROLE;
    ASSERT NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target_id),'Auth identity remains after deletion';
    ASSERT NOT EXISTS(SELECT 1 FROM core.users WHERE id=target_id),'Core user remains after deletion';
    ASSERT NOT EXISTS(SELECT 1 FROM core.user_roles WHERE user_id=target_id),'Role remains after deletion';
    ASSERT EXISTS(SELECT 1 FROM core.users WHERE id=student_id),'Unrelated student was deleted';
    ASSERT EXISTS(SELECT 1 FROM institution.institutions WHERE id=a),'Linked institution was deleted';
    -- A global teacher gets only explicitly mapped campus access.
    UPDATE core.users SET tenant_id=NULL WHERE id=teacher_id;
    INSERT INTO academic.tenant_teachers(user_id,tenant_id) VALUES(teacher_id,a);
    PERFORM set_config('request.jwt.claim.sub',teacher_id::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT EXISTS(SELECT 1 FROM institution.institutions WHERE id=a),'Mapped teacher cannot see campus';
    ASSERT NOT EXISTS(SELECT 1 FROM institution.institutions WHERE id=b),'Mapped teacher sees other campus';
    ASSERT EXISTS(SELECT 1 FROM public.get_tenant_teachers(a) WHERE id=teacher_id),'Mapped teacher directory';
    PERFORM * FROM public.get_teacher_programs(teacher_id);
    PERFORM * FROM public.get_teacher_institutions_and_programs(teacher_id);
    BEGIN
      PERFORM * FROM public.get_teacher_programs(campus_admin); RAISE EXCEPTION 'Teacher reads another identity mappings';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM * FROM public.get_tenant_teachers(b); RAISE EXCEPTION 'Global teacher reads unmapped campus';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    DELETE FROM academic.tenant_teachers WHERE user_id=teacher_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    ASSERT affected=0,'Teacher edits own access mapping';
    RESET ROLE;
    UPDATE institution.institutions SET status='suspended' WHERE id=a;
    PERFORM set_config('request.jwt.claim.sub',teacher_id::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT NOT EXISTS(SELECT 1 FROM public.get_teacher_programs(teacher_id)),'Teacher directory exposes suspended campus';
    ASSERT NOT EXISTS(SELECT 1 FROM public.get_teacher_institutions_and_programs(teacher_id)),'Teacher details expose suspended campus';
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub',student_id::text,true);
    SET LOCAL ROLE authenticated;
    ASSERT NOT EXISTS(SELECT 1 FROM core.get_current_user()),'Suspended campus remains authorized';
    RESET ROLE;
    UPDATE institution.institutions SET status='active' WHERE id=a;
    -- Other sessions keep seeing the committed roles; this transaction is rolled back below.
    PERFORM set_config('request.jwt.claim.sub','',true);
    DELETE FROM core.user_roles WHERE user_id<>admin_id AND role_id=(SELECT id FROM core.roles WHERE name='super_admin');
    BEGIN
      DELETE FROM core.user_roles WHERE user_id=admin_id AND role_id=(SELECT id FROM core.roles WHERE name='super_admin');
      RAISE EXCEPTION 'Last super-admin role removal permitted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The last active super administrator%' THEN RAISE; END IF; END;
    BEGIN
      UPDATE core.users SET status='suspended' WHERE id=admin_id;
      RAISE EXCEPTION 'Last super-admin suspension permitted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The last active super administrator%' THEN RAISE; END IF; END;
    RAISE SQLSTATE 'ZX006' USING MESSAGE='rollback successful fixtures';
  EXCEPTION WHEN SQLSTATE 'ZX006' THEN NULL;
  END;
END; $tests$;

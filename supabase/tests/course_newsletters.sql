BEGIN;
CREATE TEMP TABLE newsletter_test_ids(student_one uuid,student_two uuid,tenant_one uuid,tenant_two uuid,program_one uuid,program_two uuid,course_one uuid,course_two uuid,foreign_course uuid,cohort_id uuid) ON COMMIT DROP;
INSERT INTO newsletter_test_ids SELECT gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid();
GRANT SELECT ON newsletter_test_ids TO service_role;

DO $$
DECLARE ids record; active_status uuid; student_role uuid; audience_count integer; batch uuid; second_cohort uuid:=gen_random_uuid(); first_student uuid;
BEGIN
  SELECT * INTO ids FROM newsletter_test_ids;
  SELECT id INTO active_status FROM academic.statuses WHERE code='active';
  SELECT id INTO student_role FROM core.roles WHERE name='student';
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='learning' AND c.relname LIKE 'newsletter_%' AND c.relkind='r' AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'UPDATE'))) THEN RAISE EXCEPTION 'Newsletter tables are exposed'; END IF;
  IF has_function_privilege('anon','learning.newsletter_runtime()','EXECUTE') OR has_function_privilege('authenticated','learning.newsletter_configure_transport(jsonb)','EXECUTE') OR has_function_privilege('authenticated','newsletter_private.verified_recipient(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Privileged newsletter function is exposed'; END IF;

  INSERT INTO institution.institutions(id,name,institution_code,institution_type,status) VALUES
    (ids.tenant_one,'Newsletter test one',ids.tenant_one::text,'college','active'),
    (ids.tenant_two,'Newsletter test two',ids.tenant_two::text,'college','active');
  INSERT INTO core.users(id,email,tenant_id,status) VALUES
    (ids.student_one,ids.student_one::text||'@example.invalid',ids.tenant_one,'active'),
    (ids.student_two,ids.student_two::text||'@example.invalid',ids.tenant_one,'active');
  INSERT INTO core.user_roles(user_id,role_id) VALUES(ids.student_one,student_role),(ids.student_two,student_role);
  INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES
    (ids.student_one,ids.student_one::text||'@example.invalid',now(),'{}'),
    (ids.student_two,ids.student_two::text||'@example.invalid',now(),'{}');
  INSERT INTO academic.programs(id,tenant_id,institution_id,title,slug,status_id) VALUES
    (ids.program_one,ids.tenant_one,ids.tenant_one,'Newsletter program',ids.program_one::text,active_status),
    (ids.program_two,ids.tenant_two,ids.tenant_two,'Foreign program',ids.program_two::text,active_status);
  INSERT INTO academic.courses(id,program_id,tenant_id,institution_id,title,slug,status_id) VALUES
    (ids.course_one,ids.program_one,ids.tenant_one,ids.tenant_one,'Civil Engineering',ids.course_one::text,active_status),
    (ids.foreign_course,ids.program_two,ids.tenant_two,ids.tenant_two,'Foreign Tenant Course',ids.foreign_course::text,active_status);
  INSERT INTO delivery.cohorts(id,tenant_id,institution_id,program_id,name,code,status_code) VALUES(ids.cohort_id,ids.tenant_one,ids.tenant_one,ids.program_one,'Newsletter group',ids.cohort_id::text,'active');
  INSERT INTO delivery.enrollments(user_id,cohort_id,status_code) VALUES(ids.student_one,ids.cohort_id,'active'),(ids.student_two,ids.cohort_id,'active');
  INSERT INTO delivery.course_assignments(cohort_id,course_id) VALUES(ids.cohort_id,ids.course_one),(ids.cohort_id,ids.foreign_course);
  IF EXISTS (SELECT 1 FROM learning.newsletter_audience(ARRAY[ids.student_one,ids.student_two],true)) THEN RAISE EXCEPTION 'Students were enrolled in newsletters without consent'; END IF;
  INSERT INTO learning.newsletter_preferences(student_id,enabled,consent_at) VALUES(ids.student_one,true,now()),(ids.student_two,true,now());
  SELECT count(*) INTO audience_count FROM learning.newsletter_audience(ARRAY[ids.student_one,ids.student_two],true);
  IF audience_count<>2 THEN RAISE EXCEPTION 'Active enrolled subscribers not discovered'; END IF;
  IF EXISTS (SELECT 1 FROM learning.newsletter_members WHERE student_id=ids.student_one AND course_id=ids.foreign_course) THEN RAISE EXCEPTION 'Cross-tenant enrollment leak'; END IF;
  INSERT INTO delivery.cohorts(id,tenant_id,institution_id,program_id,name,code,status_code) VALUES(second_cohort,ids.tenant_one,ids.tenant_one,ids.program_one,'Second newsletter group',second_cohort::text,'active');
  INSERT INTO delivery.enrollments(user_id,cohort_id,status_code) VALUES(ids.student_two,second_cohort,'active');
  INSERT INTO delivery.course_assignments(cohort_id,course_id) VALUES(second_cohort,ids.course_one);
  IF (SELECT jsonb_array_length(courses) FROM learning.newsletter_audience(ARRAY[ids.student_two],true))<>1 THEN RAISE EXCEPTION 'Duplicate cohort enrollment duplicated a course topic'; END IF;
  UPDATE learning.newsletter_preferences SET last_considered_at=now() WHERE student_id=ids.student_one;
  SELECT student_id INTO first_student FROM learning.newsletter_audience(ARRAY[ids.student_one,ids.student_two],true,1);
  IF first_student<>ids.student_two THEN RAISE EXCEPTION 'Unconsidered subscribers are not prioritized'; END IF;

  INSERT INTO academic.courses(id,program_id,tenant_id,institution_id,title,slug,status_id) VALUES(ids.course_two,ids.program_one,ids.tenant_one,ids.tenant_one,'Nursing',ids.course_two::text,active_status);
  INSERT INTO delivery.course_assignments(cohort_id,course_id) VALUES(ids.cohort_id,ids.course_two);
  IF NOT EXISTS (SELECT 1 FROM learning.newsletter_members WHERE student_id=ids.student_one AND course_id=ids.course_two) THEN RAISE EXCEPTION 'New arbitrary course was not discovered'; END IF;
  DELETE FROM delivery.course_assignments WHERE cohort_id=ids.cohort_id AND course_id=ids.course_two;

  UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data||'{"shared_dashboard_login":true}'::jsonb WHERE id=ids.student_two;
  IF EXISTS (SELECT 1 FROM learning.newsletter_audience(ARRAY[ids.student_two],true)) THEN RAISE EXCEPTION 'Shared demo account included'; END IF;
  UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data- 'shared_dashboard_login' WHERE id=ids.student_two;
  UPDATE auth.users SET email_confirmed_at=NULL WHERE id=ids.student_one;
  IF EXISTS (SELECT 1 FROM learning.newsletter_audience(ARRAY[ids.student_one],true)) THEN RAISE EXCEPTION 'Unverified email included'; END IF;
  UPDATE auth.users SET email_confirmed_at=now() WHERE id=ids.student_one;
  UPDATE learning.newsletter_preferences SET enabled=false WHERE student_id=ids.student_one;
  IF EXISTS (SELECT 1 FROM learning.newsletter_audience(ARRAY[ids.student_one],true)) THEN RAISE EXCEPTION 'Opt-out ignored'; END IF;
  UPDATE learning.newsletter_preferences SET enabled=true WHERE student_id=ids.student_one;
  UPDATE delivery.enrollments SET status_code='completed' WHERE user_id=ids.student_one AND cohort_id=ids.cohort_id;
  IF EXISTS (SELECT 1 FROM learning.newsletter_audience(ARRAY[ids.student_one],true)) THEN RAISE EXCEPTION 'Inactive enrollment included'; END IF;
  UPDATE delivery.enrollments SET status_code='active' WHERE user_id=ids.student_one AND cohort_id=ids.cohort_id;
  UPDATE learning.newsletter_preferences SET suppressed_reason='hard bounce' WHERE student_id=ids.student_one;
  IF EXISTS (SELECT 1 FROM learning.newsletter_audience(ARRAY[ids.student_one],true)) THEN RAISE EXCEPTION 'Suppression ignored'; END IF;
  UPDATE learning.newsletter_preferences SET suppressed_reason=NULL WHERE student_id=ids.student_one;
  UPDATE learning.newsletter_settings SET enabled=true,daily_limit=(SELECT count(*)+1 FROM learning.newsletter_deliveries WHERE day=(now() AT TIME ZONE 'Asia/Kolkata')::date),lease_owner=NULL,lease_until=NULL WHERE id;
  IF NOT learning.newsletter_claim(ids.student_one) OR learning.newsletter_claim(ids.student_two) THEN RAISE EXCEPTION 'Worker lease allowed overlapping jobs'; END IF;
  batch:=learning.newsletter_prepare_batch(ARRAY[ids.student_one,ids.student_two],jsonb_build_array(jsonb_build_object('courseId',ids.course_one,'title','Civil Engineering','articles','[]'::jsonb)));
  IF batch IS NULL OR (SELECT count(*) FROM learning.newsletter_deliveries WHERE batch_id=batch)<>1 THEN RAISE EXCEPTION 'Daily quota not enforced atomically'; END IF;
  IF learning.newsletter_prepare_batch(ARRAY[ids.student_one,ids.student_two],jsonb_build_array(jsonb_build_object('courseId',ids.course_one))) IS NOT NULL THEN RAISE EXCEPTION 'Second reservation bypassed quota'; END IF;
  UPDATE learning.newsletter_settings SET enabled=false,lease_until=NULL WHERE id;
  IF learning.newsletter_claim(ids.student_one) THEN RAISE EXCEPTION 'Paused worker still ran'; END IF;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE ids record;
BEGIN
  SELECT * INTO ids FROM newsletter_test_ids;
  IF NOT EXISTS (SELECT 1 FROM learning.newsletter_members WHERE student_id=ids.student_one) THEN RAISE EXCEPTION 'Service-role membership query failed'; END IF;
  IF (SELECT count(*) FROM learning.newsletter_audience(ARRAY[ids.student_one,ids.student_two],true))<>2 THEN RAISE EXCEPTION 'Service-role audience query failed'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;

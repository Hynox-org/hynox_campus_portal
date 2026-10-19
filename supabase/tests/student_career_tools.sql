-- Run explicitly against a development project with at least two existing active student accounts.
-- All fixtures are rolled back. This does not change accounts, coursework, or saved documents.
BEGIN;
CREATE TEMP TABLE career_test_people ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY u.id) AS n,u.id,u.auth_user_id,u.tenant_id
FROM core.users u WHERE u.status='active' AND u.deleted_at IS NULL AND u.auth_user_id IS NOT NULL
AND EXISTS (SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='student');
DO $$ BEGIN IF (SELECT count(*) FROM career_test_people)<2 THEN RAISE EXCEPTION 'Two active students are required'; END IF; END $$;
CREATE TEMP TABLE career_test_ids(id uuid,scan_id uuid) ON COMMIT DROP;
INSERT INTO career_test_ids VALUES(gen_random_uuid(),gen_random_uuid());
GRANT SELECT ON career_test_people,career_test_ids TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM career_test_people WHERE n=1),true),
set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_user_id FROM career_test_people WHERE n=1),'role','authenticated')::text,true),
set_config('request.headers',json_build_object('x-campus-dashboard-role',(SELECT auth_user_id::text||':student' FROM career_test_people WHERE n=1))::text,true);
INSERT INTO learning.student_resumes(id,student_id,tenant_id,title,content)
SELECT t.id,p.id,p.tenant_id,'Career test - rolled back','{"basics":{},"sections":[]}'::jsonb
FROM career_test_people p CROSS JOIN career_test_ids t WHERE p.n=1;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM learning.student_resumes WHERE id=(SELECT id FROM career_test_ids)) THEN RAISE EXCEPTION 'Owner read failed'; END IF;
 UPDATE learning.student_resumes SET title='Updated',version=2 WHERE id=(SELECT id FROM career_test_ids) AND version=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner update failed'; END IF;
 UPDATE learning.student_resumes SET title='Stale',version=2 WHERE id=(SELECT id FROM career_test_ids) AND version=1;
 IF FOUND THEN RAISE EXCEPTION 'Stale write allowed'; END IF;
 BEGIN
  UPDATE learning.student_resumes SET student_id=(SELECT id FROM career_test_people WHERE n=2),version=3 WHERE id=(SELECT id FROM career_test_ids);
  RAISE EXCEPTION 'Ownership change allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Ownership change allowed' THEN RAISE; END IF; END;
 BEGIN
  UPDATE learning.student_resumes SET version=3,content='{"basics":{},"sections":[{"entries":[{"sourceKey":"course:00000000-0000-0000-0000-000000000000"}]}]}'::jsonb WHERE id=(SELECT id FROM career_test_ids);
  RAISE EXCEPTION 'Forged course allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Forged course allowed' THEN RAISE; END IF; END;
END $$;
INSERT INTO learning.resume_scans(id,student_id,tenant_id,resume_id,resume_version,label,fingerprint,report)
SELECT t.scan_id,p.id,p.tenant_id,t.id,2,'Test scan',repeat('a',64),'{}'::jsonb
FROM career_test_people p CROSS JOIN career_test_ids t WHERE p.n=1;
SELECT set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM career_test_people WHERE n=2),true),
set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_user_id FROM career_test_people WHERE n=2),'role','authenticated')::text,true),
set_config('request.headers',json_build_object('x-campus-dashboard-role',(SELECT auth_user_id::text||':student' FROM career_test_people WHERE n=2))::text,true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM learning.student_resumes WHERE id=(SELECT id FROM career_test_ids)) THEN RAISE EXCEPTION 'Cross-student read allowed'; END IF;
 IF EXISTS (SELECT 1 FROM learning.resume_scans WHERE id=(SELECT scan_id FROM career_test_ids)) THEN RAISE EXCEPTION 'Cross-student scan read allowed'; END IF;
 UPDATE learning.student_resumes SET title='Other student overwrite',version=3 WHERE id=(SELECT id FROM career_test_ids);
 IF FOUND THEN RAISE EXCEPTION 'Cross-student update allowed'; END IF;
 DELETE FROM learning.student_resumes WHERE id=(SELECT id FROM career_test_ids);
 IF FOUND THEN RAISE EXCEPTION 'Cross-student delete allowed'; END IF;
 BEGIN
  INSERT INTO learning.student_resumes(student_id,tenant_id,title,content) SELECT id,tenant_id,'Forged','{"basics":{},"sections":[]}' FROM career_test_people WHERE n=1;
  RAISE EXCEPTION 'Cross-student insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM career_test_people WHERE n=1),true),
set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_user_id FROM career_test_people WHERE n=1),'role','authenticated')::text,true),
set_config('request.headers',json_build_object('x-campus-dashboard-role',(SELECT auth_user_id::text||':student' FROM career_test_people WHERE n=1))::text,true);
DO $$ BEGIN
 DELETE FROM learning.student_resumes WHERE id=(SELECT id FROM career_test_ids);
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner delete failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM learning.resume_scans WHERE id=(SELECT scan_id FROM career_test_ids) AND resume_id IS NULL) THEN RAISE EXCEPTION 'Scan history was lost when document deleted'; END IF;
 DELETE FROM learning.resume_scans WHERE id=(SELECT scan_id FROM career_test_ids);
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner report delete failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_table_privilege('anon','learning.student_resumes','SELECT') OR has_table_privilege('anon','learning.resume_scans','INSERT') THEN RAISE EXCEPTION 'Anonymous access granted'; END IF;
 IF NOT (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('learning.student_resumes'::regclass,'learning.resume_scans'::regclass)) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
END $$;
ROLLBACK;

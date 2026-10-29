-- Run using a privileged SQL connection; all synthetic accounts and data are rolled back.
BEGIN;
CREATE OR REPLACE FUNCTION library.duplicate_course_template(p_template_id uuid, p_program_id uuid, p_tenant_id uuid, p_institution_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog
AS $function$
DECLARE
  v_new_course_id UUID;
  v_mod RECORD;
  v_les RECORD;
  v_new_mod_id UUID;
  v_new_les_id UUID;
  v_seq INT;
BEGIN

  -- Authorization must live in the RPC: callers can bypass server actions.
  IF NOT EXISTS (SELECT 1 FROM core.get_current_user() cu
    WHERE cu.user_id = p_user_id AND 'super_admin' = ANY(cu.roles)) THEN
    RAISE EXCEPTION 'Access denied. Super Admin privileges required.' USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_institution_id IS DISTINCT FROM p_tenant_id OR NOT EXISTS (
    SELECT 1 FROM academic.programs p JOIN institution.institutions i ON i.id=p.institution_id
    WHERE p.id=p_program_id AND p.tenant_id=p_tenant_id AND p.institution_id=p_institution_id
      AND p.deleted_at IS NULL AND i.status NOT IN ('inactive','suspended')
  ) THEN
    RAISE EXCEPTION 'Invalid or inaccessible target campus/program.';
  END IF;
  -- Serialize retries per program, so concurrent requests cannot clone twice.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_program_id::text, 4));
  IF NOT EXISTS (SELECT 1 FROM library.course_templates WHERE id=p_template_id
    AND deleted_at IS NULL AND is_published) THEN
    RAISE EXCEPTION 'Publish the blueprint before copying it.';
  END IF;
  IF EXISTS (SELECT 1 FROM academic.courses c JOIN library.course_templates ct ON ct.id=p_template_id
    WHERE c.program_id=p_program_id AND c.deleted_at IS NULL
      AND (c.source_template_id=p_template_id OR c.slug=ct.slug)) THEN
    RAISE EXCEPTION 'This blueprint or course slug already exists in the target program.';
  END IF;
  -- 1. Insert new course in academic.courses
  INSERT INTO academic.courses (
    program_id,
    tenant_id,
    institution_id,
    title,
    slug,
    description,
    course_type_id,
    enrollment_mode,
    duration_minutes,
    thumbnail_path,
    source_template_id,
    created_by,
    updated_by,
    status_id,
    visibility_type_id
  )
  SELECT 
    p_program_id,
    p_tenant_id,
    p_institution_id,
    ct.title,
    ct.slug,
    ct.description,
    (SELECT id FROM academic.course_types WHERE code = ct.course_type_code),
    ct.enrollment_mode,
    ct.duration_minutes,
    ct.thumbnail_path,
    ct.id,
    p_user_id,
    p_user_id,
    academic.get_status_id_by_code('draft'),
    academic.get_visibility_type_id_by_code('private')
  FROM library.course_templates ct
  WHERE ct.id = p_template_id AND ct.deleted_at IS NULL
  RETURNING id INTO v_new_course_id;

  IF v_new_course_id IS NULL THEN
    RAISE EXCEPTION 'Course template not found, deleted, or failed to duplicate';
  END IF;

  -- 2. Loop through module templates
  v_seq := 1;
  FOR v_mod IN 
    SELECT * FROM library.module_templates 
    WHERE course_template_id = p_template_id AND deleted_at IS NULL
    ORDER BY position ASC, created_at ASC, id ASC
  LOOP
    -- Insert new module
    INSERT INTO academic.modules (
      course_id,
      tenant_id,
      institution_id,
      title,
      description,
      position,
      status_id,
      created_by,
      updated_by
    )
    VALUES (
      v_new_course_id,
      p_tenant_id,
      p_institution_id,
      v_mod.title,
      v_mod.description,
      v_seq,
      academic.get_status_id_by_code('active'),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_new_mod_id;
    
    v_seq := v_seq + 1;

    -- Loop through lesson templates in this module template
    DECLARE
      v_les_seq INT := 1;
    BEGIN
      FOR v_les IN 
        SELECT * FROM library.lesson_templates 
        WHERE module_template_id = v_mod.id AND deleted_at IS NULL
        ORDER BY position ASC, created_at ASC, id ASC
      LOOP
        -- Insert new lesson
        INSERT INTO academic.lessons (
          module_id,
          tenant_id,
          institution_id,
          title,
          lesson_type_id,
          content_json,
          video_url,
          duration,
          position,
          is_preview,
          status_id,
          created_by,
          updated_by
        )
        VALUES (
          v_new_mod_id,
          p_tenant_id,
          p_institution_id,
          v_les.title,
          (SELECT id FROM academic.lesson_types WHERE code = v_les.lesson_type_code),
          v_les.content_json,
          v_les.video_url,
          v_les.duration,
          v_les_seq,
          v_les.is_preview,
          academic.get_status_id_by_code('active'),
          p_user_id,
          p_user_id
        )
        RETURNING id INTO v_new_les_id;
        
        v_les_seq := v_les_seq + 1;

        -- Insert lesson resource templates in this lesson template
        DECLARE
          v_res_seq INT := 1;
        BEGIN
          INSERT INTO academic.lesson_resources (
            lesson_id,
            tenant_id,
            institution_id,
            resource_type_code,
            resource_url,
            title,
            position,
            created_by
          )
          SELECT 
            v_new_les_id,
            p_tenant_id,
            p_institution_id,
            rt.resource_type,
            COALESCE(rt.file_url, rt.external_url, ''),
            rt.title,
            rt.position, -- Keep original or ordered sequence
            p_user_id
          FROM library.resource_templates rt
          WHERE rt.lesson_template_id = v_les.id AND rt.deleted_at IS NULL
          ORDER BY rt.position ASC, rt.created_at ASC, rt.id ASC;
        END;

      END LOOP;
    END;
  END LOOP;

  RETURN v_new_course_id;
END;
$function$;

REVOKE ALL ON FUNCTION library.duplicate_course_template(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION library.duplicate_course_template(uuid,uuid,uuid,uuid,uuid) TO authenticated;

-- Prevent duplicate live blueprint slugs, including concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS course_templates_live_slug_unique ON library.course_templates(slug) WHERE deleted_at IS NULL;

CREATE TEMP TABLE module4_ids AS SELECT gen_random_uuid() AS admin, gen_random_uuid() AS student,
 gen_random_uuid() AS campus, gen_random_uuid() AS other_campus, gen_random_uuid() AS program,
 gen_random_uuid() AS blueprint, gen_random_uuid() AS module, gen_random_uuid() AS lesson;
GRANT SELECT ON module4_ids TO authenticated;
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
 SELECT admin,'m4-'||admin||'@example.invalid','{}'::jsonb,'{}'::jsonb FROM module4_ids
 UNION ALL SELECT student,'m4-'||student||'@example.invalid','{}'::jsonb,'{}'::jsonb FROM module4_ids;
INSERT INTO core.user_roles(user_id,role_id) SELECT admin,r.id FROM module4_ids,core.roles r WHERE r.name='super_admin';
INSERT INTO core.user_roles(user_id,role_id) SELECT student,r.id FROM module4_ids,core.roles r WHERE r.name='student';
INSERT INTO institution.institutions(id,name,institution_code,institution_type,status)
 SELECT campus,'Module 4 synthetic',campus::text,'college','active' FROM module4_ids
 UNION ALL SELECT other_campus,'Module 4 other synthetic',other_campus::text,'college','active' FROM module4_ids;
INSERT INTO academic.programs(id,tenant_id,institution_id,title,slug)
 SELECT program,campus,campus,'Synthetic program','m4-program' FROM module4_ids;
INSERT INTO library.course_templates(id,title,slug,is_published,course_type_code,enrollment_mode)
 SELECT blueprint,'Synthetic blueprint','m4-blueprint',true,'theory','open' FROM module4_ids;
INSERT INTO library.module_templates(id,course_template_id,title,position)
 SELECT module,blueprint,'Synthetic module',3 FROM module4_ids;
INSERT INTO library.lesson_templates(id,module_template_id,title,lesson_type_code,content_json,duration,position)
 SELECT lesson,module,'Synthetic lesson','text','{"body":"Synthetic content"}',0,7 FROM module4_ids;
INSERT INTO library.resource_templates(lesson_template_id,title,resource_type,external_url,position)
 SELECT lesson,'Synthetic resource','link','https://example.invalid/resource',4 FROM module4_ids;

SET LOCAL ROLE authenticated;
DO $test$
DECLARE f record; copied uuid; n integer;
BEGIN
 SELECT * INTO f FROM module4_ids;

 PERFORM set_config('request.jwt.claim.sub',f.student::text,true);
 IF NOT EXISTS(SELECT 1 FROM library.course_templates WHERE id=f.blueprint) THEN RAISE EXCEPTION 'TEST FAILED: published blueprint hidden'; END IF;
 UPDATE library.course_templates SET title='Unauthorized edit' WHERE id=f.blueprint;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'TEST FAILED: student edited blueprint'; END IF;
 BEGIN
   INSERT INTO library.module_templates(course_template_id,title,position) VALUES(f.blueprint,'Unauthorized',1);
   RAISE EXCEPTION 'TEST FAILED: student inserted module';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 BEGIN
   PERFORM library.duplicate_course_template(f.blueprint,f.program,f.campus,f.campus,f.admin);
   RAISE EXCEPTION 'TEST FAILED: student copied';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('request.jwt.claim.sub',f.admin::text,true);
 BEGIN
   PERFORM library.duplicate_course_template(f.blueprint,f.program,f.campus,f.campus,f.student);
   RAISE EXCEPTION 'TEST FAILED: spoofed actor accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM library.duplicate_course_template(f.blueprint,f.program,f.other_campus,f.other_campus,f.admin);
   RAISE EXCEPTION 'TEST FAILED: cross-campus accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid or inaccessible target campus/program.' THEN RAISE; END IF;
 END;

 BEGIN
   INSERT INTO library.course_templates(title,slug) VALUES('Duplicate','m4-blueprint');
   RAISE EXCEPTION 'TEST FAILED: duplicate blueprint slug';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 UPDATE library.course_templates SET is_published=false WHERE id=f.blueprint;
 PERFORM set_config('request.jwt.claim.sub',f.student::text,true);
 IF EXISTS(SELECT 1 FROM library.course_templates WHERE id=f.blueprint)
 OR EXISTS(SELECT 1 FROM library.module_templates WHERE id=f.module)
 OR EXISTS(SELECT 1 FROM library.lesson_templates WHERE id=f.lesson)
 OR EXISTS(SELECT 1 FROM library.resource_templates WHERE lesson_template_id=f.lesson)
 THEN RAISE EXCEPTION 'TEST FAILED: draft curriculum leaked'; END IF;
 PERFORM set_config('request.jwt.claim.sub',f.admin::text,true);

 BEGIN
   PERFORM library.duplicate_course_template(f.blueprint,f.program,f.campus,f.campus,f.admin);
   RAISE EXCEPTION 'TEST FAILED: draft copied';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Publish the blueprint before copying it.' THEN RAISE; END IF;
 END;
 UPDATE library.course_templates SET is_published=true WHERE id=f.blueprint;

 BEGIN
   PERFORM library.duplicate_course_template(gen_random_uuid(),f.program,f.campus,f.campus,f.admin);
   RAISE EXCEPTION 'TEST FAILED: missing template accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Publish the blueprint before copying it.' THEN RAISE; END IF;
 END;
 UPDATE library.course_templates SET deleted_at=now() WHERE id=f.blueprint;
 BEGIN
   PERFORM library.duplicate_course_template(f.blueprint,f.program,f.campus,f.campus,f.admin);
   RAISE EXCEPTION 'TEST FAILED: deleted blueprint accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Publish the blueprint before copying it.' THEN RAISE; END IF;
 END;
 UPDATE library.course_templates SET deleted_at=null WHERE id=f.blueprint;
 copied := library.duplicate_course_template(f.blueprint,f.program,f.campus,f.campus,f.admin);
 IF copied IS NULL THEN RAISE EXCEPTION 'TEST FAILED: missing copy'; END IF;
 BEGIN
   PERFORM library.duplicate_course_template(f.blueprint,f.program,f.campus,f.campus,f.admin);
   RAISE EXCEPTION 'TEST FAILED: retry copied twice';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'This blueprint or course slug already exists in the target program.' THEN RAISE; END IF;
 END;
END;
$test$;
RESET ROLE;
DO $test$
DECLARE f record;
BEGIN
 SELECT * INTO f FROM module4_ids;
 IF (SELECT count(*) FROM academic.courses WHERE program_id=f.program) <> 1 THEN RAISE EXCEPTION 'TEST FAILED: course count'; END IF;
 IF NOT EXISTS (SELECT 1 FROM academic.lessons l JOIN academic.modules m ON m.id=l.module_id
 JOIN academic.courses c ON c.id=m.course_id WHERE c.program_id=f.program AND l.duration=0
 AND l.content_json->>'body'='Synthetic content' AND l.position=1 AND m.position=1
 AND l.tenant_id=f.campus AND l.institution_id=f.campus) THEN RAISE EXCEPTION 'TEST FAILED: curriculum copy'; END IF;
 IF NOT EXISTS (SELECT 1 FROM academic.lesson_resources r JOIN academic.lessons l ON l.id=r.lesson_id
 JOIN academic.modules m ON m.id=l.module_id JOIN academic.courses c ON c.id=m.course_id
 WHERE c.program_id=f.program AND r.resource_url='https://example.invalid/resource' AND r.position=4)
 THEN RAISE EXCEPTION 'TEST FAILED: resource copy'; END IF;
END;
$test$;
SELECT 'passed: student denied, actor spoof denied, campus mismatch denied, draft denied, valid copy, retry denied, curriculum and resources preserved' AS result;

ROLLBACK;

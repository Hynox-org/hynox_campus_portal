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


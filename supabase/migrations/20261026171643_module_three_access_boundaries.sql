-- Campus mappings are authorization data: ordinary users must not grant themselves access.
ALTER TABLE academic.tenant_teachers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON academic.tenant_teachers FROM anon;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON academic.tenant_teachers FROM authenticated;
CREATE POLICY tenant_teachers_read ON academic.tenant_teachers FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)
  OR cu.user_id=tenant_teachers.user_id
  OR ('institution_admin'=ANY(cu.roles) AND cu.tenant_id=tenant_teachers.tenant_id)));
CREATE POLICY tenant_teachers_manage ON academic.tenant_teachers FOR ALL TO authenticated
USING(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)))
WITH CHECK(EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)));

CREATE OR REPLACE FUNCTION core.get_current_user()
RETURNS TABLE(user_id uuid,tenant_id uuid,roles text[],status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=core,auth,pg_catalog AS $$
  WITH identity AS (
    SELECT u.id,u.tenant_id,u.status,
      coalesce(array_agg(r.name) FILTER(WHERE r.name IS NOT NULL AND (
        coalesce(a.raw_app_meta_data->>'shared_dashboard_login','false')<>'true'
        OR coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb
          ->>'x-campus-dashboard-role'=a.id::text||':'||r.name
      )), '{}'::text[]) AS roles
    FROM core.users u JOIN auth.users a ON a.id=u.auth_user_id
    LEFT JOIN core.user_roles ur ON ur.user_id=u.id LEFT JOIN core.roles r ON r.id=ur.role_id
    WHERE u.auth_user_id=auth.uid() AND u.deleted_at IS NULL AND u.status='active'
    GROUP BY u.id,u.tenant_id,u.status
  )
  SELECT i.id,i.tenant_id,i.roles,i.status FROM identity i
  WHERE 'super_admin'=ANY(i.roles) OR i.tenant_id IS NULL OR EXISTS(
    SELECT 1 FROM institution.institutions campus WHERE campus.id=i.tenant_id
      AND campus.status NOT IN('inactive','suspended'));
$$;

CREATE OR REPLACE FUNCTION academic.get_all_teachers()
RETURNS TABLE(id uuid,full_name text,email text,tenant_id uuid,mapped_tenant_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core,academic AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT u.id,u.full_name,u.email,u.tenant_id,
    coalesce((SELECT array_agg(tt.tenant_id ORDER BY tt.tenant_id) FROM academic.tenant_teachers tt WHERE tt.user_id=u.id),'{}'::uuid[])
  FROM core.users u WHERE u.deleted_at IS NULL AND EXISTS(
    SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id
    WHERE ur.user_id=u.id AND r.name IN('teacher','trainer')) ORDER BY u.full_name,u.id;
END $$;
CREATE OR REPLACE FUNCTION public.get_all_teachers()
RETURNS TABLE(id uuid,full_name text,email text,tenant_id uuid,mapped_tenant_ids uuid[])
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT * FROM academic.get_all_teachers(); $$;

CREATE OR REPLACE FUNCTION academic.get_tenant_teachers(p_tenant_id uuid)
RETURNS TABLE(id uuid,full_name text,email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core,academic,institution AS $$
DECLARE actor record;
BEGIN
  SELECT * INTO actor FROM core.get_current_user();
  IF actor.user_id IS NULL OR NOT (
    'super_admin'=ANY(actor.roles) OR (
      actor.roles && ARRAY['institution_admin','teacher','trainer'] AND
      EXISTS(SELECT 1 FROM institution.institutions i WHERE i.id=p_tenant_id AND i.status NOT IN('inactive','suspended')) AND (
        coalesce(actor.tenant_id=p_tenant_id,false)
        OR EXISTS(SELECT 1 FROM academic.tenant_teachers tt WHERE tt.user_id=actor.user_id AND tt.tenant_id=p_tenant_id)
        OR EXISTS(SELECT 1 FROM academic.course_instructors ci WHERE ci.user_id=actor.user_id AND ci.tenant_id=p_tenant_id)
        OR EXISTS(SELECT 1 FROM delivery.cohort_teachers ct JOIN delivery.cohorts c ON c.id=ct.cohort_id
          WHERE ct.teacher_id=actor.user_id AND c.tenant_id=p_tenant_id AND c.deleted_at IS NULL)
      )
    )
  ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT u.id,u.full_name,u.email FROM core.users u
  WHERE u.deleted_at IS NULL AND (u.tenant_id=p_tenant_id OR EXISTS(
    SELECT 1 FROM academic.tenant_teachers tt WHERE tt.user_id=u.id AND tt.tenant_id=p_tenant_id))
  AND EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id
    WHERE ur.user_id=u.id AND r.name IN('teacher','trainer')) ORDER BY u.full_name,u.id;
END $$;
CREATE OR REPLACE FUNCTION public.get_tenant_teachers(p_tenant_id uuid)
RETURNS TABLE(id uuid,full_name text,email text)
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT * FROM academic.get_tenant_teachers(p_tenant_id); $$;

-- Keep the existing detail response, but authorize its subject before its definer query runs.
DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.get_teacher_institutions_and_programs(uuid)'::regprocedure) INTO definition;
  definition:=replace(definition,E'BEGIN\n',E'BEGIN\n  IF NOT EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE ''super_admin''=ANY(cu.roles) OR (cu.user_id=p_teacher_id AND cu.roles && ARRAY[''teacher'',''trainer''])) THEN RAISE EXCEPTION ''Access denied'' USING ERRCODE=''42501''; END IF;\n');
  EXECUTE definition;
END $migration$;
ALTER FUNCTION public.get_teacher_institutions_and_programs(uuid) SET search_path=pg_catalog,core,academic,institution;

CREATE OR REPLACE FUNCTION public.get_teacher_programs(p_teacher_id uuid)
RETURNS TABLE(institution_id uuid,institution_name text,program_id uuid,program_name text,program_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core,academic,institution AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM core.get_current_user() cu WHERE 'super_admin'=ANY(cu.roles)
    OR (cu.user_id=p_teacher_id AND cu.roles && ARRAY['teacher','trainer'])) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
  END IF;
  RETURN QUERY WITH campuses AS (
    SELECT u.tenant_id AS id FROM core.users u WHERE u.id=p_teacher_id AND u.deleted_at IS NULL
    UNION SELECT tt.tenant_id FROM academic.tenant_teachers tt WHERE tt.user_id=p_teacher_id
    UNION SELECT ci.tenant_id FROM academic.course_instructors ci WHERE ci.user_id=p_teacher_id
  )
  SELECT DISTINCT i.id,i.name,p.id,p.title,s.code
  FROM campuses m JOIN institution.institutions i ON i.id=m.id
  LEFT JOIN academic.course_instructors ci ON ci.user_id=p_teacher_id AND ci.tenant_id=i.id
  LEFT JOIN academic.courses c ON c.id=ci.course_id AND c.deleted_at IS NULL
  LEFT JOIN academic.programs p ON p.id=c.program_id AND p.deleted_at IS NULL
  LEFT JOIN academic.statuses s ON s.id=p.status_id;
END $$;

DO $migration$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['academic.get_all_teachers()','public.get_all_teachers()',
    'academic.get_tenant_teachers(uuid)','public.get_tenant_teachers(uuid)',
    'public.get_teacher_programs(uuid)','public.get_teacher_institutions_and_programs(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',signature);
  END LOOP;
END $migration$;

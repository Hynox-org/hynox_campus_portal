-- Career documents live with the existing learning domain; student identity remains in core.users.
CREATE TABLE learning.student_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES institution.institutions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  template text NOT NULL DEFAULT 'classic' CHECK (template IN ('classic','modern')),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object' AND jsonb_typeof(content->'basics')='object' AND jsonb_typeof(content->'sections')='array' AND octet_length(content::text) <= 200000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, student_id)
);
CREATE INDEX student_resumes_owner_updated ON learning.student_resumes(student_id, updated_at DESC);
CREATE INDEX student_resumes_tenant ON learning.student_resumes(tenant_id);

CREATE TABLE learning.resume_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES institution.institutions(id) ON DELETE CASCADE,
  resume_id uuid,
  resume_version integer CHECK (resume_version > 0),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  report jsonb NOT NULL CHECK (jsonb_typeof(report)='object' AND octet_length(report::text) <= 40000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (resume_id,student_id) REFERENCES learning.student_resumes(id,student_id) ON DELETE SET NULL (resume_id)
);
CREATE INDEX resume_scans_owner_created ON learning.resume_scans(student_id, created_at DESC);
CREATE INDEX resume_scans_document ON learning.resume_scans(resume_id,student_id);
CREATE INDEX resume_scans_tenant ON learning.resume_scans(tenant_id);

ALTER TABLE learning.student_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.resume_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning.student_resumes, learning.resume_scans FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON learning.student_resumes TO authenticated;
GRANT SELECT,INSERT,DELETE ON learning.resume_scans TO authenticated;
GRANT ALL ON learning.student_resumes, learning.resume_scans TO service_role;

CREATE POLICY own_resumes ON learning.student_resumes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE cu.user_id=student_id AND cu.tenant_id IS NOT DISTINCT FROM student_resumes.tenant_id AND cu.status='active' AND 'student'=ANY(cu.roles)))
WITH CHECK (EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE cu.user_id=student_id AND cu.tenant_id IS NOT DISTINCT FROM student_resumes.tenant_id AND cu.status='active' AND 'student'=ANY(cu.roles)));
CREATE POLICY own_scans ON learning.resume_scans FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE cu.user_id=student_id AND cu.tenant_id IS NOT DISTINCT FROM resume_scans.tenant_id AND cu.status='active' AND 'student'=ANY(cu.roles)))
WITH CHECK (EXISTS (SELECT 1 FROM core.get_current_user() cu WHERE cu.user_id=student_id AND cu.tenant_id IS NOT DISTINCT FROM resume_scans.tenant_id AND cu.status='active' AND 'student'=ANY(cu.roles)));

CREATE FUNCTION learning.resume_learning_items()
RETURNS TABLE(source_key text,kind text,title text,subtitle text,completed_at timestamptz,url text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH me AS (SELECT user_id,tenant_id FROM core.get_current_user() WHERE status='active' AND 'student'=ANY(roles))
  SELECT 'course:'||c.id::text,'courses',c.title,'Hynox Campus course',cp.completed_at,''::text
  FROM me JOIN delivery.course_progress cp ON cp.user_id=me.user_id
  JOIN academic.courses c ON c.id=cp.course_id AND c.deleted_at IS NULL
  WHERE cp.status_code='completed' AND cp.progress_percentage=100 AND cp.completed_at IS NOT NULL
    AND c.institution_id IS NOT DISTINCT FROM me.tenant_id
    AND EXISTS (SELECT 1 FROM delivery.enrollments e JOIN delivery.cohorts co ON co.id=e.cohort_id JOIN delivery.course_assignments ca ON ca.cohort_id=co.id
      WHERE e.user_id=me.user_id AND e.deleted_at IS NULL AND e.status_code IN ('active','completed') AND co.deleted_at IS NULL AND co.institution_id IS NOT DISTINCT FROM me.tenant_id AND ca.course_id=c.id AND ca.deleted_at IS NULL)
  UNION ALL
  SELECT 'project:'||s.id::text,'projects',a.title,'Hynox Campus project',review.reviewed_at,coalesce(s.github_url,'')
  FROM me JOIN learning.project_submissions s ON s.student_id=me.user_id
  JOIN learning.projects p ON p.id=s.project_id
  JOIN learning.activities a ON a.id=p.activity_id AND a.deleted_at IS NULL
  JOIN LATERAL (SELECT pr.review_status,pr.reviewed_at FROM learning.project_reviews pr WHERE pr.submission_id=s.id ORDER BY pr.reviewed_at DESC,pr.id DESC LIMIT 1) review ON review.review_status='approved'
  WHERE a.institution_id IS NOT DISTINCT FROM me.tenant_id;
$$;
REVOKE ALL ON FUNCTION learning.resume_learning_items() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning.resume_learning_items() TO authenticated;

CREATE FUNCTION learning.validate_student_resume()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE section jsonb; entry jsonb; v_source_key text; seen text[] := '{}';
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.student_id<>OLD.student_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id<>OLD.id OR NEW.created_at<>OLD.created_at THEN
      RAISE EXCEPTION 'Document ownership cannot be changed';
    END IF;
    IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Reload this resume before saving'; END IF;
  ELSIF NEW.version<>1 THEN RAISE EXCEPTION 'New resumes must start at version one';
  END IF;
  IF coalesce(jsonb_typeof(NEW.content->'basics'),'null')<>'object' OR coalesce(jsonb_typeof(NEW.content->'sections'),'null')<>'array' OR jsonb_array_length(NEW.content->'sections')>12 THEN RAISE EXCEPTION 'Invalid resume content'; END IF;
  FOR section IN SELECT value FROM jsonb_array_elements(NEW.content->'sections') LOOP
    IF coalesce(jsonb_typeof(section->'entries'),'null')<>'array' OR jsonb_array_length(section->'entries')>50 THEN RAISE EXCEPTION 'Invalid resume entries'; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(section->'entries') LOOP
      v_source_key := entry->>'sourceKey';
      IF v_source_key IS NOT NULL THEN
        IF v_source_key=ANY(seen) THEN RAISE EXCEPTION 'Learning item already added'; END IF;
        seen := array_append(seen,v_source_key);
        -- Existing links retain their snapshot when a syllabus is changed later.
        IF NOT EXISTS (SELECT 1 FROM learning.resume_learning_items() li WHERE li.source_key=v_source_key)
          AND NOT (TG_OP='UPDATE' AND EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.content->'sections') os CROSS JOIN LATERAL jsonb_array_elements(os->'entries') oe WHERE oe->>'sourceKey'=v_source_key)) THEN
          RAISE EXCEPTION 'This learning item is not completed or does not belong to you';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  NEW.updated_at:=clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION learning.validate_student_resume() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning.validate_student_resume() TO authenticated;
CREATE TRIGGER validate_student_resume BEFORE INSERT OR UPDATE ON learning.student_resumes FOR EACH ROW EXECUTE FUNCTION learning.validate_student_resume();
COMMENT ON TABLE learning.student_resumes IS 'Private student career documents; content is independent of login/account details.';
COMMENT ON TABLE learning.resume_scans IS 'Private, versioned rule-based reports. Raw uploads and job descriptions are not stored.';
NOTIFY pgrst,'reload schema';


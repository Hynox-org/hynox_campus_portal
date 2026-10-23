CREATE TABLE learning.newsletter_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  daily_limit integer NOT NULL DEFAULT 250 CHECK (daily_limit BETWEEN 1 AND 100000),
  credit_reserve integer NOT NULL DEFAULT 50 CHECK (credit_reserve BETWEEN 0 AND 10000),
  send_hour integer NOT NULL DEFAULT 8 CHECK (send_hour BETWEEN 0 AND 23),
  lease_owner uuid,
  lease_until timestamptz,
  last_run_at timestamptz,
  last_error text,
  brevo_folder_id bigint
);
INSERT INTO learning.newsletter_settings(id) VALUES (true);

CREATE TABLE learning.newsletter_courses (
  course_id uuid PRIMARY KEY REFERENCES academic.courses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  query text NOT NULL DEFAULT '' CHECK (length(query) <= 120)
);

CREATE TABLE learning.newsletter_preferences (
  student_id uuid PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  suppressed_reason text,
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT enabled OR consent_at IS NOT NULL)
);

CREATE TABLE learning.newsletter_editions (
  course_id uuid NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
  day date NOT NULL,
  title text NOT NULL,
  query text NOT NULL,
  articles jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(articles) = 'array' AND octet_length(articles::text) < 40000),
  provider text,
  state text NOT NULL CHECK (state IN ('ready','empty','error')),
  attempts integer NOT NULL DEFAULT 1,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id,day)
);

CREATE TABLE learning.newsletter_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  sections jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array' AND octet_length(sections::text) < 200000),
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','sending','sent','unknown','failed','cancelled')),
  campaign_id bigint,
  list_id bigint,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX newsletter_batches_pending ON learning.newsletter_batches(day,state);

CREATE TABLE learning.newsletter_deliveries (
  student_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  batch_id uuid NOT NULL REFERENCES learning.newsletter_batches(id) ON DELETE CASCADE,
  email text NOT NULL,
  PRIMARY KEY(student_id,day)
);
CREATE INDEX newsletter_deliveries_batch ON learning.newsletter_deliveries(batch_id);

ALTER TABLE learning.newsletter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.newsletter_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.newsletter_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.newsletter_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.newsletter_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning.newsletter_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning.newsletter_settings,learning.newsletter_courses,learning.newsletter_preferences,learning.newsletter_editions,learning.newsletter_batches,learning.newsletter_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON learning.newsletter_settings,learning.newsletter_courses,learning.newsletter_preferences,learning.newsletter_editions,learning.newsletter_batches,learning.newsletter_deliveries TO service_role;

CREATE VIEW learning.newsletter_members WITH (security_invoker=true) AS
SELECT DISTINCT u.id AS student_id,u.email,u.full_name,c.id AS course_id,c.title,coalesce(nc.query,'') AS query
FROM core.users u
JOIN auth.users au ON au.id=u.auth_user_id AND au.email_confirmed_at IS NOT NULL
JOIN institution.institutions i ON i.id=u.tenant_id AND i.status='active'
JOIN delivery.enrollments e ON e.user_id=u.id AND e.deleted_at IS NULL AND e.status_code='active'
JOIN delivery.cohorts co ON co.id=e.cohort_id AND co.deleted_at IS NULL AND co.status_code='active' AND co.institution_id=u.tenant_id AND co.tenant_id=u.tenant_id
JOIN delivery.course_assignments ca ON ca.cohort_id=co.id AND ca.deleted_at IS NULL
JOIN academic.courses c ON c.id=ca.course_id AND c.deleted_at IS NULL AND c.institution_id=u.tenant_id AND c.tenant_id=u.tenant_id
JOIN academic.statuses cs ON cs.id=c.status_id AND cs.code='active'
JOIN academic.programs p ON p.id=c.program_id AND p.deleted_at IS NULL AND p.institution_id=u.tenant_id
JOIN academic.statuses ps ON ps.id=p.status_id AND ps.code='active'
LEFT JOIN learning.newsletter_courses nc ON nc.course_id=c.id
WHERE u.status='active' AND u.deleted_at IS NULL
AND lower(u.email)=lower(au.email)
AND coalesce(au.raw_app_meta_data->>'shared_dashboard_login','false')<>'true'
AND EXISTS (SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='student')
AND coalesce(nc.enabled,true)
AND (co.start_date IS NULL OR co.start_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date)
AND (co.end_date IS NULL OR co.end_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date)
AND (ca.start_date IS NULL OR ca.start_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date)
AND (ca.due_date IS NULL OR ca.due_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date);
REVOKE ALL ON learning.newsletter_members FROM PUBLIC,anon,authenticated;
GRANT SELECT ON learning.newsletter_members TO service_role;

CREATE FUNCTION learning.newsletter_audience(p_ids uuid[] DEFAULT NULL,p_include_reserved boolean DEFAULT false,p_limit integer DEFAULT 500)
RETURNS TABLE(student_id uuid,email text,full_name text,courses jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT m.student_id,m.email,m.full_name,jsonb_agg(jsonb_build_object('id',m.course_id,'title',m.title,'query',m.query) ORDER BY m.course_id)
  FROM learning.newsletter_members m
  JOIN learning.newsletter_preferences np ON np.student_id=m.student_id AND np.enabled AND np.suppressed_reason IS NULL
  WHERE (p_ids IS NULL OR m.student_id=ANY(p_ids))
    AND (p_include_reserved OR NOT EXISTS (SELECT 1 FROM learning.newsletter_deliveries d WHERE d.student_id=m.student_id AND d.day=(now() AT TIME ZONE 'Asia/Kolkata')::date))
  GROUP BY m.student_id,m.email,m.full_name,np.last_sent_at
  ORDER BY np.last_sent_at NULLS FIRST,m.student_id
  LIMIT greatest(1,least(p_limit,2000));
$$;

CREATE FUNCTION learning.newsletter_claim(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE learning.newsletter_settings SET lease_owner=p_owner,lease_until=now()+interval '3 minutes',last_run_at=now(),last_error=NULL
  WHERE id AND enabled AND (lease_until IS NULL OR lease_until<now());
  RETURN FOUND;
END;
$$;

CREATE FUNCTION learning.newsletter_prepare_batch(p_students uuid[],p_sections jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_day date:=(now() AT TIME ZONE 'Asia/Kolkata')::date; v_limit integer; v_used integer; v_id uuid; v_courses uuid[];
BEGIN
  SELECT daily_limit INTO v_limit FROM learning.newsletter_settings WHERE id AND enabled FOR UPDATE;
  IF v_limit IS NULL OR jsonb_array_length(p_sections)=0 THEN RETURN NULL; END IF;
  SELECT array_agg((value->>'courseId')::uuid) INTO v_courses FROM jsonb_array_elements(p_sections);
  SELECT count(*) INTO v_used FROM learning.newsletter_deliveries WHERE day=v_day;
  IF v_used>=v_limit THEN RETURN NULL; END IF;
  INSERT INTO learning.newsletter_batches(day,sections) VALUES(v_day,p_sections) RETURNING id INTO v_id;
  INSERT INTO learning.newsletter_deliveries(student_id,day,batch_id,email)
    SELECT a.student_id,v_day,v_id,a.email FROM learning.newsletter_audience(p_students,false,50) a
    WHERE v_courses <@ ARRAY(SELECT (value->>'id')::uuid FROM jsonb_array_elements(a.courses))
    LIMIT least(v_limit-v_used,25)
    ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN DELETE FROM learning.newsletter_batches WHERE id=v_id; RETURN NULL; END IF;
  RETURN v_id;
END;
$$;

CREATE FUNCTION learning.newsletter_finish_batch(p_batch uuid,p_state text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_state NOT IN ('sent','unknown','failed','cancelled') THEN RAISE EXCEPTION 'Invalid batch state'; END IF;
  UPDATE learning.newsletter_batches SET state=p_state,error=left(p_error,500),updated_at=now() WHERE id=p_batch;
  IF p_state='sent' THEN
    UPDATE learning.newsletter_preferences SET last_sent_at=now() WHERE student_id IN (SELECT student_id FROM learning.newsletter_deliveries WHERE batch_id=p_batch);
  END IF;
END;
$$;

CREATE FUNCTION learning.newsletter_runtime()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(jsonb_object_agg(replace(name,'campus_newsletter_',''),decrypted_secret),'{}'::jsonb)
  FROM vault.decrypted_secrets WHERE name LIKE 'campus_newsletter_%';
$$;

CREATE FUNCTION learning.newsletter_configure_transport(p_values jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text; v_value text; v_id uuid;
BEGIN
  FOR v_key,v_value IN SELECT key,value FROM jsonb_each_text(p_values) LOOP
    IF v_key NOT IN ('brevo_api_key','sender_email','sender_name','scheduler_token','function_url') OR length(v_value)>2000 THEN RAISE EXCEPTION 'Invalid newsletter configuration'; END IF;
    SELECT id INTO v_id FROM vault.secrets WHERE name='campus_newsletter_'||v_key;
    IF v_id IS NULL THEN PERFORM vault.create_secret(v_value,'campus_newsletter_'||v_key);
    ELSE PERFORM vault.update_secret(v_id,v_value); END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION learning.newsletter_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_url text; v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learning.newsletter_settings WHERE id AND enabled) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='campus_newsletter_function_url';
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name='campus_newsletter_scheduler_token';
  IF v_url IS NULL OR v_token IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-newsletter-token',v_token),body:='{}'::jsonb,timeout_milliseconds:=1000);
END;
$$;

REVOKE ALL ON FUNCTION learning.newsletter_audience(uuid[],boolean,integer),learning.newsletter_claim(uuid),learning.newsletter_prepare_batch(uuid[],jsonb),learning.newsletter_finish_batch(uuid,text,text),learning.newsletter_runtime(),learning.newsletter_configure_transport(jsonb),learning.newsletter_tick() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION learning.newsletter_audience(uuid[],boolean,integer),learning.newsletter_claim(uuid),learning.newsletter_prepare_batch(uuid[],jsonb),learning.newsletter_finish_batch(uuid,text,text),learning.newsletter_runtime(),learning.newsletter_configure_transport(jsonb) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
SELECT cron.schedule('campus-course-newsletters','*/5 * * * *',$$SELECT learning.newsletter_tick()$$);
NOTIFY pgrst,'reload schema';

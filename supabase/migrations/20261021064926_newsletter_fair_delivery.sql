ALTER TABLE learning.newsletter_preferences ADD COLUMN last_considered_at timestamptz;
CREATE OR REPLACE FUNCTION learning.newsletter_audience(p_ids uuid[] DEFAULT NULL,p_include_reserved boolean DEFAULT false,p_limit integer DEFAULT 500)
RETURNS TABLE(student_id uuid,email text,full_name text,courses jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT m.student_id,m.email,m.full_name,jsonb_agg(jsonb_build_object('id',m.course_id,'title',m.title,'query',m.query) ORDER BY m.course_id)
  FROM learning.newsletter_members m
  JOIN learning.newsletter_preferences np ON np.student_id=m.student_id AND np.enabled AND np.suppressed_reason IS NULL
  WHERE (p_ids IS NULL OR m.student_id=ANY(p_ids))
    AND (p_include_reserved OR NOT EXISTS (SELECT 1 FROM learning.newsletter_deliveries d WHERE d.student_id=m.student_id AND d.day=(now() AT TIME ZONE 'Asia/Kolkata')::date))
  GROUP BY m.student_id,m.email,m.full_name,np.last_sent_at,np.last_considered_at
  ORDER BY coalesce(np.last_sent_at,np.last_considered_at) NULLS FIRST,m.student_id
  LIMIT greatest(1,least(p_limit,2000));
$$;
NOTIFY pgrst,'reload schema';

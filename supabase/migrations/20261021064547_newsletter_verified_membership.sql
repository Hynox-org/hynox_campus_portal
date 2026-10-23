CREATE SCHEMA newsletter_private;
REVOKE ALL ON SCHEMA newsletter_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA newsletter_private TO service_role;

CREATE FUNCTION newsletter_private.verified_recipient(p_auth_user uuid,p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id=p_auth_user AND lower(au.email)=lower(p_email)
    AND au.email_confirmed_at IS NOT NULL
    AND coalesce(au.raw_app_meta_data->>'shared_dashboard_login','false')<>'true'
  );
$$;
REVOKE ALL ON FUNCTION newsletter_private.verified_recipient(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION newsletter_private.verified_recipient(uuid,text) TO service_role;

CREATE OR REPLACE VIEW learning.newsletter_members WITH (security_invoker=true) AS
SELECT DISTINCT u.id AS student_id,u.email,u.full_name,c.id AS course_id,c.title,coalesce(nc.query,'') AS query
FROM core.users u
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
AND newsletter_private.verified_recipient(u.auth_user_id,u.email)
AND EXISTS (SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='student')
AND coalesce(nc.enabled,true)
AND (co.start_date IS NULL OR co.start_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date)
AND (co.end_date IS NULL OR co.end_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date)
AND (ca.start_date IS NULL OR ca.start_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date)
AND (ca.due_date IS NULL OR ca.due_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date);
NOTIFY pgrst,'reload schema';

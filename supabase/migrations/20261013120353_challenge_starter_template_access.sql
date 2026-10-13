-- Keep starter-code access tied to the selected dashboard role and challenge scope.
ALTER TABLE learning.challenge_starter_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning.challenge_starter_templates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning.challenge_starter_templates TO authenticated;

CREATE POLICY starter_templates_staff_manage
ON learning.challenge_starter_templates FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM core.get_current_user() cu
    JOIN learning.programming_challenges pc ON pc.id = challenge_starter_templates.challenge_id
    JOIN learning.activities a ON a.id = pc.activity_id
    WHERE cu.status = 'active' AND a.deleted_at IS NULL AND (
      'super_admin' = ANY(cu.roles)
      OR ('teacher' = ANY(cu.roles) AND (
        EXISTS (
          SELECT 1 FROM academic.lessons l
          JOIN academic.modules m ON m.id = l.module_id
          JOIN academic.course_instructors ci ON ci.course_id = m.course_id
          WHERE l.id = a.lesson_id AND ci.user_id = cu.user_id
            AND l.deleted_at IS NULL AND m.deleted_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM learning.activity_assignments aa
          JOIN delivery.cohort_teachers ct ON ct.cohort_id = aa.cohort_id
          WHERE aa.activity_id = a.id AND aa.deleted_at IS NULL AND ct.teacher_id = cu.user_id
        )
      ))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM core.get_current_user() cu
    JOIN learning.programming_challenges pc ON pc.id = challenge_starter_templates.challenge_id
    JOIN learning.activities a ON a.id = pc.activity_id
    WHERE cu.status = 'active' AND a.deleted_at IS NULL AND (
      'super_admin' = ANY(cu.roles)
      OR ('teacher' = ANY(cu.roles) AND (
        EXISTS (
          SELECT 1 FROM academic.lessons l
          JOIN academic.modules m ON m.id = l.module_id
          JOIN academic.course_instructors ci ON ci.course_id = m.course_id
          WHERE l.id = a.lesson_id AND ci.user_id = cu.user_id
            AND l.deleted_at IS NULL AND m.deleted_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM learning.activity_assignments aa
          JOIN delivery.cohort_teachers ct ON ct.cohort_id = aa.cohort_id
          WHERE aa.activity_id = a.id AND aa.deleted_at IS NULL AND ct.teacher_id = cu.user_id
        )
      ))
    )
  )
);

CREATE POLICY starter_templates_scoped_read
ON learning.challenge_starter_templates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM core.get_current_user() cu
    JOIN learning.programming_challenges pc ON pc.id = challenge_starter_templates.challenge_id
    JOIN learning.activities a ON a.id = pc.activity_id
    WHERE cu.status = 'active' AND a.deleted_at IS NULL AND a.tenant_id = cu.tenant_id AND (
      'institution_admin' = ANY(cu.roles)
      OR ('student' = ANY(cu.roles) AND a.status_code = 'published' AND EXISTS (
        SELECT 1 FROM learning.activity_assignments aa
        JOIN delivery.enrollments e ON e.cohort_id = aa.cohort_id
        WHERE aa.activity_id = a.id AND aa.deleted_at IS NULL
          AND e.user_id = cu.user_id AND e.status_code = 'active' AND e.deleted_at IS NULL
          AND (aa.available_from IS NULL OR aa.available_from <= now())
          AND (aa.available_until IS NULL OR aa.available_until >= now())
      ))
    )
  )
);

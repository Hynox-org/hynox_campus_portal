-- Platform teachers have no home tenant. Permit roster reads only for students
-- enrolled in cohorts explicitly assigned to that teacher or trainer.
create policy assigned_teacher_student_roster_select on core.users
for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from core.get_current_user() cu
    where (('teacher' = any(cu.roles)) or ('trainer' = any(cu.roles)))
      and exists (
        select 1 from delivery.enrollments e
        join delivery.cohort_teachers ct on ct.cohort_id=e.cohort_id
        join delivery.cohorts c on c.id=e.cohort_id
        where e.user_id=users.id and e.deleted_at is null
          and ct.teacher_id=cu.user_id and c.deleted_at is null
      )
  )
);

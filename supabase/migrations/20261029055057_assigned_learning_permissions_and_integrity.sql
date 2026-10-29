-- Resolve learning authority through persisted curriculum, including standalone teachers.
create or replace function learning.can_edit_lesson(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from academic.lessons l join academic.modules m on m.id=l.module_id
   where l.id=p_lesson_id and l.deleted_at is null and m.deleted_at is null
   and l.tenant_id=m.tenant_id and l.institution_id=l.tenant_id and academic.can_edit_course(m.course_id));
$$;
create or replace function learning.can_edit_activity(p_activity_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from learning.activities a join academic.lessons l on l.id=a.lesson_id
   where a.id=p_activity_id and a.tenant_id=l.tenant_id and a.institution_id=a.tenant_id
     and learning.can_edit_lesson(a.lesson_id));
$$;
create or replace function learning.can_read_activity(p_activity_id uuid,p_open boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select learning.can_edit_activity(p_activity_id) or exists(
   select 1 from core.get_current_user() cu
   join learning.activities a on a.id=p_activity_id and a.deleted_at is null and a.status_code='published'
   join academic.lessons l on l.id=a.lesson_id and l.deleted_at is null and l.tenant_id=a.tenant_id
   join academic.modules m on m.id=l.module_id and m.deleted_at is null and m.tenant_id=a.tenant_id
   join academic.courses c on c.id=m.course_id and c.deleted_at is null and c.tenant_id=a.tenant_id
   join academic.programs p on p.id=c.program_id and p.deleted_at is null and p.tenant_id=a.tenant_id
   join institution.institutions campus on campus.id=a.tenant_id and campus.status='active'
   join academic.statuses ls on ls.id=l.status_id and ls.code='active'
   join academic.statuses ms on ms.id=m.status_id and ms.code='active'
   join academic.statuses cs on cs.id=c.status_id and cs.code='active'
   join academic.statuses ps on ps.id=p.status_id and ps.code='active'
   join academic.visibility_types cv on cv.id=c.visibility_type_id and cv.code<>'private'
   join academic.visibility_types pv on pv.id=p.visibility_type_id and pv.code<>'private'
   join learning.activity_assignments aa on aa.activity_id=a.id and aa.deleted_at is null
   join delivery.cohorts co on co.id=aa.cohort_id and co.program_id=p.id and co.tenant_id=a.tenant_id
     and co.deleted_at is null and co.status_code='active'
   join delivery.enrollments e on e.cohort_id=co.id and e.user_id=cu.user_id
     and e.status_code='active' and e.deleted_at is null
   join delivery.course_assignments ca on ca.cohort_id=co.id and ca.course_id=c.id and ca.deleted_at is null
   where cu.status='active' and 'student'=any(cu.roles) and cu.tenant_id=a.tenant_id
     and (not p_open or ((a.available_from is null or a.available_from<=now())
       and (a.available_until is null or a.available_until>=now())
       and (aa.available_from is null or aa.available_from<=now())
       and (aa.available_until is null or aa.available_until>=now())))
 );
$$;
create or replace function learning.can_manage_assignment(p_activity_id uuid,p_cohort_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select learning.can_edit_activity(p_activity_id) and exists(
   select 1 from core.get_current_user() cu
   join learning.activities a on a.id=p_activity_id and a.deleted_at is null
   join academic.lessons l on l.id=a.lesson_id join academic.modules m on m.id=l.module_id
   join academic.courses c on c.id=m.course_id
   join delivery.cohorts co on co.id=p_cohort_id and co.tenant_id=a.tenant_id and co.program_id=c.program_id
     and co.deleted_at is null and co.status_code='active'
   join delivery.course_assignments ca on ca.cohort_id=co.id and ca.course_id=c.id and ca.deleted_at is null
   where cu.status='active' and ('super_admin'=any(cu.roles)
     or ('institution_admin'=any(cu.roles) and cu.tenant_id=a.tenant_id)
     or (cu.roles && array['teacher','trainer']::text[] and (
       exists(select 1 from delivery.cohort_teachers ct where ct.cohort_id=co.id and ct.teacher_id=cu.user_id)
       or exists(select 1 from academic.course_instructors ci where ci.course_id=c.id and ci.user_id=cu.user_id))))
 );
$$;
revoke all on function learning.can_edit_lesson(uuid),learning.can_edit_activity(uuid),
 learning.can_read_activity(uuid,boolean),learning.can_manage_assignment(uuid,uuid) from public,anon;
grant execute on function learning.can_edit_lesson(uuid),learning.can_edit_activity(uuid),
 learning.can_read_activity(uuid,boolean),learning.can_manage_assignment(uuid,uuid) to authenticated,service_role;

-- Keep the existing calculator contract, but reject a shared login without a selected dashboard role.
do $$ declare definition text; begin
 select pg_get_functiondef('delivery.course_progress_snapshot(uuid[],uuid[])'::regprocedure) into definition;
 definition=replace(definition,
   'actor.user_id is null or actor.status <> ''active''',
   'actor.user_id is null or actor.status <> ''active'' or not actor.roles && array[''student'',''super_admin'',''institution_admin'',''teacher'',''trainer'']::text[]');
 execute definition;
end $$;

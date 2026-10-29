-- Collaboration permission is derived from course/cohort assignments, not a teacher's home tenant.
create or replace function academic.can_edit_course(p_course_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(
  select 1 from core.get_current_user() cu
  join academic.courses c on c.id=p_course_id and c.deleted_at is null
  join academic.programs p on p.id=c.program_id and p.deleted_at is null
  join institution.institutions i on i.id=c.tenant_id and i.status='active'
  where cu.status='active' and (
    'super_admin'=any(cu.roles)
    or ('institution_admin'=any(cu.roles) and cu.tenant_id=c.tenant_id)
    or (cu.roles && array['teacher','trainer'] and (
      exists(select 1 from academic.course_instructors ci where ci.course_id=c.id and ci.user_id=cu.user_id)
      or exists(select 1 from delivery.cohort_teachers ct join delivery.cohorts g on g.id=ct.cohort_id and g.deleted_at is null
        join delivery.course_assignments ca on ca.cohort_id=g.id and ca.deleted_at is null
        where ct.teacher_id=cu.user_id and ca.course_id=c.id and g.tenant_id=c.tenant_id)
    ))
  )
 );
$$;
revoke all on function academic.can_edit_course(uuid) from public,anon;
grant execute on function academic.can_edit_course(uuid) to authenticated;
-- Replace broad tenant-only write policies on these three tables. SELECT policy review remains in the final security pass.
do $$ declare t text; p record; predicate text; begin
 foreach t in array array['modules','lessons','lesson_resources'] loop
  for p in select policyname from pg_policies where schemaname='academic' and tablename=t and cmd='ALL' loop
   execute format('drop policy %I on academic.%I',p.policyname,t);
  end loop;
  predicate=case t when 'modules' then 'academic.can_edit_course(course_id)'
   when 'lessons' then 'exists(select 1 from academic.modules m where m.id=module_id and m.deleted_at is null and academic.can_edit_course(m.course_id))'
   else 'exists(select 1 from academic.lessons l join academic.modules m on m.id=l.module_id where l.id=lesson_id and l.deleted_at is null and m.deleted_at is null and academic.can_edit_course(m.course_id))' end;
  execute format('create policy assigned_staff_insert on academic.%I for insert to authenticated with check (%s)',t,predicate);
  execute format('create policy assigned_staff_update on academic.%I for update to authenticated using (%s) with check (%s)',t,predicate,predicate);
  execute format('create policy assigned_staff_delete on academic.%I for delete to authenticated using (%s)',t,predicate);
 end loop;
end $$;
-- Teacher assignment changes remain an administrator responsibility.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='academic' and tablename='course_instructors' and cmd='ALL' loop
  execute format('drop policy %I on academic.course_instructors',p.policyname);
 end loop;
end $$;
create policy course_instructors_admin_manage on academic.course_instructors for all to authenticated
using (exists(select 1 from core.get_current_user() cu where cu.status='active' and ('super_admin'=any(cu.roles) or ('institution_admin'=any(cu.roles) and cu.tenant_id=course_instructors.tenant_id))))
with check (exists(select 1 from core.get_current_user() cu where cu.status='active' and ('super_admin'=any(cu.roles) or ('institution_admin'=any(cu.roles) and cu.tenant_id=course_instructors.tenant_id))));
create policy course_colleagues_read on academic.course_instructors for select to authenticated using (academic.can_edit_course(course_id));

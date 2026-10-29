create or replace function academic.get_all_teachers()
returns table(id uuid,full_name text,email text,tenant_id uuid,mapped_tenant_ids uuid[])
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from core.get_current_user() cu where cu.status='active' and 'super_admin'=any(cu.roles)) then
  raise exception 'Access denied' using errcode='42501';
 end if;
 return query select u.id,u.full_name,u.email,u.tenant_id,
  coalesce((select array_agg(scope order by scope) from core.teacher_campus_ids(u.id) scope),'{}'::uuid[])
 from core.users u where u.deleted_at is null and exists(
  select 1 from core.user_roles ur join core.roles r on r.id=ur.role_id where ur.user_id=u.id and r.name in ('teacher','trainer'))
 order by u.full_name,u.id;
end $$;
create or replace function academic.get_tenant_teachers(p_tenant_id uuid)
returns table(id uuid,full_name text,email text)
language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;
begin
 select * into actor from core.get_current_user() where status='active';
 if actor.user_id is null or not ('super_admin'=any(actor.roles) or (
  actor.roles && array['institution_admin','teacher','trainer'] and p_tenant_id in (select core.teacher_campus_ids(actor.user_id))
 )) then raise exception 'Access denied' using errcode='42501'; end if;
 return query select u.id,u.full_name,u.email from core.users u
 where u.deleted_at is null and u.status='active' and (
  u.tenant_id=p_tenant_id
  or exists(select 1 from academic.tenant_teachers tt where tt.user_id=u.id and tt.tenant_id=p_tenant_id)
  or exists(select 1 from academic.course_instructors ci join academic.courses c on c.id=ci.course_id
    where ci.user_id=u.id and c.tenant_id=p_tenant_id and c.deleted_at is null)
  or exists(select 1 from delivery.cohort_teachers ct join delivery.cohorts c on c.id=ct.cohort_id
    where ct.teacher_id=u.id and c.tenant_id=p_tenant_id and c.deleted_at is null)
 ) and exists(select 1 from core.user_roles ur join core.roles r on r.id=ur.role_id
  where ur.user_id=u.id and r.name in ('teacher','trainer')) order by u.full_name,u.id;
end $$;
revoke all on function academic.get_all_teachers(),academic.get_tenant_teachers(uuid) from public,anon;
grant execute on function academic.get_all_teachers(),academic.get_tenant_teachers(uuid) to authenticated;

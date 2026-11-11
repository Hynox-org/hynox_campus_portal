-- Standalone teachers obtain campus access from their actual assignments.
create or replace function core.teacher_campus_ids(p_user_id uuid)
returns setof uuid language sql stable security definer set search_path = pg_catalog as $$
  with caller as (select * from core.get_current_user() where status = 'active'),
  scopes as (
    select tenant_id from core.users where id = p_user_id and deleted_at is null
    union select tenant_id from academic.tenant_teachers where user_id = p_user_id
    union select c.tenant_id from academic.course_instructors ci join academic.courses c on c.id=ci.course_id
      where ci.user_id=p_user_id and c.deleted_at is null
    union select c.tenant_id from delivery.cohort_teachers ct join delivery.cohorts c on c.id=ct.cohort_id
      where ct.teacher_id=p_user_id and c.deleted_at is null
  )
  select distinct s.tenant_id from scopes s join institution.institutions i on i.id=s.tenant_id
  where i.status='active'
    and exists(select 1 from caller where user_id=p_user_id or 'super_admin'=any(roles));
$$;
revoke all on function core.teacher_campus_ids(uuid) from public, anon;
grant execute on function core.teacher_campus_ids(uuid) to authenticated;

create policy course_instructors_self_read on academic.course_instructors for select to authenticated
using (user_id in (select user_id from core.get_current_user() where status='active'));
create policy cohort_teacher_institution_read on institution.institutions for select to authenticated
using (id in (select core.teacher_campus_ids(cu.user_id) from core.get_current_user() cu where cu.status='active'));

-- The replacement is one transaction; invalid IDs never erase earlier teachers.
create or replace function academic.replace_course_instructors(p_course_id uuid, p_instructor_ids uuid[])
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare target academic.courses; caller record;
begin
  select * into caller from core.get_current_user() where status='active';
  select * into target from academic.courses where id=p_course_id and deleted_at is null for update;
  if target.id is null or caller.user_id is null or not (
    'super_admin'=any(caller.roles) or ('institution_admin'=any(caller.roles) and caller.tenant_id=target.tenant_id)
  ) then raise exception 'Access denied.' using errcode='42501'; end if;
  if not exists(select 1 from institution.institutions where id=target.tenant_id and status='active')
    then raise exception 'Campus is unavailable.'; end if;
  if p_instructor_ids is null or cardinality(p_instructor_ids)>100 or exists(
    select 1 from unnest(p_instructor_ids) u(id) where id is null or not exists(
      select 1 from core.users usr join core.user_roles ur on ur.user_id=usr.id join core.roles r on r.id=ur.role_id
      where usr.id=u.id and usr.deleted_at is null and usr.status='active' and r.name in ('teacher','trainer')
    )
  ) then raise exception 'Choose active teachers or trainers.'; end if;
  if cardinality(p_instructor_ids)<>(select count(distinct id) from unnest(p_instructor_ids) u(id)) then raise exception 'Duplicate instructor IDs.'; end if;
  delete from academic.course_instructors where course_id=p_course_id and not(user_id=any(p_instructor_ids));
  insert into academic.course_instructors(course_id,user_id,tenant_id,institution_id,instructor_role)
    select p_course_id,id,target.tenant_id,target.institution_id,'primary' from unnest(p_instructor_ids) u(id)
    on conflict(course_id,user_id) do nothing;
end;
$$;
revoke all on function academic.replace_course_instructors(uuid,uuid[]) from public, anon;
grant execute on function academic.replace_course_instructors(uuid,uuid[]) to authenticated;

-- Integrity at the database boundary, including concurrent/direct API requests.
create or replace function academic.check_hierarchy() returns trigger
language plpgsql set search_path=pg_catalog as $$
declare parent_campus uuid; parent_institution uuid; parent_deleted timestamptz;
begin
  if new.deleted_at is not null then return new; end if;
  if new.tenant_id<>new.institution_id then raise exception 'Invalid campus hierarchy.'; end if;
  if tg_table_name='courses' then
    select tenant_id,institution_id,deleted_at into parent_campus,parent_institution,parent_deleted from academic.programs where id=new.program_id for share;
  elsif tg_table_name='modules' then
    select tenant_id,institution_id,deleted_at into parent_campus,parent_institution,parent_deleted from academic.courses where id=new.course_id for share;
  elsif tg_table_name='lessons' then
    select tenant_id,institution_id,deleted_at into parent_campus,parent_institution,parent_deleted from academic.modules where id=new.module_id for share;
  else
    select tenant_id,institution_id,deleted_at into parent_campus,parent_institution,parent_deleted from academic.lessons where id=new.lesson_id for share;
  end if;
  if parent_campus is null or parent_deleted is not null or parent_campus<>new.tenant_id or parent_institution<>new.institution_id then
    raise exception 'Parent is unavailable or belongs to a different campus.';
  end if;
  return new;
end;
$$;
revoke all on function academic.check_hierarchy() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['courses','modules','lessons','lesson_resources'] loop
    execute format('create trigger check_hierarchy before insert or update on academic.%I for each row execute function academic.check_hierarchy()',t);
  end loop;
end $$;

create or replace function delivery.check_assignment_integrity() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare target delivery.cohorts; course academic.courses; student core.users; role_name text;
begin
  if tg_table_name<>'cohort_teachers' then
    if new.deleted_at is not null then return new; end if;
  end if;
  if tg_table_name='cohorts' then
    if new.tenant_id<>new.institution_id or not exists(select 1 from academic.programs p where p.id=new.program_id and p.tenant_id=new.tenant_id and p.deleted_at is null)
      then raise exception 'Invalid campus hierarchy.'; end if;
    if new.start_date>new.end_date then raise exception 'Start date must not follow end date.'; end if;
    return new;
  end if;
  select * into target from delivery.cohorts where id=new.cohort_id and deleted_at is null for share;
  if target.id is null then raise exception 'Cohort is unavailable.'; end if;
  if tg_table_name='cohort_teachers' then
    if not exists(select 1 from core.users u join core.user_roles ur on ur.user_id=u.id join core.roles r on r.id=ur.role_id
      where u.id=new.teacher_id and u.deleted_at is null and u.status='active' and r.name in ('teacher','trainer'))
      then raise exception 'Choose an active teacher or trainer.'; end if;
  elsif tg_table_name='course_assignments' then
    select * into course from academic.courses where id=new.course_id and deleted_at is null;
    if course.id is null or course.tenant_id<>target.tenant_id or course.program_id<>target.program_id then raise exception 'Course must belong to the cohort program and campus.'; end if;
    if new.start_date>new.due_date or new.start_date<target.start_date or new.due_date>target.end_date or new.start_date>target.end_date or new.due_date<target.start_date
      then raise exception 'Assignment dates must be ordered within cohort dates.'; end if;
  elsif tg_table_name='enrollments' then
    select * into student from core.users where id=new.user_id and deleted_at is null;
    if student.id is null or student.tenant_id is distinct from target.tenant_id or student.status<>'active' or not exists(
      select 1 from core.user_roles ur join core.roles r on r.id=ur.role_id where ur.user_id=new.user_id and r.name='student'
    ) then raise exception 'Choose an active student from the cohort campus.'; end if;
    -- Serializes enrollment attempts for the same student, across cohorts.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
    if new.status_code='active' and target.status_code='active' and (target.end_date is null or target.end_date>=current_date) and exists(
      select 1 from delivery.enrollments e join delivery.cohorts c on c.id=e.cohort_id
      where e.user_id=new.user_id and e.id<>new.id and e.deleted_at is null and e.status_code='active'
        and c.program_id=target.program_id and c.deleted_at is null and c.status_code='active' and (c.end_date is null or c.end_date>=current_date)
    ) then raise exception 'Student already has an active cohort in this program.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function delivery.check_assignment_integrity() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['cohorts','enrollments','course_assignments','cohort_teachers'] loop
    execute format('create trigger check_assignment_integrity before insert or update on delivery.%I for each row execute function delivery.check_assignment_integrity()',t);
  end loop;
end $$;

-- Fail visibly if legacy duplicates need manual review; never delete real rows.
create unique index cohorts_live_code on delivery.cohorts(tenant_id,lower(code)) where deleted_at is null;
create unique index enrollments_live_student_cohort on delivery.enrollments(user_id,cohort_id) where deleted_at is null;
create unique index assignments_live_course_cohort on delivery.course_assignments(course_id,cohort_id) where deleted_at is null;
create unique index programs_live_slug on academic.programs(tenant_id,lower(slug)) where deleted_at is null;
create unique index courses_live_slug on academic.courses(program_id,lower(slug)) where deleted_at is null;

-- Only revision counters enter Realtime. No curriculum/user record payloads.
create table core.dashboard_revisions (
  topic text not null, domain text not null, revision bigint not null default 1,
  primary key(topic,domain), check(domain in ('academic','delivery','identity','library'))
);
alter table core.dashboard_revisions enable row level security;
grant select on core.dashboard_revisions to authenticated;
revoke all on core.dashboard_revisions from anon;
create or replace function core.can_read_dashboard_topic(p_topic text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from core.get_current_user() cu where cu.status='active' and (
    'super_admin'=any(cu.roles) or p_topic='user:'||cu.user_id::text or p_topic='campus:'||cu.tenant_id::text
    or p_topic in (select 'campus:'||id::text from core.teacher_campus_ids(cu.user_id) id)
  ));
$$;
revoke all on function core.can_read_dashboard_topic(text) from public, anon;
grant execute on function core.can_read_dashboard_topic(text) to authenticated;
create policy dashboard_revision_read on core.dashboard_revisions for select to authenticated
using ((select core.can_read_dashboard_topic(topic)));

create or replace function core.notify_dashboard_change() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare row_data jsonb; campus uuid; person uuid; change_domain text;
begin
  row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  change_domain=case when tg_table_schema='library' then 'library' when tg_table_schema='academic' then 'academic'
    when tg_table_schema='delivery' then 'delivery' else 'identity' end;
  campus=nullif(row_data->>'tenant_id','')::uuid;
  if tg_table_schema='institution' then campus=(row_data->>'id')::uuid; end if;
  if tg_table_schema='delivery' and campus is null then
    select tenant_id into campus from delivery.cohorts where id=(row_data->>'cohort_id')::uuid;
  end if;
  if tg_table_name='users' then person=(row_data->>'id')::uuid;
  elsif tg_table_name in ('cohort_teachers') then person=(row_data->>'teacher_id')::uuid;
  elsif tg_table_name in ('user_roles','tenant_teachers','course_instructors','enrollments') then person=(row_data->>'user_id')::uuid;
  end if;
  insert into core.dashboard_revisions(topic,domain) values('admin',change_domain)
    on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;
  if campus is not null then
    insert into core.dashboard_revisions(topic,domain) values('campus:'||campus::text,change_domain)
      on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;
  end if;
  if person is not null then
    insert into core.dashboard_revisions(topic,domain) values('user:'||person::text,'identity')
      on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;
  end if;
  return null;
end;
$$;
revoke all on function core.notify_dashboard_change() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['academic.programs','academic.courses','academic.modules','academic.lessons','academic.lesson_resources',
    'academic.course_instructors','academic.tenant_teachers','delivery.cohorts','delivery.enrollments','delivery.course_assignments',
    'delivery.cohort_teachers','core.users','core.user_roles','institution.institutions',
    'library.course_templates','library.module_templates','library.lesson_templates','library.resource_templates'] loop
    execute format('create trigger notify_dashboard_change after insert or update or delete on %s for each row execute function core.notify_dashboard_change()',t);
  end loop;
end $$;
alter publication supabase_realtime add table core.dashboard_revisions;

-- Attendance API derives identity from the session and saves a date atomically.
create unique index attendance_session_live_day on delivery.attendance_sessions(cohort_id,session_date) where deleted_at is null;
create unique index attendance_record_live_student on delivery.attendance_records(session_id,student_id) where deleted_at is null;

create or replace function delivery.can_mark_attendance(p_cohort uuid,p_actor uuid default null)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from core.get_current_user() cu
 join delivery.cohorts c on c.id=p_cohort and c.deleted_at is null and c.status_code='active'
 join institution.institutions i on i.id=c.institution_id and i.status='active'
 where cu.status='active' and cu.user_id is not null and (p_actor is null or p_actor=cu.user_id)
 and ('super_admin'=any(cu.roles) or (cu.roles && array['teacher','trainer'] and exists(
 select 1 from delivery.cohort_teachers t where t.cohort_id=c.id and t.teacher_id=cu.user_id))));
$$;
create or replace function delivery.can_read_attendance(p_cohort uuid,p_student uuid default null)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select delivery.can_mark_attendance(p_cohort) or exists(select 1 from core.get_current_user() cu
 join delivery.cohorts c on c.id=p_cohort and c.deleted_at is null
 join institution.institutions i on i.id=c.institution_id and i.status='active'
 where cu.status='active' and cu.user_id is not null and (
 ('institution_admin'=any(cu.roles) and cu.tenant_id=c.institution_id) or
 (p_student=cu.user_id and 'student'=any(cu.roles) and exists(select 1 from delivery.enrollments e
 where e.cohort_id=c.id and e.user_id=cu.user_id and e.status_code='active' and e.deleted_at is null))));
$$;

create or replace function delivery.attendance_register(p_cohort uuid,p_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare c delivery.cohorts; result jsonb;begin
 if not delivery.can_read_attendance(p_cohort,p_student) then raise exception 'Access denied.';end if;
 select * into c from delivery.cohorts where id=p_cohort and deleted_at is null;
 if c.start_date is null or c.end_date is null then raise exception 'This group does not have a start and end date configured.';end if;
 if c.end_date<c.start_date or c.end_date-c.start_date>3660 then raise exception 'Attendance range must be between 1 and 3661 days.';end if;
 with roster as (
 select u.id,coalesce(u.full_name,u.email,'Student') full_name,u.email,
 min((e.enrolled_at at time zone 'Asia/Kolkata')::date) enrolled_date from delivery.enrollments e
 join core.users u on u.id=e.user_id and u.deleted_at is null and u.status='active'
 where e.cohort_id=c.id and e.deleted_at is null and e.status_code='active' and (p_student is null or u.id=p_student)
 group by u.id,u.full_name,u.email), sessions as (
 select * from delivery.attendance_sessions where cohort_id=c.id and deleted_at is null and session_date between c.start_date and c.end_date),
 records as (select r.student_id,jsonb_object_agg(s.session_date::text,r.status) statuses
 from delivery.attendance_records r join sessions s on s.id=r.session_id join roster u on u.id=r.student_id
 where r.deleted_at is null group by r.student_id)
 select jsonb_build_object('cohort',jsonb_build_object('id',c.id,'name',c.name,'code',c.code,'start_date',c.start_date,'end_date',c.end_date),
 'students',coalesce((select jsonb_agg(to_jsonb(u) order by u.full_name,u.id) from roster u),'[]'::jsonb),
 'dates',(select jsonb_agg(jsonb_build_object('date',d::date,'isSunday',extract(dow from d)=0,
 'isHoliday',coalesce(s.is_holiday,extract(dow from d)=0),'holidayName',coalesce(s.holiday_name,case when s.id is null and extract(dow from d)=0 then 'Sunday' end),
 'sessionId',s.id) order by d) from generate_series(c.start_date::timestamp,c.end_date::timestamp,interval '1 day') d left join sessions s on s.session_date=d::date),
 'records',coalesce((select jsonb_object_agg(student_id::text,statuses) from records),'{}'::jsonb)) into result;
 return result;
end $$;

create or replace function delivery.save_attendance(p_cohort uuid,p_date date,p_records jsonb default null,p_holiday boolean default null,p_name text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;c delivery.cohorts;s delivery.attendance_sessions;begin
 select * into actor from core.get_current_user();
 if not delivery.can_mark_attendance(p_cohort,actor.user_id) then raise exception 'Access denied.';end if;
 select * into c from delivery.cohorts where id=p_cohort for share;
 if p_date is null or c.start_date is null or c.end_date is null or p_date<c.start_date or p_date>c.end_date
 or p_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Attendance date must be an elapsed date within the group range.';end if;
 if not 'super_admin'=any(actor.roles) and p_date<>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Teachers can only mark attendance for the present day.';end if;
 if (p_records is null)=(p_holiday is null) then raise exception 'Provide records or a holiday change.';end if;
 if length(coalesce(p_name,''))>160 then raise exception 'Holiday name is too long.';end if;
 if p_records is not null then
   if jsonb_typeof(p_records)<>'array' then raise exception 'Attendance records must be an array.';end if;
   if jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>2500 then raise exception 'Provide between 1 and 2500 records.';end if;
   if exists(select 1 from jsonb_array_elements(p_records) r where jsonb_typeof(r)<>'object' or r->>'status' is null
     or r->>'status' not in ('present','absent','late') or r->>'student_id' is null) then raise exception 'Invalid attendance record.';end if;
   if (select count(distinct (r->>'student_id')::uuid) from jsonb_array_elements(p_records) r)<>jsonb_array_length(p_records) then raise exception 'Duplicate students.';end if;
   if exists(select 1 from jsonb_array_elements(p_records) r where not exists(select 1 from delivery.enrollments e
     join core.users u on u.id=e.user_id and u.deleted_at is null and u.status='active'
     where e.cohort_id=c.id and e.user_id=(r->>'student_id')::uuid and e.status_code='active' and e.deleted_at is null
       and (e.enrolled_at at time zone 'Asia/Kolkata')::date<=p_date)) then raise exception 'Student is not enrolled on this date.';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('attendance:'||p_cohort||':'||p_date,0));
 select * into s from delivery.attendance_sessions where cohort_id=p_cohort and session_date=p_date and deleted_at is null for update;
 if p_records is not null and coalesce(s.is_holiday,extract(dow from p_date)=0) then raise exception 'Remove the holiday before marking attendance.';end if;
 if s.id is null then
   insert into delivery.attendance_sessions(cohort_id,session_date,is_holiday,holiday_name,marked_by)
   values(p_cohort,p_date,coalesce(p_holiday,false),case when p_holiday then nullif(btrim(p_name),'') end,actor.user_id) returning * into s;
 elsif p_holiday is not null then
   update delivery.attendance_sessions set is_holiday=p_holiday,holiday_name=case when p_holiday then nullif(btrim(p_name),'') end,
   marked_by=actor.user_id,updated_at=now() where id=s.id;
 end if;
 if p_records is not null then
   insert into delivery.attendance_records(session_id,student_id,status,marked_by,marked_at)
   select s.id,(r->>'student_id')::uuid,r->>'status',actor.user_id,now() from jsonb_array_elements(p_records) r
   on conflict(session_id,student_id) where deleted_at is null do update set status=excluded.status,marked_by=excluded.marked_by,marked_at=now(),updated_at=now();
 end if;
 insert into core.dashboard_revisions(topic,domain) values('campus:'||c.institution_id,'delivery')
 on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;
 return jsonb_build_object('session_id',s.id,'saved',coalesce(jsonb_array_length(p_records),0));
end $$;
revoke all on function delivery.can_mark_attendance(uuid,uuid),delivery.can_read_attendance(uuid,uuid),delivery.attendance_register(uuid,uuid),delivery.save_attendance(uuid,date,jsonb,boolean,text) from public,anon;
grant execute on function delivery.can_mark_attendance(uuid,uuid),delivery.can_read_attendance(uuid,uuid),delivery.attendance_register(uuid,uuid),delivery.save_attendance(uuid,date,jsonb,boolean,text) to authenticated;
-- Attendance is secured here; the other delivery tables retain their deferred security pass.
alter table delivery.attendance_sessions enable row level security;
alter table delivery.attendance_records enable row level security;
revoke insert,update,delete on delivery.attendance_sessions,delivery.attendance_records from authenticated,anon;
create policy attendance_session_read on delivery.attendance_sessions for select to authenticated using(delivery.can_read_attendance(cohort_id));
create policy attendance_record_read on delivery.attendance_records for select to authenticated using(exists(select 1 from delivery.attendance_sessions s where s.id=session_id and delivery.can_read_attendance(s.cohort_id)));


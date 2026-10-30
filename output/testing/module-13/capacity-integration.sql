begin;
-- Synthetic fixture only. Run after the migration, inside BEGIN/ROLLBACK.
create temp table m56_ids as select gen_random_uuid() admin,gen_random_uuid() teacher1,gen_random_uuid() teacher2,
 gen_random_uuid() student,gen_random_uuid() other_student,gen_random_uuid() campus,gen_random_uuid() other_campus,
 gen_random_uuid() program,gen_random_uuid() other_program,gen_random_uuid() course,gen_random_uuid() module,
 gen_random_uuid() lesson,gen_random_uuid() cohort,gen_random_uuid() cohort2;
grant select on m56_ids to authenticated;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
 select id,'m56-'||id||'@example.invalid','{}','{}' from m56_ids cross join lateral unnest(array[admin,teacher1,teacher2,student,other_student]) id;
insert into institution.institutions(id,name,institution_code,institution_type,status)
 select campus,'M56 Synthetic Campus',campus::text,'college','active' from m56_ids
 union all select other_campus,'M56 Other Campus',other_campus::text,'college','active' from m56_ids;
update core.users set status='active',tenant_id=case when id=f.student then f.campus when id=f.other_student then f.other_campus else null end
 from m56_ids f where id in (f.admin,f.teacher1,f.teacher2,f.student,f.other_student);
insert into core.user_roles(user_id,role_id)
 select u.id,r.id from m56_ids f cross join lateral(values(f.admin,'super_admin'),(f.teacher1,'teacher'),(f.teacher2,'trainer'),(f.student,'student'),(f.other_student,'student'))u(id,role_name)
 join core.roles r on r.name=u.role_name on conflict do nothing;
insert into academic.programs(id,tenant_id,institution_id,title,slug,status_id)
 select program,campus,campus,'M56 Program','m56',academic.get_status_id_by_code('active') from m56_ids
 union all select other_program,other_campus,other_campus,'Other Program','m56-other',academic.get_status_id_by_code('active') from m56_ids;
insert into academic.courses(id,program_id,tenant_id,institution_id,title,slug,status_id)
 select course,program,campus,campus,'M56 Course','m56-course',academic.get_status_id_by_code('active') from m56_ids;
insert into academic.modules(id,course_id,tenant_id,institution_id,title,position)
 select module,course,campus,campus,'M56 Module',1 from m56_ids;
insert into academic.lessons(id,module_id,tenant_id,institution_id,title,position)
 select lesson,module,campus,campus,'M56 Lesson',1 from m56_ids;
insert into delivery.cohorts(id,tenant_id,institution_id,program_id,name,code,status_code,start_date,end_date)
 select cohort,campus,campus,program,'M56 Group','M56-A','active',date '2026-01-01',date '2027-12-31' from m56_ids
 union all select cohort2,campus,campus,program,'M56 Group 2','M56-B','active',date '2026-01-01',date '2027-12-31' from m56_ids;
insert into delivery.course_assignments(cohort_id,course_id,start_date,due_date)
 select cohort,course,date '2026-10-01',date '2027-01-01' from m56_ids;
insert into delivery.cohort_teachers(cohort_id,teacher_id)
 select cohort,teacher1 from m56_ids union all select cohort,teacher2 from m56_ids;
insert into delivery.enrollments(cohort_id,user_id,status_code) select cohort,student,'active' from m56_ids;



update delivery.enrollments set enrolled_at='2026-01-01' where cohort_id=(select cohort from m56_ids);

create temp table attendance_capacity_users as select gen_random_uuid() id from generate_series(1,1001);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) select id,'attendance-'||id||'@example.invalid','{}','{}' from attendance_capacity_users;
update core.users u set status='active',tenant_id=(select campus from m56_ids) from attendance_capacity_users f where u.id=f.id;
insert into core.user_roles(user_id,role_id) select u.id,r.id from attendance_capacity_users u,core.roles r where r.name='student';
insert into delivery.enrollments(cohort_id,user_id,status_code,enrolled_at) select f.cohort,u.id,'active','2026-01-01' from m56_ids f,attendance_capacity_users u;
grant select on attendance_capacity_users to authenticated;
create temp table attendance_capacity_result(students int,marks int,save_ms numeric,read_ms numeric);
grant all on attendance_capacity_result to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',admin::text,true) from m56_ids;
do $$ declare f record;payload jsonb;v jsonb;t timestamptz;save_ms numeric;read_ms numeric;d date=(now() at time zone 'Asia/Kolkata')::date;begin
 select * into f from m56_ids;
 perform delivery.save_attendance(f.cohort,d,null,false,null);
 select jsonb_agg(jsonb_build_object('student_id',id,'status','present')) into payload from attendance_capacity_users;
 t=clock_timestamp();perform delivery.save_attendance(f.cohort,d,payload);save_ms=extract(epoch from clock_timestamp()-t)*1000;
 t=clock_timestamp();v=delivery.attendance_register(f.cohort);read_ms=extract(epoch from clock_timestamp()-t)*1000;
 if jsonb_array_length(v->'students')<>1002 then raise exception 'Roster truncated above 1000';end if;
 if (select count(*) from jsonb_object_keys(v->'records'))<>1001 then raise exception 'Marks truncated above 1000';end if;
 insert into attendance_capacity_result values(jsonb_array_length(v->'students'),1001,save_ms,read_ms);
end $$;
reset role;
select * from attendance_capacity_result;
rollback;


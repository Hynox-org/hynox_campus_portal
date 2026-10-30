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
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',teacher1,'role','authenticated')::text,true) from m56_ids;
do $$ declare f record; v jsonb; today date=(now() at time zone 'Asia/Kolkata')::date;begin
 select * into f from m56_ids;
 if not delivery.can_mark_attendance(f.cohort,f.teacher1) then raise exception 'Assigned Teacher denied';end if;
 if delivery.can_mark_attendance(f.cohort,f.admin) then raise exception 'Spoofed actor accepted';end if;
 if delivery.can_mark_attendance(f.cohort2,f.teacher1) then raise exception 'Unassigned cohort accepted';end if;
 perform delivery.save_attendance(f.cohort,today,null,false,null);
 perform delivery.save_attendance(f.cohort,today,jsonb_build_array(jsonb_build_object('student_id',f.student,'status','present')));
 perform delivery.save_attendance(f.cohort,today,jsonb_build_array(jsonb_build_object('student_id',f.student,'status','late')));
 v=delivery.attendance_register(f.cohort);
 if v->'records'->(f.student::text)->>today::text <> 'late' then raise exception 'Retry/update failed';end if;
 begin
 perform delivery.save_attendance(f.cohort,today,jsonb_build_array(jsonb_build_object('student_id',f.student,'status','absent'),jsonb_build_object('student_id',f.other_student,'status','present')));
 raise exception 'Unenrolled batch accepted';exception when others then if sqlerrm='Unenrolled batch accepted' then raise;end if;end;
 v=delivery.attendance_register(f.cohort);
 if v->'records'->(f.student::text)->>today::text <> 'late' then raise exception 'Partial batch write';end if;
 begin perform delivery.save_attendance(f.cohort,today,jsonb_build_array(jsonb_build_object('student_id',f.student,'status','present'),jsonb_build_object('student_id',f.student,'status','absent')));
 raise exception 'Duplicates accepted';exception when others then if sqlerrm='Duplicates accepted' then raise;end if;end;
 begin perform delivery.save_attendance(f.cohort,today-1,null,true,'Past');raise exception 'Teacher changed past';exception when others then if sqlerrm='Teacher changed past' then raise;end if;end;
 perform delivery.save_attendance(f.cohort,today,null,true,'QA Holiday');
 begin perform delivery.save_attendance(f.cohort,today,jsonb_build_array(jsonb_build_object('student_id',f.student,'status','present')));
 raise exception 'Holiday overwritten';exception when others then if sqlerrm='Holiday overwritten' then raise;end if;end;
 perform delivery.save_attendance(f.cohort,today,null,false,null);
 begin update delivery.attendance_sessions set is_holiday=true where cohort_id=f.cohort;raise exception 'Raw write accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated')::text,true) from m56_ids;
do $$ declare f record;v jsonb;begin
 select * into f from m56_ids;
 v=delivery.attendance_register(f.cohort,f.student);
 if jsonb_array_length(v->'students')<>1 then raise exception 'Own roster mismatch';end if;
 begin perform delivery.attendance_register(f.cohort);raise exception 'Student read whole roster';exception when others then if sqlerrm='Student read whole roster' then raise;end if;end;
 begin perform delivery.attendance_register(f.cohort,f.other_student);raise exception 'Student read peer';exception when others then if sqlerrm='Student read peer' then raise;end if;end;
 begin perform delivery.save_attendance(f.cohort,(now() at time zone 'Asia/Kolkata')::date,null,true,'X');raise exception 'Student wrote';exception when others then if sqlerrm='Student wrote' then raise;end if;end;
end $$;
reset role;
do $$begin
 if (select count(*) from delivery.attendance_sessions where cohort_id=(select cohort from m56_ids))<>1 then raise exception 'Duplicate sessions';end if;
 if (select count(*) from delivery.attendance_records where student_id=(select student from m56_ids))<>1 then raise exception 'Duplicate records';end if;
end $$;
select 'PASS attendance authorization, atomic batch, retry, holidays and own-only reads' result;
rollback;

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

create function pg_temp.must_reject(statement text) returns void language plpgsql as $$
declare rejected boolean=false;
begin
 begin execute statement; exception when others then rejected=true; end;
 if not rejected then raise exception 'TEST FAILED: statement was accepted: %',statement; end if;
end $$;
do $$ declare f record; begin
 select * into f from m56_ids;
 perform pg_temp.must_reject(format('insert into academic.modules(course_id,tenant_id,institution_id,title) values(%L,%L,%L,''wrong campus'')',f.course,f.other_campus,f.other_campus));
 perform pg_temp.must_reject(format('insert into delivery.enrollments(cohort_id,user_id,status_code) values(%L,%L,''active'')',f.cohort,f.other_student));
 perform pg_temp.must_reject(format('insert into delivery.enrollments(cohort_id,user_id,status_code) values(%L,%L,''active'')',f.cohort2,f.student));
 perform pg_temp.must_reject(format('insert into delivery.course_assignments(cohort_id,course_id) values(%L,%L)',f.cohort,f.course));
 perform pg_temp.must_reject(format('insert into delivery.cohort_teachers(cohort_id,teacher_id) values(%L,%L)',f.cohort,f.student));
 perform pg_temp.must_reject(format('update delivery.cohorts set start_date=''2028-01-01'',end_date=''2027-01-01'' where id=%L',f.cohort));
 perform pg_temp.must_reject(format('update delivery.cohorts set end_date=''2026-11-01'' where id=%L',f.cohort));
 update academic.modules set deleted_at=now() where id=f.module;
 perform pg_temp.must_reject(format('insert into academic.lessons(module_id,tenant_id,institution_id,title) values(%L,%L,%L,''deleted parent'')',f.module,f.campus,f.campus));
 update academic.modules set deleted_at=null where id=f.module;
end $$;
set local role authenticated;
do $$ declare f record; begin
 select * into f from m56_ids;
 perform set_config('request.jwt.claim.sub',f.admin::text,true);
 perform academic.replace_course_instructors(f.course,array[f.teacher1,f.teacher2]);
 perform pg_temp.must_reject(format('select academic.replace_course_instructors(%L,array[%L]::uuid[])',f.course,f.student));
 if (select count(*) from academic.course_instructors where course_id=f.course)<>2 then raise exception 'TEST FAILED: invalid replacement erased teachers'; end if;
 perform academic.replace_course_instructors(f.course,array[f.teacher2]); -- teacher1 must discover/edit through the cohort alone
 if not exists(select 1 from academic.get_all_teachers() t where t.id=f.teacher1 and f.campus=any(t.mapped_tenant_ids)) then raise exception 'TEST FAILED: admin directory omitted cohort-only scope'; end if;

 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 if not academic.can_edit_course(f.course) then raise exception 'TEST FAILED: assigned teacher cannot edit course'; end if;
 if not exists(select 1 from academic.get_tenant_teachers(f.campus) t where t.id=f.teacher1) then raise exception 'TEST FAILED: instructor picker omitted cohort-only teacher'; end if;
 update academic.lessons set title='Teacher One Edit' where id=f.lesson;
 if not found then raise exception 'TEST FAILED: standalone teacher update denied'; end if;
 perform set_config('request.jwt.claim.sub',f.teacher2::text,true);
 if (select title from academic.lessons where id=f.lesson)<>'Teacher One Edit' then raise exception 'TEST FAILED: collaborator cannot read edit'; end if;
 update academic.lessons set title='Teacher Two Edit' where id=f.lesson;
 if not found then raise exception 'TEST FAILED: second teacher update denied'; end if;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);

 if not exists(select 1 from core.teacher_campus_ids(f.teacher1) id where id=f.campus) then raise exception 'TEST FAILED: standalone teacher campus missing'; end if;
 if exists(select 1 from core.teacher_campus_ids(f.teacher1) id where id=f.other_campus) then raise exception 'TEST FAILED: unrelated campus visible'; end if;
 if (select count(*) from institution.institutions where id=f.campus)<>1 then raise exception 'TEST FAILED: mapped campus hidden'; end if;
 perform pg_temp.must_reject(format('select academic.replace_course_instructors(%L,array[]::uuid[])',f.course));
 if core.can_read_dashboard_topic('campus:'||f.other_campus::text) then raise exception 'TEST FAILED: cross-campus revisions readable'; end if;
 if not core.can_read_dashboard_topic('user:'||f.teacher1::text) then raise exception 'TEST FAILED: own mapping changes hidden'; end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 update academic.lessons set title='Unauthorized' where id=f.lesson;
 if found then raise exception 'TEST FAILED: student edited lesson'; end if;
 perform pg_temp.must_reject(format('insert into academic.modules(course_id,tenant_id,institution_id,title) values(%L,%L,%L,''student write'')',f.course,f.campus,f.campus));

 if exists(select 1 from core.dashboard_revisions where topic='admin' or topic='campus:'||f.other_campus::text) then raise exception 'TEST FAILED: student saw other revisions'; end if;
 if not exists(select 1 from core.dashboard_revisions where topic='campus:'||f.campus::text) then raise exception 'TEST FAILED: campus revisions missing'; end if;
end $$;
reset role;
select 'PASS: hierarchy, dates, enrollment isolation, duplicate assignment, multi-teacher atomicity, standalone campus discovery and revision RLS' as result;

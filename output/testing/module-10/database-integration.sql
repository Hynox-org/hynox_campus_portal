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


update academic.programs set visibility_type_id=(select id from academic.visibility_types where code='tenant_only') where id=(select program from m56_ids);
update academic.courses set status_id=academic.get_status_id_by_code('active'),visibility_type_id=(select id from academic.visibility_types where code='tenant_only') where id=(select course from m56_ids);
update academic.modules set status_id=academic.get_status_id_by_code('active') where id=(select module from m56_ids);
update academic.lessons set status_id=academic.get_status_id_by_code('active') where id=(select lesson from m56_ids);
create function pg_temp.must_reject(statement text) returns void language plpgsql as $$
declare rejected boolean=false;begin begin execute statement;exception when others then rejected=true;end;
 if not rejected then raise exception 'TEST FAILED: invalid statement accepted: %',statement;end if;end $$;
set local role authenticated;
do $$ declare f record;a jsonb;project uuid;sub jsonb;again jsonb;before_progress jsonb;review jsonb;begin
 select * into f from m56_ids;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 a=learning.save_activity(null,jsonb_build_object('tenant_id',f.campus,'institution_id',f.campus,'lesson_id',f.lesson,'activity_type_code','project',
 'status_code','published','title','Project workflow QA','max_score',100,'passing_score',60,'project_overview','Synthetic only',
 'assignments',jsonb_build_array(jsonb_build_object('cohort_id',f.cohort))));
 select id into project from learning.projects where activity_id=(a->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.must_reject(format('select learning.submit_project(%L,%L,null,''javascript:alert(1)'',null)',project,f.student));
 sub=learning.submit_project(project,f.student,null,'https://github.com/hynox-qa/project','QA Notes');
 execute 'reset role'; update learning.student_activity_progress set submitted_at=now()-interval '1 day',updated_at=now()-interval '1 day' where id=(sub->>'student_activity_progress_id')::uuid; execute 'set local role authenticated';
 select to_jsonb(p) into before_progress from learning.student_activity_progress p where id=(sub->>'student_activity_progress_id')::uuid;
 again=learning.submit_project(project,f.student,null,'https://github.com/hynox-qa/project','QA Notes');
 if again<>sub then raise exception 'Identical retry changed submission';end if;
 if before_progress is distinct from (select to_jsonb(p) from learning.student_activity_progress p where id=(sub->>'student_activity_progress_id')::uuid) then raise exception 'Identical retry rewrote progress';end if;
 perform pg_temp.must_reject(format('select learning.submit_project(%L,%L,%L,''https://github.com/hynox-qa/project'',''QA Notes'')',project,f.student,gen_random_uuid()));
 perform pg_temp.must_reject(format('select learning.review_project(%L,''approved'',100,''Self review'')',sub->>'id'));
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 perform pg_temp.must_reject(format('select learning.review_project(%L,''approved'',101,''Invalid'')',sub->>'id'));
 perform pg_temp.must_reject(format('select learning.review_project(%L,''bad'',20,''Invalid'')',sub->>'id'));
 review=learning.review_project((sub->>'id')::uuid,'approved',90,'Visible feedback');
 if review->>'reviewed_by'<>f.teacher1::text then raise exception 'Wrong reviewer';end if;
 if (delivery.course_progress_snapshot(array[f.student],array[f.course])->0->>'completed_activities')::int<>1 then raise exception 'Approval did not complete activity';end if;
 perform learning.review_project((sub->>'id')::uuid,'revision_requested',30,'Revise');
 if (delivery.course_progress_snapshot(array[f.student],array[f.course])->0->>'completed_activities')::int<>0 then raise exception 'Revision retained completion';end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 again=learning.submit_project(project,f.student,null,'https://github.com/hynox-qa/revised','Updated');
 if again->>'id'<>sub->>'id' or exists(select 1 from learning.project_reviews where submission_id=(sub->>'id')::uuid) then raise exception 'Revision left stale feedback';end if;
 perform set_config('request.jwt.claim.sub',f.other_student::text,true);
 perform pg_temp.must_reject(format('select learning.submit_project(%L,%L,null,''https://github.com/hynox-qa/project'',null)',project,f.other_student));
end $$;
reset role;
select 'PASS project validation, identity, retry, review, grade bounds, feedback and revision progress' result;
rollback;



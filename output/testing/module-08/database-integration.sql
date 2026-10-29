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


-- Combined with the existing random, synthetic Module 5 setup. Run in BEGIN/ROLLBACK.
update academic.programs set status_id=(select id from academic.statuses where code='active'),visibility_type_id=(select id from academic.visibility_types where code='tenant_only') where id=(select program from m56_ids);
update academic.courses set status_id=(select id from academic.statuses where code='active'),visibility_type_id=(select id from academic.visibility_types where code='tenant_only') where id=(select course from m56_ids);
update academic.modules set status_id=(select id from academic.statuses where code='active') where id=(select module from m56_ids);
update academic.lessons set status_id=(select id from academic.statuses where code='active') where id=(select lesson from m56_ids);
create temporary table m7_ids as select gen_random_uuid() lesson2,gen_random_uuid() assessment,gen_random_uuid() quiz_activity,
  gen_random_uuid() project_activity,gen_random_uuid() coding_activity,gen_random_uuid() quiz,
  gen_random_uuid() project,gen_random_uuid() challenge,gen_random_uuid() project_submission;
grant select on m7_ids to authenticated;
insert into academic.lessons(id,module_id,tenant_id,institution_id,title,status_id,lesson_type_id)
 select x.lesson2,f.module,f.campus,f.campus,'Second learning lesson',s.id,t.id from m7_ids x,m56_ids f,academic.statuses s,academic.lesson_types t where s.code='active' and t.code='text'
 union all select x.assessment,f.module,f.campus,f.campus,'Project placement',s.id,t.id from m7_ids x,m56_ids f,academic.statuses s,academic.lesson_types t where s.code='active' and t.code='assignment';
insert into learning.activities(id,tenant_id,institution_id,lesson_id,activity_type_code,status_code,title,is_mandatory)
 select x.quiz_activity,f.campus,f.campus,f.lesson,'quiz','published','Required Quiz',true from m7_ids x,m56_ids f
 union all select x.project_activity,f.campus,f.campus,x.assessment,'project','published','Required Project',true from m7_ids x,m56_ids f
 union all select x.coding_activity,f.campus,f.campus,x.lesson2,'programming','published','Required Coding',true from m7_ids x,m56_ids f;
insert into learning.activity_assignments(activity_id,cohort_id,is_required)
 select id,f.cohort,true from learning.activities a,m56_ids f,m7_ids x where a.id in(x.quiz_activity,x.project_activity,x.coding_activity);
insert into learning.quizzes(id,activity_id,max_attempts) select quiz,quiz_activity,5 from m7_ids;
insert into learning.projects(id,activity_id,project_overview) select project,project_activity,'QA Project' from m7_ids;
insert into learning.programming_challenges(id,activity_id,problem_statement,difficulty_level) select challenge,coding_activity,'QA Code','easy' from m7_ids;
insert into learning.student_activity_progress(student_id,activity_id,activity_assignment_id,status_code)
 select f.student,a.activity_id,a.id,'started' from learning.activity_assignments a,m56_ids f,m7_ids x
 where a.activity_id in(x.quiz_activity,x.project_activity,x.coding_activity);

create function pg_temp.must_reject(statement text) returns void language plpgsql as $$
declare rejected boolean=false;begin
 begin execute statement;exception when others then rejected=true;end;
 if not rejected then raise exception 'TEST FAILED: accepted invalid statement: %',statement;end if;
end $$;
set local role authenticated;
do $$ declare f record;x record;payload jsonb;a jsonb;sub jsonb;again jsonb;review jsonb;before_count integer;revision bigint;begin
 select * into f from m56_ids;select * into x from m7_ids;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 select count(*) into before_count from learning.activities where tenant_id=f.campus;
 payload=jsonb_build_object('tenant_id',f.campus,'institution_id',f.campus,'lesson_id',f.lesson,'activity_type_code','quiz',
   'status_code','published','title','Atomic quiz','max_score',100,'passing_score',50,'quiz_max_attempts',1,
   'questions',jsonb_build_array(jsonb_build_object('question_text','Broken','question_type','single_choice','points',10,'options','[]'::jsonb)),
   'assignments',jsonb_build_array(jsonb_build_object('cohort_id',f.cohort)));
 perform pg_temp.must_reject(format('select learning.save_activity(null,%L)',payload::text));
 if (select count(*) from learning.activities where tenant_id=f.campus)<>before_count then raise exception 'Failed bundle left an orphan activity';end if;
 payload=jsonb_set(payload,'{questions,0,options}','[{"optionText":"A","isCorrect":true,"position":1},{"optionText":"B","isCorrect":false,"position":2}]');
 a=learning.save_activity(null,payload);
 if a->>'status_code'<>'published' or not exists(select 1 from learning.activity_assignments where activity_id=(a->>'id')::uuid and cohort_id=f.cohort) then raise exception 'Valid bundle did not publish and assign atomically';end if;
 again=learning.assign_activity(jsonb_build_object('activity_id',a->>'id','cohort_id',f.cohort,'is_required',false));
 if (select count(*) from learning.activity_assignments where activity_id=(a->>'id')::uuid)<>1 then raise exception 'Assignment retry duplicated rows';end if;
 perform pg_temp.must_reject(format('select learning.assign_activity(%L)',jsonb_build_object('activity_id',a->>'id','cohort_id',f.cohort2)::text));
 perform pg_temp.must_reject(format('select learning.assign_activity(%L)',jsonb_build_object('activity_id',a->>'id','cohort_id',f.cohort,'available_from','2028-01-01')::text));
 select d.revision into revision from core.dashboard_revisions d where topic='campus:'||f.campus and domain='delivery';
 if revision is null then raise exception 'Activity changes did not publish a protected live revision';end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.must_reject(format('select learning.save_activity(null,%L)',payload::text));
 perform pg_temp.must_reject(format('select learning.submit_project(%L,%L,null,''javascript:alert(1)'',null)',x.project,f.student));
 sub=learning.submit_project(x.project,f.student,null,'https://github.com/hynox-qa/project','Synthetic QA');
 again=learning.submit_project(x.project,f.student,null,'https://github.com/hynox-qa/project','Synthetic QA');
 if again->>'id'<>sub->>'id' then raise exception 'Project retry duplicated submission';end if;
 perform pg_temp.must_reject(format('select learning.submit_project(%L,%L,null,''https://github.com/hynox-qa/changed'',null)',x.project,f.student));
 perform pg_temp.must_reject(format('select learning.review_project(%L,''approved'',100,''self review'')',sub->>'id'));
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 perform pg_temp.must_reject(format('select learning.review_project(%L,''approved'',101,''invalid score'')',sub->>'id'));
 review=learning.review_project((sub->>'id')::uuid,'approved',90,'Approved');
 if review->>'reviewed_by'<>f.teacher1::text then raise exception 'Reviewer identity was not server-derived';end if;
 if delivery.course_progress_snapshot(array[f.student],array[f.course])->0->>'completed_activities'<>'1' then raise exception 'Approved project did not count toward progress';end if;
 perform set_config('request.jwt.claim.sub',f.teacher2::text,true);
 perform learning.review_project((sub->>'id')::uuid,'revision_requested',30,'Revise');
 if delivery.course_progress_snapshot(array[f.student],array[f.course])->0->>'completed_activities'<>'0' then raise exception 'Revision did not remove completion credit';end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform learning.submit_project(x.project,f.student,null,'https://github.com/hynox-qa/revised','Updated');
 if exists(select 1 from learning.project_reviews where submission_id=(sub->>'id')::uuid) then raise exception 'Resubmission retained stale review';end if;
 perform pg_temp.must_reject(format('select learning.submit_code(%L,%L,null,''python'',''print(1)'')',x.challenge,f.student));
end $$;
reset role;
insert into learning.challenge_test_cases(challenge_id,input_data,expected_output,is_hidden)
 select challenge,'','1',true from m7_ids;
set local role authenticated;
do $$ declare f record;x record;sub jsonb;again jsonb;prog jsonb;begin
 select * into f from m56_ids;select * into x from m7_ids;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 if exists(select 1 from learning.challenge_test_cases where challenge_id=x.challenge) then raise exception 'Hidden tests leaked';end if;
 prog=learning.start_coding_activity(x.coding_activity,f.student);
 sub=learning.submit_code(x.challenge,f.student,(prog->>'id')::uuid,'python','print(1)');
 again=learning.submit_code(x.challenge,f.student,(prog->>'id')::uuid,'python','print(1)');
 if sub->>'id'<>again->>'id' then raise exception 'Code retry created another job';end if;
 perform pg_temp.must_reject(format('select learning.submit_code(%L,%L,null,''python'',''print(2)'')',x.challenge,f.student));
 update learning.challenge_submissions set submission_status_code='accepted' where id=(sub->>'id')::uuid;
 -- UPDATE under RLS can legally return no rows: explicitly assert that no forged acceptance occurred.
 if exists(select 1 from learning.challenge_submissions where id=(sub->>'id')::uuid and submission_status_code='accepted') then raise exception 'Student forged acceptance';end if;
 perform set_config('request.jwt.claim.sub',f.other_student::text,true);
 perform pg_temp.must_reject(format('select learning.submit_project(%L,%L,null,''https://github.com/hynox-qa/project'',null)',x.project,f.other_student));
 perform pg_temp.must_reject(format('select learning.submit_code(%L,%L,null,''python'',''print(1)'')',x.challenge,f.other_student));
end $$;
reset role;
select 'PASS: atomic activity publishing, assignment retries and isolation, project review/progress, code queue and hidden-test protection' result;

rollback;
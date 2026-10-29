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
create function pg_temp.check_progress(expected numeric,lessons integer,activities integer,expected_status text) returns void language plpgsql as $$
declare r jsonb; f record; begin
 select * into f from m56_ids;
 r=delivery.course_progress_snapshot(array[f.student],array[f.course])->0;
 if (r->>'progress_percentage')::numeric<>expected or (r->>'total_lessons')::integer<>lessons
    or (r->>'total_activities')::integer<>activities or r->>'status_code'<>expected_status then
   raise exception 'Progress mismatch: expected % with % lessons and % activities (%), got %',expected,lessons,activities,expected_status,r;
 end if;
end $$;
set local role authenticated;
do $$ declare f record; x record; a uuid; q jsonb; first_start timestamptz; begin
 select * into f from m56_ids;select * into x from m7_ids;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(0,2,3,'not_started');
 if exists(select 1 from delivery.course_progress where user_id=f.student and course_id=f.course) then raise exception 'Read-only snapshot wrote progress'; end if;
 q=delivery.set_lesson_progress(f.student,f.lesson,f.course,false);
 if q->'progress'->>'status_code'<>'in_progress' then raise exception 'Lesson start did not start';end if;
 q=delivery.set_lesson_progress(f.student,f.lesson,f.course,true);
 first_start=(q->'progress'->>'started_at')::timestamptz;
 q=delivery.set_lesson_progress(f.student,f.lesson,f.course,false);
 if q->'progress'->>'status_code'<>'completed' or (q->'progress'->>'started_at')::timestamptz is distinct from first_start then raise exception 'Reopening downgraded/reset a completed lesson';end if;
 perform pg_temp.check_progress(20,2,3,'in_progress');
 select id into a from learning.student_activity_progress where student_id=f.student and activity_id=x.quiz_activity;
 -- Seed trusted grading evidence as fixture owner; Student writes are separately denied in Module 8/9.
 execute 'reset role';
 insert into learning.quiz_attempts(quiz_id,student_id,student_activity_progress_id,attempt_number,submitted_at,passed,score,max_score)
 values(x.quiz,f.student,a,1,now(),false,0,10);
 execute 'set local role authenticated';
 perform pg_temp.check_progress(20,2,3,'in_progress');
 -- Seed trusted grading evidence as fixture owner; Student writes are separately denied in Module 8/9.
 execute 'reset role';
 insert into learning.quiz_attempts(quiz_id,student_id,student_activity_progress_id,attempt_number,submitted_at,passed,score,max_score)
 values(x.quiz,f.student,a,2,now(),true,10,10);
 execute 'set local role authenticated';
 perform pg_temp.check_progress(40,2,3,'in_progress');
 -- Seed trusted grading evidence as fixture owner; Student writes are separately denied in Module 8/9.
 execute 'reset role';
 insert into learning.quiz_attempts(quiz_id,student_id,student_activity_progress_id,attempt_number,submitted_at,passed,score,max_score)
 values(x.quiz,f.student,a,3,now(),true,10,10);
 execute 'set local role authenticated';
 perform pg_temp.check_progress(40,2,3,'in_progress'); -- repeated passing attempts give one activity credit
 select id into a from learning.student_activity_progress where student_id=f.student and activity_id=x.project_activity;
 -- Seed trusted grading evidence as fixture owner; Student writes are separately denied in Module 8/9.
 execute 'reset role';
 insert into learning.project_submissions(id,project_id,student_id,student_activity_progress_id,github_url)
 values(x.project_submission,x.project,f.student,a,'https://github.com/example/qa');
 execute 'set local role authenticated';
 perform pg_temp.check_progress(40,2,3,'in_progress');
 -- Teacher review and student completion are separate operations.
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 perform learning.review_project(x.project_submission,'approved',80,'Fixture approval');
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(60,2,3,'in_progress');
 select id into a from learning.student_activity_progress where student_id=f.student and activity_id=x.coding_activity;
 -- Seed trusted grading evidence as fixture owner; Student writes are separately denied in Module 8/9.
 execute 'reset role';
 insert into learning.challenge_submissions(challenge_id,student_id,student_activity_progress_id,language,source_code,submission_status_code)
 values(x.challenge,f.student,a,'python','print(1)','accepted');
 execute 'set local role authenticated';
 perform pg_temp.check_progress(80,2,3,'in_progress');
 q=delivery.set_lesson_progress(f.student,x.lesson2,f.course,true);
 perform pg_temp.check_progress(100,2,3,'completed');
 q=delivery.refresh_course_progress(f.student,f.course);first_start=(q->>'started_at')::timestamptz;
 q=delivery.refresh_course_progress(f.student,f.course);
 if (q->>'started_at')::timestamptz is distinct from first_start then raise exception 'Repeated refresh reset started_at';end if;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 perform learning.review_project(x.project_submission,'revision_requested',20,'Fixture revision');
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(80,2,3,'in_progress');
 -- A stale stored 100 percent must not override current review evidence.
 q=delivery.course_progress_snapshot(array[f.student],array[f.course])->0;
 if (q->>'completed_at') is not null then raise exception 'Incomplete course retained completion timestamp';end if;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 update learning.activities set status_code='archived' where id=x.quiz_activity;
 if not found then raise exception 'QA setup could not archive the activity';end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(75,2,2,'in_progress');
end $$;
reset role;
-- Add another active program enrollment and a required activity in that other course.
create temporary table m7_other as select gen_random_uuid() program,gen_random_uuid() course,gen_random_uuid() module,
 gen_random_uuid() lesson,gen_random_uuid() cohort,gen_random_uuid() activity;
insert into academic.programs(id,tenant_id,institution_id,title,slug,status_id,visibility_type_id)
 select x.program,f.campus,f.campus,'Other QA Program','other-'||x.program,s.id,v.id from m7_other x,m56_ids f,academic.statuses s,academic.visibility_types v where s.code='active' and v.code='tenant_only';
insert into academic.courses(id,program_id,tenant_id,institution_id,title,slug,status_id,visibility_type_id)
 select x.course,x.program,f.campus,f.campus,'Other QA Course','other-'||x.course,s.id,v.id from m7_other x,m56_ids f,academic.statuses s,academic.visibility_types v where s.code='active' and v.code='tenant_only';
insert into academic.modules(id,course_id,tenant_id,institution_id,title,status_id)
 select x.module,x.course,f.campus,f.campus,'Other QA Module',s.id from m7_other x,m56_ids f,academic.statuses s where s.code='active';
insert into academic.lessons(id,module_id,tenant_id,institution_id,title,status_id)
 select x.lesson,x.module,f.campus,f.campus,'Other QA Lesson',s.id from m7_other x,m56_ids f,academic.statuses s where s.code='active';
insert into delivery.cohorts(id,tenant_id,institution_id,program_id,name,code,status_code)
 select x.cohort,f.campus,f.campus,x.program,'Other QA Group','other-'||x.cohort,'active' from m7_other x,m56_ids f;
insert into delivery.enrollments(user_id,cohort_id,status_code) select f.student,x.cohort,'active' from m7_other x,m56_ids f;
insert into delivery.course_assignments(cohort_id,course_id) select cohort,course from m7_other;
insert into learning.activities(id,tenant_id,institution_id,lesson_id,activity_type_code,status_code,title,is_mandatory)
 select x.activity,f.campus,f.campus,x.lesson,'quiz','published','Other course quiz',true from m7_other x,m56_ids f;
insert into learning.activity_assignments(activity_id,cohort_id,is_required) select activity,cohort,true from m7_other;
-- Optional, draft, archived, deleted, unassigned and foreign-course content must not inflate totals.
insert into learning.activities(tenant_id,institution_id,lesson_id,activity_type_code,status_code,title,is_mandatory,deleted_at)
 select f.campus,f.campus,f.lesson,'quiz',v.status,v.title,v.mandatory,v.deleted from m56_ids f cross join
 (values('published','QA Optional',false,null::timestamptz),('draft','QA Draft',true,null::timestamptz),
 ('published','QA Deleted',true,now()),('published','QA Unassigned',true,null::timestamptz),('published','QA Assignment Optional',true,null::timestamptz)) v(status,title,mandatory,deleted);
insert into learning.activity_assignments(activity_id,cohort_id,is_required)
 select a.id,f.cohort,a.title<>'QA Assignment Optional' from learning.activities a,m56_ids f where a.tenant_id=f.campus and a.title like 'QA %' and a.title<>'QA Unassigned';
set local role authenticated;
do $$ declare f record; denied boolean=false;begin
 select * into f from m56_ids;perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(75,2,2,'in_progress');
 perform set_config('request.jwt.claim.sub',f.other_student::text,true);
 begin perform delivery.course_progress_snapshot(array[f.student],array[f.course]);exception when others then denied=true;end;
 if not denied then raise exception 'Cross-student progress access accepted';end if;
 denied=false;
 begin perform delivery.set_lesson_progress(f.student,f.lesson,f.course,true);exception when others then denied=true;end;
 if not denied then raise exception 'Cross-student lesson completion accepted';end if;
end $$;
reset role;
-- Curriculum changes recalculate the denominator without overwriting stored rows on read.
update learning.activities set deleted_at=now() where id=(select coding_activity from m7_ids);
set local role authenticated;
do $$declare f record;begin select * into f from m56_ids;perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(66.67,2,1,'in_progress');end $$;
reset role;
update academic.lessons set deleted_at=now() where id=(select lesson2 from m7_ids);
set local role authenticated;
do $$declare f record;begin select * into f from m56_ids;perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(50,1,1,'in_progress');end $$;
reset role;
update learning.activity_assignments set is_required=false where activity_id=(select project_activity from m7_ids);
set local role authenticated;
do $$declare f record;begin select * into f from m56_ids;perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(100,1,0,'completed');end $$;
reset role;
update academic.modules set deleted_at=now() where id=(select module from m56_ids);
set local role authenticated;
do $$declare f record;begin select * into f from m56_ids;perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.check_progress(0,0,0,'not_started');end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','delivery.course_progress_snapshot(uuid[],uuid[])','execute') then raise exception 'Anonymous access granted';end if;
end $$;

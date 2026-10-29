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
do $$ declare f record;x record;question jsonb;attempt jsonb;again jsonb;result jsonb;content jsonb;key uuid;wrong uuid;begin
 select * into f from m56_ids;select * into x from m7_ids;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 update learning.activities set passing_score=60,max_score=100,title='Shared Quiz' where id=x.quiz_activity;
 if not found then raise exception 'Assigned standalone teacher cannot edit activity';end if;
 question=learning.save_quiz_question(x.quiz,null,'Choose A','single_choice',10,1,
   '[{"optionText":"A","isCorrect":true,"position":1},{"optionText":"B","isCorrect":false,"position":2}]');
 key=(question->'options'->0->>'id')::uuid;wrong=(question->'options'->1->>'id')::uuid;
 perform pg_temp.must_reject(format('select learning.save_quiz_question(%L,%L,''changed'',''single_choice'',10,1,''[]'')',x.quiz,question->>'id'));
 if (select question_text from learning.quiz_questions where id=(question->>'id')::uuid)<>'Choose A' then raise exception 'Invalid edit erased question';end if;
 perform set_config('request.jwt.claim.sub',f.teacher2::text,true);
 content=learning.quiz_content(x.quiz_activity,null,true);
 if content->'quiz'->>'id'<>x.quiz::text or content->'questions'->0->'options'->0->>'is_correct'<>'true' then raise exception 'Collaborator cannot see answer key';end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 perform pg_temp.must_reject(format('select learning.quiz_content(%L,null,true)',x.quiz_activity));
 perform pg_temp.must_reject('select is_correct from learning.quiz_options limit 1');
 perform pg_temp.must_reject(format('select learning.start_quiz(%L,%L,%L)',x.quiz,f.student,gen_random_uuid()));
 attempt=learning.start_quiz(x.quiz,f.student,null);
 again=learning.start_quiz(x.quiz,f.student,null);
 if again->>'id'<>attempt->>'id' then raise exception 'Retry created a duplicate active attempt';end if;
 content=learning.quiz_content(x.quiz_activity,(attempt->>'id')::uuid,false);
 if content::text like '%is_correct%' or content::text like '%correctIndex%' then raise exception 'Active session leaked answer key';end if;
 perform pg_temp.must_reject(format('select learning.finish_quiz(%L,%L)',attempt->>'id',jsonb_build_array(jsonb_build_object('questionId',question->>'id','selectedOptionId',key),jsonb_build_object('questionId',question->>'id','selectedOptionId',key))::text));
 result=learning.finish_quiz((attempt->>'id')::uuid,jsonb_build_array(jsonb_build_object('questionId',question->>'id','selectedOptionId',key)));
 if result->>'passed'<>'true' or (result->>'score')::numeric<>10 or (result->>'max_score')::numeric<>10 then raise exception '10/10 against 60/100 threshold did not pass';end if;
 again=learning.finish_quiz((attempt->>'id')::uuid,'[]');
 if again->>'score'<>result->>'score' or (select count(*) from learning.quiz_answers where attempt_id=(attempt->>'id')::uuid)<>1 then raise exception 'Retry changed grading or duplicated answers';end if;
 perform pg_temp.must_reject(format('select learning.start_quiz(%L,%L,null)',x.quiz,f.student));
 perform pg_temp.must_reject(format('insert into learning.quiz_attempts(quiz_id,student_id,student_activity_progress_id) values(%L,%L,%L)',x.quiz,f.student,attempt->>'student_activity_progress_id'));
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 perform pg_temp.must_reject(format('select learning.approve_quiz_retake(%L)',attempt->>'id'));
 perform pg_temp.must_reject(format('select learning.save_quiz_question(%L,%L,''changed'',''single_choice'',10,1,%L)',x.quiz,question->>'id','[{"optionText":"A","isCorrect":true,"position":1},{"optionText":"B","isCorrect":false,"position":2}]'));
 perform pg_temp.must_reject(format('delete from learning.quiz_questions where id=%L',question->>'id'));
 perform set_config('request.jwt.claim.sub',f.other_student::text,true);
 perform pg_temp.must_reject(format('select learning.start_quiz(%L,%L,null)',x.quiz,f.other_student));
 perform pg_temp.must_reject(format('select learning.finish_quiz(%L,''[]'')',attempt->>'id'));
 if exists(select 1 from learning.quiz_attempts where id=(attempt->>'id')::uuid) then raise exception 'Other campus can read attempt';end if;
end $$;
reset role;
-- A second quiz exercises failed attempt limits, exactly-once retake credit and short answers.
create temporary table m9_ids as select gen_random_uuid() activity,gen_random_uuid() quiz;
grant select on m9_ids to authenticated;
insert into learning.activities(id,tenant_id,institution_id,lesson_id,activity_type_code,status_code,title,max_score,passing_score)
 select x.activity,f.campus,f.campus,f.lesson,'quiz','published','Retake quiz',100,80 from m9_ids x,m56_ids f;
insert into learning.quizzes(id,activity_id,max_attempts,time_limit_minutes) select quiz,activity,1,1 from m9_ids;
insert into learning.activity_assignments(activity_id,cohort_id) select activity,cohort from m9_ids,m56_ids;
set local role authenticated;
do $$ declare f record;x record;question jsonb;attempt jsonb;result jsonb;begin
 select * into f from m56_ids;select * into x from m9_ids;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 question=learning.save_quiz_question(x.quiz,null,'Type campus','short_answer',5,1,'[{"optionText":"Campus","isCorrect":true,"position":1}]');
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 if learning.quiz_content(x.activity)->'questions'->0->'options'<>'[]'::jsonb then raise exception 'Short answer text leaked';end if;
 attempt=learning.start_quiz(x.quiz,f.student,null);
 result=learning.finish_quiz((attempt->>'id')::uuid,'[]');
 if result->>'passed'<>'false' then raise exception 'Blank answer passed';end if;
 perform pg_temp.must_reject(format('select learning.start_quiz(%L,%L,null)',x.quiz,f.student));
 perform pg_temp.must_reject(format('select learning.approve_quiz_retake(%L)',attempt->>'id'));
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 perform learning.approve_quiz_retake((attempt->>'id')::uuid);
 perform learning.approve_quiz_retake((attempt->>'id')::uuid);
 if (select count(*) from learning.quiz_retake_approvals where attempt_id=(attempt->>'id')::uuid)<>1 then raise exception 'Duplicate credit';end if;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 attempt=learning.start_quiz(x.quiz,f.student,null);
 if (attempt->>'attempt_number')::integer<>2 then raise exception 'Retake did not preserve history';end if;
 result=learning.finish_quiz((attempt->>'id')::uuid,jsonb_build_array(jsonb_build_object('questionId',question->>'id','answerText','  CAMPUS  ')));
 if result->>'passed'<>'true' then raise exception 'Short answer normalization failed';end if;
end $$;
reset role;
set local role authenticated;
do $$ declare f record;payload jsonb;a jsonb;content jsonb;attempt jsonb;result jsonb;q1 uuid;q2 uuid;o1 uuid;o2 uuid;truth uuid;begin
 select * into f from m56_ids;perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 payload=jsonb_build_object('tenant_id',f.campus,'institution_id',f.campus,'lesson_id',f.lesson,'activity_type_code','quiz',
   'status_code','published','title','Question format matrix','max_score',100,'passing_score',60,'quiz_max_attempts',2,'quiz_time_limit',1,
   'questions','[{"question_text":"Select both","question_type":"multiple_choice","points":1,"position":1,"options":[{"optionText":"A","isCorrect":true,"position":1},{"optionText":"B","isCorrect":true,"position":2},{"optionText":"C","isCorrect":false,"position":3}]},{"question_text":"True?","question_type":"true_false","points":1,"position":2,"options":[{"optionText":"True","isCorrect":true,"position":1},{"optionText":"False","isCorrect":false,"position":2}]}]'::jsonb,
   'assignments',jsonb_build_array(jsonb_build_object('cohort_id',f.cohort)));
 a=learning.save_activity(null,payload);content=learning.quiz_content((a->>'id')::uuid,null,true);
 q1=(content->'questions'->0->>'id')::uuid;q2=(content->'questions'->1->>'id')::uuid;
 o1=(content->'questions'->0->'options'->0->>'id')::uuid;o2=(content->'questions'->0->'options'->1->>'id')::uuid;
 truth=(content->'questions'->1->'options'->0->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 attempt=learning.start_quiz((content->'quiz'->>'id')::uuid,f.student,null);
 perform pg_temp.must_reject(format('select learning.finish_quiz(%L,%L)',attempt->>'id',jsonb_build_array(jsonb_build_object('questionId',q1,'selectedOptionId',truth))::text));
 perform pg_temp.must_reject(format('select learning.finish_quiz(%L,%L)',attempt->>'id',jsonb_build_array(jsonb_build_object('questionId',q1,'selectedOptionId',o1),jsonb_build_object('questionId',q1,'selectedOptionId',o1))::text));
 result=learning.finish_quiz((attempt->>'id')::uuid,jsonb_build_array(jsonb_build_object('questionId',q1,'selectedOptionId',o1),jsonb_build_object('questionId',q2,'selectedOptionId',truth)));
 if (result->>'score')::numeric<>1 or result->>'passed'<>'false' then raise exception 'Partial multiple choice or score scaling failed';end if;
 attempt=learning.start_quiz((content->'quiz'->>'id')::uuid,f.student,null);
 result=learning.finish_quiz((attempt->>'id')::uuid,jsonb_build_array(jsonb_build_object('questionId',q1,'selectedOptionId',o1),jsonb_build_object('questionId',q1,'selectedOptionId',o2),jsonb_build_object('questionId',q2,'selectedOptionId',truth)));
 if (result->>'score')::numeric<>2 or result->>'passed'<>'true' then raise exception 'Exact multiple choice and true/false grading failed';end if;
 perform set_config('request.jwt.claim.sub',f.teacher1::text,true);
 content=learning.quiz_content((a->>'id')::uuid,(attempt->>'id')::uuid,true);
 if content->'questions'->0->>'is_correct'<>'true' or (content->'questions'->0->>'points_awarded')::numeric<>1 then raise exception 'Teacher review differs from stored verdict';end if;
 a=learning.save_activity(null,payload||'{"title":"Deadline matrix"}');content=learning.quiz_content((a->>'id')::uuid,null,true);
 perform set_config('request.jwt.claim.sub',f.student::text,true);
 attempt=learning.start_quiz((content->'quiz'->>'id')::uuid,f.student,null);
 execute 'reset role';update learning.quiz_attempts set started_at=now()-interval '3 minutes' where id=(attempt->>'id')::uuid;execute 'set local role authenticated';
 result=learning.finish_quiz((attempt->>'id')::uuid,'[]');
 if result->>'forfeited'<>'true' or result->>'passed'<>'false' or result->>'submitted_at' is null then raise exception 'Expired attempt remained open';end if;
end $$;
reset role;
select 'PASS: synthetic quiz authorization, score scale, retry, retake, answer protection and question integrity' result;

rollback;
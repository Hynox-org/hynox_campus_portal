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

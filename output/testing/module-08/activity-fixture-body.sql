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

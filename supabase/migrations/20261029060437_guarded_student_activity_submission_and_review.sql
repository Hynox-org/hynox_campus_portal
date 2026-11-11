create or replace function learning.begin_student_activity(p_activity uuid,p_student uuid,p_progress uuid)
returns learning.student_activity_progress language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;assignment uuid;prog learning.student_activity_progress;begin
 select * into actor from core.get_current_user();
 if actor.user_id is null or actor.user_id is distinct from p_student or actor.status<>'active' or not 'student'=any(actor.roles)
   or not learning.can_read_activity(p_activity,true) then raise exception 'This activity is unavailable.';end if;
 perform pg_advisory_xact_lock(hashtextextended('activity:'||p_student||':'||p_activity,0));
 select aa.id into assignment from learning.activity_assignments aa
 join delivery.enrollments e on e.cohort_id=aa.cohort_id and e.user_id=p_student and e.status_code='active' and e.deleted_at is null
 join delivery.cohorts co on co.id=aa.cohort_id and co.deleted_at is null and co.status_code='active'
 join learning.activities a on a.id=aa.activity_id join academic.lessons l on l.id=a.lesson_id join academic.modules m on m.id=l.module_id
 join delivery.course_assignments ca on ca.cohort_id=co.id and ca.course_id=m.course_id and ca.deleted_at is null
 where aa.activity_id=p_activity and aa.deleted_at is null and (aa.available_from is null or aa.available_from<=now())
   and (aa.available_until is null or aa.available_until>=now()) order by aa.created_at,aa.id limit 1;
 if assignment is null then raise exception 'No active activity assignment.';end if;
 if p_progress is not null and not exists(select 1 from learning.student_activity_progress p where p.id=p_progress
   and p.student_id=p_student and p.activity_id=p_activity and p.activity_assignment_id=assignment and p.deleted_at is null)
   then raise exception 'Invalid activity progress.';end if;
 insert into learning.student_activity_progress(student_id,activity_id,activity_assignment_id,status_code,started_at,submitted_at)
 values(p_student,p_activity,assignment,'submitted',now(),now()) on conflict(student_id,activity_assignment_id) do update
 set status_code='submitted',submitted_at=now(),started_at=coalesce(learning.student_activity_progress.started_at,now()),
   updated_at=now(),score=null,completed_at=null,reviewed_at=null,reviewed_by=null,feedback=null,deleted_at=null returning * into prog;
 return prog;
end $$;
revoke all on function learning.begin_student_activity(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function learning.submit_project(p_project uuid,p_student uuid,p_progress uuid,p_url text,p_notes text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare project learning.projects;prog learning.student_activity_progress;sub learning.project_submissions;review learning.project_reviews;begin
 if p_url is null or p_url !~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'
  or length(p_url)>2000 or length(coalesce(p_notes,''))>20000 then raise exception 'Provide a valid HTTPS GitHub repository URL and bounded notes.';end if;
 select * into project from learning.projects where id=p_project;
 prog=learning.begin_student_activity(project.activity_id,p_student,p_progress);
 select * into sub from learning.project_submissions where project_id=p_project and student_id=p_student for update;
 if sub.id is not null then
   select * into review from learning.project_reviews where submission_id=sub.id;
   if review.id is null and sub.github_url=p_url and coalesce(sub.submission_notes,'')=coalesce(p_notes,'') then return to_jsonb(sub);end if;
   if review.review_status is null or review.review_status not in ('rejected','revision_requested') then raise exception 'This project is awaiting review or already approved.';end if;
 end if;
 insert into learning.project_submissions(project_id,student_id,student_activity_progress_id,github_url,submission_notes)
 values(p_project,p_student,prog.id,p_url,nullif(p_notes,'')) on conflict(project_id,student_id) do update
 set student_activity_progress_id=prog.id,github_url=excluded.github_url,submission_notes=excluded.submission_notes,submitted_at=now(),updated_at=now() returning * into sub;
 delete from learning.project_reviews where submission_id=sub.id;
 return to_jsonb(sub);
end $$;

create or replace function learning.review_project(p_submission uuid,p_status text,p_score numeric,p_feedback text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;sub learning.project_submissions;project learning.projects;prog learning.student_activity_progress;review learning.project_reviews;course uuid;cohort uuid;begin
 select * into actor from core.get_current_user();
 select * into sub from learning.project_submissions where id=p_submission for update;
 select * into project from learning.projects where id=sub.project_id;
 select * into prog from learning.student_activity_progress where id=sub.student_activity_progress_id;
 select cohort_id into cohort from learning.activity_assignments where id=prog.activity_assignment_id;
 if actor.user_id is null or sub.id is null or not learning.can_manage_assignment(project.activity_id,cohort) then raise exception 'Access denied.';end if;
 if p_status is null or p_status not in ('pending','approved','rejected','revision_requested') or p_score is null or p_score<0
   or p_score>coalesce(project.max_score,100) or length(coalesce(p_feedback,''))>20000 then raise exception 'Invalid review status, score or feedback.';end if;
 insert into learning.project_reviews(submission_id,reviewed_by,score,feedback,review_status,reviewed_at)
 values(sub.id,actor.user_id,p_score,p_feedback,p_status,now()) on conflict(submission_id) do update
 set reviewed_by=actor.user_id,score=p_score,feedback=p_feedback,review_status=p_status,reviewed_at=now() returning * into review;
 update learning.student_activity_progress set status_code=case p_status when 'approved' then 'completed' when 'rejected' then 'failed'
   when 'revision_requested' then 'started' else 'review_pending' end,score=p_score,reviewed_at=now(),reviewed_by=actor.user_id,
   feedback=p_feedback,completed_at=case when p_status='approved' then now() else null end,updated_at=now() where id=prog.id;
 select m.course_id into course from learning.activities a join academic.lessons l on l.id=a.lesson_id join academic.modules m on m.id=l.module_id where a.id=project.activity_id;
 perform delivery.refresh_course_progress(sub.student_id,course);
 return to_jsonb(review);
end $$;

create or replace function learning.submit_code(p_challenge uuid,p_student uuid,p_progress uuid,p_language text,p_source text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare challenge learning.programming_challenges;prog learning.student_activity_progress;sub learning.challenge_submissions;used integer;begin
 if p_language is null or p_language not in ('python','javascript','typescript','java','cpp','c')
   or p_source is null or length(btrim(p_source))=0 or octet_length(p_source)>100000 then raise exception 'Invalid language or source code.';end if;
 select * into challenge from learning.programming_challenges where id=p_challenge;
 prog=learning.begin_student_activity(challenge.activity_id,p_student,p_progress);
 select * into sub from learning.challenge_submissions where challenge_id=p_challenge and student_id=p_student
   and submission_status_code in ('pending','running') order by submitted_at desc limit 1;
 if sub.id is not null then
   if sub.language=p_language and sub.source_code=p_source then return to_jsonb(sub);end if;
   raise exception 'A submission is already being graded.';
 end if;
 if exists(select 1 from learning.challenge_submissions where challenge_id=p_challenge and student_id=p_student and submission_status_code='accepted') then raise exception 'You have already passed this challenge.';end if;
 select count(*) into used from learning.challenge_submissions where challenge_id=p_challenge and student_id=p_student;
 if used>=coalesce(challenge.max_attempts,3) then raise exception 'Maximum attempts limit reached for this coding challenge.';end if;
 if not exists(select 1 from learning.challenge_test_cases where challenge_id=p_challenge) then raise exception 'This challenge needs test cases before submission.';end if;
 insert into learning.challenge_submissions(challenge_id,student_id,student_activity_progress_id,language,source_code,submission_status_code)
 values(p_challenge,p_student,prog.id,p_language,p_source,'pending') returning * into sub;
 update learning.student_activity_progress set attempt_number=used+1 where id=prog.id;
 insert into learning.challenge_execution_queue(submission_id,status) values(sub.id,'queued');
 return to_jsonb(sub);
end $$;
revoke all on function learning.submit_project(uuid,uuid,uuid,text,text),learning.review_project(uuid,text,numeric,text),
 learning.submit_code(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function learning.submit_project(uuid,uuid,uuid,text,text),learning.review_project(uuid,text,numeric,text),
 learning.submit_code(uuid,uuid,uuid,text,text) to authenticated;

create or replace function learning.can_read_progress(p_student uuid,p_activity uuid,p_assignment uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from core.get_current_user() cu join learning.activity_assignments aa on aa.id=p_assignment and aa.activity_id=p_activity
 where cu.status='active' and ((cu.user_id=p_student and 'student'=any(cu.roles) and learning.can_read_activity(p_activity))
 or learning.can_manage_assignment(p_activity,aa.cohort_id)));
$$;
revoke all on function learning.can_read_progress(uuid,uuid,uuid) from public,anon;
grant execute on function learning.can_read_progress(uuid,uuid,uuid) to authenticated,service_role;
do $$ declare r record;begin
 for r in select tablename,policyname from pg_policies where schemaname='learning' and tablename in
 ('student_activity_progress','project_submissions','project_reviews','challenge_submissions','challenge_submission_results',
 'challenge_test_case_results','challenge_execution_logs','challenge_execution_queue') loop
 execute format('drop policy %I on learning.%I',r.policyname,r.tablename);end loop;
end $$;
create policy progress_read on learning.student_activity_progress for select to authenticated
 using(learning.can_read_progress(student_id,activity_id,activity_assignment_id));
create policy project_submission_read on learning.project_submissions for select to authenticated using(exists(
 select 1 from learning.student_activity_progress p where p.id=student_activity_progress_id and learning.can_read_progress(student_id,p.activity_id,p.activity_assignment_id)));
create policy project_review_read on learning.project_reviews for select to authenticated using(exists(
 select 1 from learning.project_submissions s where s.id=submission_id));
create policy code_submission_read on learning.challenge_submissions for select to authenticated using(exists(
 select 1 from learning.student_activity_progress p where p.id=student_activity_progress_id and learning.can_read_progress(student_id,p.activity_id,p.activity_assignment_id)));
create policy code_summary_read on learning.challenge_submission_results for select to authenticated using(exists(
 select 1 from learning.challenge_submissions s where s.id=submission_id));
create policy code_case_result_read on learning.challenge_test_case_results for select to authenticated using(exists(
 select 1 from learning.challenge_submissions s join learning.programming_challenges pc on pc.id=s.challenge_id
 join learning.challenge_test_cases tc on tc.id=test_case_id where s.id=submission_id
 and (learning.can_edit_activity(pc.activity_id) or not tc.is_hidden)));
create policy queue_staff_read on learning.challenge_execution_queue for select to authenticated using(exists(
 select 1 from learning.challenge_submissions s join learning.programming_challenges pc on pc.id=s.challenge_id
 where s.id=submission_id and learning.can_edit_activity(pc.activity_id)));
create policy execution_log_staff_read on learning.challenge_execution_logs for select to authenticated using(exists(
 select 1 from learning.challenge_submissions s join learning.programming_challenges pc on pc.id=s.challenge_id
 where s.id=submission_id and learning.can_edit_activity(pc.activity_id)));

-- The Teacher builder saves a draft, then publishes it with its assignment.
do $$ declare definition text;begin
 select pg_get_functiondef('learning.assign_activity(jsonb)'::regprocedure) into definition;
 definition=replace(definition,'return to_jsonb(result);',
 $replacement$if coalesce((p_input->>'publish')::boolean,false) then
   if exists(select 1 from learning.activities a join learning.quizzes q on q.activity_id=a.id where a.id=result.activity_id
     and not exists(select 1 from learning.quiz_questions z where z.quiz_id=q.id)) then raise exception 'Add questions before publishing the quiz.';end if;
   update learning.activities set status_code='published',updated_at=now() where id=result.activity_id;
 end if;
 return to_jsonb(result);$replacement$);
 execute definition;
end $$;

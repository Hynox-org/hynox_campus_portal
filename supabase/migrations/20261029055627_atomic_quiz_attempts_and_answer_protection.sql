-- Quiz state is changed only by guarded transactions. Historical attempts are never erased for retakes.
create table learning.quiz_retake_approvals (
 attempt_id uuid primary key references learning.quiz_attempts(id) on delete restrict,
 approved_by uuid not null references core.users(id), approved_at timestamptz not null default now()
);
alter table learning.quiz_retake_approvals enable row level security;
revoke all on learning.quiz_retake_approvals from public,anon,authenticated;
grant select on learning.quiz_retake_approvals to authenticated;
create policy retake_read on learning.quiz_retake_approvals for select to authenticated using (
 exists(select 1 from learning.quiz_attempts att join learning.quizzes q on q.id=att.quiz_id,
 core.get_current_user() cu where att.id=attempt_id and cu.status='active'
 and (att.student_id=cu.user_id or learning.can_edit_activity(q.activity_id))));

create or replace function learning.start_quiz(p_quiz_id uuid,p_student_id uuid,p_progress_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record; q learning.quizzes; a learning.activities; aa learning.activity_assignments;
 att learning.quiz_attempts; prog learning.student_activity_progress; used integer; credits integer;
begin
 select * into actor from core.get_current_user();
 if actor.user_id is null or actor.status<>'active' or not 'student'=any(actor.roles)
   or actor.user_id is distinct from p_student_id then raise exception 'Access denied.';end if;
 perform pg_advisory_xact_lock(hashtextextended('quiz:'||p_student_id||':'||p_quiz_id,0));
 select * into q from learning.quizzes where id=p_quiz_id for share;
 if q.id is null or not learning.can_read_activity(q.activity_id,true) then raise exception 'This quiz is unavailable.';end if;
 select * into a from learning.activities where id=q.activity_id;
 select aa0.* into aa from learning.activity_assignments aa0
   join delivery.enrollments e on e.cohort_id=aa0.cohort_id and e.user_id=actor.user_id
     and e.status_code='active' and e.deleted_at is null
   join delivery.cohorts co on co.id=e.cohort_id and co.deleted_at is null and co.status_code='active'
   join academic.lessons l on l.id=a.lesson_id join academic.modules m on m.id=l.module_id
   join delivery.course_assignments ca on ca.cohort_id=co.id and ca.course_id=m.course_id and ca.deleted_at is null
   where aa0.activity_id=a.id and aa0.deleted_at is null
     and (aa0.available_from is null or aa0.available_from<=now()) and (aa0.available_until is null or aa0.available_until>=now())
   order by aa0.created_at,aa0.id limit 1;
 if aa.id is null then raise exception 'No active quiz assignment.';end if;
 if p_progress_id is not null and not exists(select 1 from learning.student_activity_progress p
   where p.id=p_progress_id and p.student_id=actor.user_id and p.activity_id=a.id
   and p.activity_assignment_id=aa.id and p.deleted_at is null) then raise exception 'Invalid activity progress.';end if;
 if coalesce(q.max_attempts,1)<1 or coalesce(a.max_score,100)<=0 or coalesce(a.passing_score,0)<0
   or coalesce(a.passing_score,0)>coalesce(a.max_score,100) then raise exception 'Invalid quiz scoring configuration.';end if;
 if q.time_limit_minutes is not null and q.time_limit_minutes<=0 or q.strict_mode and q.time_limit_minutes is null then
   raise exception 'Invalid quiz time limit.';end if;
 if not exists(select 1 from learning.quiz_questions where quiz_id=q.id) or exists(
   select 1 from learning.quiz_questions z where z.quiz_id=q.id and (z.points is null or z.points<=0
    or btrim(z.question_text)='' or (select count(*) from learning.quiz_options o where o.question_id=z.id and o.is_correct)=0
    or (z.question_type in ('single_choice','true_false') and (select count(*) from learning.quiz_options o where o.question_id=z.id and o.is_correct)<>1)
    or (z.question_type<>'short_answer' and (select count(*) from learning.quiz_options o where o.question_id=z.id)<2)
    or (z.question_type='true_false' and (select count(*) from learning.quiz_options o where o.question_id=z.id)<>2)))
 then raise exception 'This quiz needs valid questions and answer keys before it can start.';end if;
 if exists(select 1 from learning.quiz_attempts where quiz_id=q.id and student_id=actor.user_id and passed and not forfeited)
   then raise exception 'You have already passed this quiz.';end if;
 select * into att from learning.quiz_attempts where quiz_id=q.id and student_id=actor.user_id and submitted_at is null
   order by started_at desc,id limit 1;
 if att.id is not null then return to_jsonb(att);end if;
 select count(*) into used from learning.quiz_attempts where quiz_id=q.id and student_id=actor.user_id;
 select count(*) into credits from learning.quiz_retake_approvals r join learning.quiz_attempts t on t.id=r.attempt_id
   where t.quiz_id=q.id and t.student_id=actor.user_id;
 if used>=coalesce(q.max_attempts,1)+credits then raise exception 'Maximum attempts limit reached for this quiz.';end if;
 insert into learning.student_activity_progress(student_id,activity_id,activity_assignment_id,status_code,attempt_number,started_at)
 values(actor.user_id,a.id,aa.id,'started',used+1,now()) on conflict(student_id,activity_assignment_id) do update
 set status_code='started',attempt_number=used+1,started_at=coalesce(learning.student_activity_progress.started_at,now()),
   completed_at=null,score=null,forfeited=false,forfeit_reason=null,deleted_at=null,updated_at=now()
 returning * into prog;
 insert into learning.quiz_attempts(quiz_id,student_id,student_activity_progress_id,attempt_number)
 values(q.id,actor.user_id,prog.id,used+1) returning * into att;
 return to_jsonb(att);
end $$;

create or replace function learning.finish_quiz(p_attempt_id uuid,p_answers jsonb,p_forfeit_reason text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record; att learning.quiz_attempts; q learning.quizzes; activity learning.activities; question record;
 selections jsonb; sel jsonb; correct boolean; awarded numeric; score_sum numeric=0; max_sum numeric=0;
 timed_out boolean=false; did_pass boolean; selected_count integer; correct_count integer; course uuid;
begin
 select * into actor from core.get_current_user();
 if actor.user_id is null or actor.status<>'active' or not 'student'=any(actor.roles) then raise exception 'Access denied.';end if;
 select * into att from learning.quiz_attempts where id=p_attempt_id for update;
 if att.id is null or att.student_id<>actor.user_id then raise exception 'Access denied.';end if;
 if att.submitted_at is not null then return to_jsonb(att);end if;
 select * into q from learning.quizzes where id=att.quiz_id for share;
 if not learning.can_read_activity(q.activity_id) then raise exception 'This quiz is unavailable.';end if;
 select * into activity from learning.activities where id=q.activity_id;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)>5000 then raise exception 'Invalid quiz answers.';end if;
 if p_forfeit_reason is not null and (length(btrim(p_forfeit_reason))=0 or length(p_forfeit_reason)>200) then raise exception 'Invalid forfeit reason.';end if;
 timed_out=(q.time_limit_minutes is not null and now()>att.started_at+make_interval(mins=>q.time_limit_minutes)+interval '60 seconds');
 -- A deadline closes the attempt, including late retries, instead of leaving a zombie attempt.
 if not learning.can_read_activity(q.activity_id,true) then timed_out=true;end if;
 if exists(select 1 from jsonb_array_elements(p_answers) s where jsonb_typeof(s)<>'object'
   or not exists(select 1 from learning.quiz_questions z where z.id::text=s->>'questionId' and z.quiz_id=q.id)
   or (s ? 'answerText' and (jsonb_typeof(s->'answerText')<>'string' or length(s->>'answerText')>10000))
   or (s ? 'selectedOptionId' and not exists(select 1 from learning.quiz_options o
     where o.id::text=s->>'selectedOptionId' and o.question_id::text=s->>'questionId')))
 then raise exception 'Answers contain an invalid question or option.';end if;
 for question in select * from learning.quiz_questions where quiz_id=q.id order by position,id loop
   select coalesce(jsonb_agg(s),'[]'::jsonb) into selections from jsonb_array_elements(p_answers) s where s->>'questionId'=question.id::text;
   selected_count=jsonb_array_length(selections);
   if question.question_type<>'multiple_choice' and selected_count>1 then raise exception 'A question has duplicate answers.';end if;
   if exists(select 1 from jsonb_array_elements(selections) s group by s->>'selectedOptionId' having count(*)>1) then raise exception 'Duplicate answer option.';end if;
   if question.question_type='short_answer' and exists(select 1 from jsonb_array_elements(selections) s where s ? 'selectedOptionId')
     or question.question_type<>'short_answer' and exists(select 1 from jsonb_array_elements(selections) s where not s ? 'selectedOptionId' or s ? 'answerText')
     then raise exception 'Answer format does not match the question.';end if;
   select count(*) into correct_count from learning.quiz_options where question_id=question.id and is_correct;
   correct=false;
   if not timed_out and p_forfeit_reason is null and selected_count>0 then
     if question.question_type='short_answer' then
       correct=exists(select 1 from learning.quiz_options o where o.question_id=question.id and o.is_correct
         and lower(btrim(o.option_text))=lower(btrim(selections->0->>'answerText')));
     else
       correct=selected_count=correct_count and not exists(select 1 from jsonb_array_elements(selections) s
         where not exists(select 1 from learning.quiz_options o where o.id::text=s->>'selectedOptionId' and o.question_id=question.id and o.is_correct));
     end if;
   end if;
   max_sum=max_sum+question.points;awarded=case when correct then question.points else 0 end;score_sum=score_sum+awarded;
   if selected_count=0 then selections='[{}]'::jsonb;end if;
   for sel in select value from jsonb_array_elements(selections) loop
     insert into learning.quiz_answers(attempt_id,question_id,selected_option_id,answer_text,is_correct,points_awarded)
       values(att.id,question.id,(sel->>'selectedOptionId')::uuid,sel->>'answerText',correct,awarded);
     awarded=0;
   end loop;
 end loop;
 if max_sum<=0 then raise exception 'Invalid quiz scoring configuration.';end if;
 did_pass=not timed_out and p_forfeit_reason is null and score_sum*coalesce(activity.max_score,100)>=coalesce(activity.passing_score,0)*max_sum;
 update learning.quiz_attempts set submitted_at=now(),score=score_sum,max_score=max_sum,passed=did_pass,
   forfeited=timed_out or p_forfeit_reason is not null,forfeit_reason=case when timed_out then 'time_limit_exceeded' else p_forfeit_reason end,
   time_spent_seconds=greatest(0,extract(epoch from now()-started_at)::integer) where id=att.id returning * into att;
 update learning.student_activity_progress set status_code=case when did_pass then 'completed' else 'failed' end,
   score=score_sum,max_score=max_sum,submitted_at=now(),completed_at=case when did_pass then now() else null end,
   forfeited=att.forfeited,forfeit_reason=att.forfeit_reason,updated_at=now() where id=att.student_activity_progress_id;
 select m.course_id into course from academic.lessons l join academic.modules m on m.id=l.module_id where l.id=activity.lesson_id;
 perform delivery.refresh_course_progress(actor.user_id,course);
 return to_jsonb(att);
end $$;

create or replace function learning.approve_quiz_retake(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record; att learning.quiz_attempts; activity uuid;begin
 select * into actor from core.get_current_user();
 select * into att from learning.quiz_attempts where id=p_attempt_id for update;
 select activity_id into activity from learning.quizzes where id=att.quiz_id;
 if actor.user_id is null or not learning.can_edit_activity(activity) then raise exception 'Access denied.';end if;
 if att.submitted_at is null or att.passed then raise exception 'Only a closed, unsuccessful attempt can be approved for retake.';end if;
 insert into learning.quiz_retake_approvals(attempt_id,approved_by) values(att.id,actor.user_id) on conflict do nothing;
 return jsonb_build_object('success',true);
end $$;

-- Only staff can retrieve answer keys. Students get no key fields in an active session.
create or replace function learning.quiz_content(p_activity_id uuid,p_attempt_id uuid default null,p_staff boolean default false)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor record; q learning.quizzes; att learning.quiz_attempts; keys boolean=false; questions jsonb;begin
 select * into actor from core.get_current_user();
 select * into q from learning.quizzes where activity_id=p_activity_id;
 if q.id is null or not learning.can_read_activity(p_activity_id,not p_staff and p_attempt_id is null)
   or p_staff and not learning.can_edit_activity(p_activity_id) then raise exception 'Access denied.';end if;
 if p_attempt_id is not null then
   select * into att from learning.quiz_attempts where id=p_attempt_id and quiz_id=q.id;
   if att.id is null or (att.student_id<>actor.user_id and not learning.can_edit_activity(p_activity_id)) then raise exception 'Access denied.';end if;
 end if;
 keys=p_staff or learning.can_edit_activity(p_activity_id);
 -- Student answer keys stay private even after submission while retakes are possible.
 select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('options',(
   select coalesce(jsonb_agg(case when keys then to_jsonb(o) else to_jsonb(o)-'is_correct' end order by o.position,o.id),'[]'::jsonb)
   from learning.quiz_options o where o.question_id=z.id and (keys or z.question_type<>'short_answer')),
   'selected_option_ids',(select coalesce(jsonb_agg(ans.selected_option_id),'[]'::jsonb) from learning.quiz_answers ans
      where ans.attempt_id=att.id and ans.question_id=z.id),
   'answer_text',(select ans.answer_text from learning.quiz_answers ans where ans.attempt_id=att.id and ans.question_id=z.id limit 1))
   order by z.position,z.id),'[]'::jsonb) into questions from learning.quiz_questions z where z.quiz_id=q.id;
 return jsonb_build_object('quiz',to_jsonb(q),'attempt',case when att.id is null then null else to_jsonb(att) end,'questions',questions);
end $$;

revoke all on function learning.start_quiz(uuid,uuid,uuid),learning.finish_quiz(uuid,jsonb,text),
 learning.approve_quiz_retake(uuid),learning.quiz_content(uuid,uuid,boolean) from public,anon;
grant execute on function learning.start_quiz(uuid,uuid,uuid),learning.finish_quiz(uuid,jsonb,text),
 learning.approve_quiz_retake(uuid),learning.quiz_content(uuid,uuid,boolean) to authenticated;

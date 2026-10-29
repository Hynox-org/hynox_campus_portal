create or replace function learning.save_quiz_question(p_quiz_id uuid,p_question_id uuid,p_text text,p_type text,
 p_points numeric,p_position integer,p_options jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare q learning.quizzes; question learning.quiz_questions; correct_count integer; option_count integer;begin
 select * into q from learning.quizzes where id=p_quiz_id for update;
 if q.id is null or not learning.can_edit_activity(q.activity_id) then raise exception 'Access denied.';end if;
 if exists(select 1 from learning.quiz_attempts where quiz_id=q.id) then raise exception 'This quiz already has attempts. Create a new quiz to change its questions.';end if;
 if p_text is null or length(btrim(p_text))=0 or length(p_text)>20000 or p_points is null or p_points<=0 or p_points>100000
   or p_position is null or p_position<0 or p_type is null or p_type not in ('single_choice','multiple_choice','true_false','short_answer')
   or jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options)>100 then raise exception 'Invalid question.';end if;
 select count(*),count(*) filter(where o->>'isCorrect'='true') into option_count,correct_count from jsonb_array_elements(p_options) o;
 if correct_count=0 or (p_type in ('single_choice','true_false') and correct_count<>1)
   or (p_type<>'short_answer' and option_count<2) or (p_type='true_false' and option_count<>2)
   or exists(select 1 from jsonb_array_elements(p_options) o where jsonb_typeof(o)<>'object'
    or jsonb_typeof(o->'optionText') is distinct from 'string' or length(btrim(o->>'optionText'))=0 or length(o->>'optionText')>10000
    or jsonb_typeof(o->'isCorrect') is distinct from 'boolean'
    or jsonb_typeof(o->'position') is distinct from 'number' or (o->>'position')::numeric<>trunc((o->>'position')::numeric) or (o->>'position')::numeric<0)
   or exists(select 1 from jsonb_array_elements(p_options) o group by lower(btrim(o->>'optionText')) having count(*)>1)
 then raise exception 'Provide distinct, non-empty options with valid correct answers.';end if;
 if p_question_id is null then
   insert into learning.quiz_questions(quiz_id,question_text,question_type,points,position)
   values(q.id,btrim(p_text),p_type,p_points,p_position) returning * into question;
 else
   update learning.quiz_questions set question_text=btrim(p_text),question_type=p_type,points=p_points,updated_at=now()
   where id=p_question_id and quiz_id=q.id returning * into question;
   if question.id is null then raise exception 'Question no longer exists.';end if;
   delete from learning.quiz_options where question_id=question.id;
 end if;
 insert into learning.quiz_options(question_id,option_text,is_correct,position)
 select question.id,btrim(o->>'optionText'),(o->>'isCorrect')::boolean,(o->>'position')::integer from jsonb_array_elements(p_options) o;
 return to_jsonb(question)||jsonb_build_object('options',(select jsonb_agg(to_jsonb(o) order by o.position,o.id) from learning.quiz_options o where o.question_id=question.id));
end $$;
revoke all on function learning.save_quiz_question(uuid,uuid,text,text,numeric,integer,jsonb) from public,anon;
grant execute on function learning.save_quiz_question(uuid,uuid,text,text,numeric,integer,jsonb) to authenticated;

-- Also protect against direct Data API changes, not just the editor action.
create or replace function learning.protect_attempted_quiz() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare quiz uuid;begin
 if tg_table_name='quizzes' then
   quiz=old.id;
   if tg_op='UPDATE' and new is not distinct from old then return new;end if;
   if tg_op='UPDATE' and row(new.time_limit_minutes,new.strict_mode,new.max_attempts,new.activity_id)
     is not distinct from row(old.time_limit_minutes,old.strict_mode,old.max_attempts,old.activity_id) then return new;end if;
 elsif tg_table_name='quiz_questions' then
   if tg_op='DELETE' then quiz=old.quiz_id;else quiz=new.quiz_id;end if;
 else
   select quiz_id into quiz from learning.quiz_questions where id=case when tg_op='DELETE' then old.question_id else new.question_id end;
 end if;
 perform 1 from learning.quizzes where id=quiz for update;
 if exists(select 1 from learning.quiz_attempts where quiz_id=quiz) then
   raise exception 'This quiz already has attempts. Create a new quiz to change its questions or attempt settings.';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function learning.protect_attempted_quiz() from public,anon,authenticated;
create trigger protect_question_history before insert or update or delete on learning.quiz_questions for each row execute function learning.protect_attempted_quiz();
create trigger protect_option_history before insert or update or delete on learning.quiz_options for each row execute function learning.protect_attempted_quiz();
create trigger protect_quiz_history before update or delete on learning.quizzes for each row execute function learning.protect_attempted_quiz();

-- Replace legacy tenant-wide ALL policies only for this module's catalog and quiz tables.
do $$ declare r record;begin
 for r in select tablename,policyname from pg_policies where schemaname='learning' and tablename in
 ('activities','activity_assignments','quizzes','quiz_questions','quiz_options','quiz_attempts','quiz_answers',
  'projects','programming_challenges','challenge_examples','challenge_test_cases','challenge_starter_templates') loop
   execute format('drop policy %I on learning.%I',r.policyname,r.tablename);
 end loop;
end $$;
create policy activity_read on learning.activities for select to authenticated using(learning.can_read_activity(id));
create policy activity_insert on learning.activities for insert to authenticated with check(learning.can_edit_lesson(lesson_id));
create policy activity_update on learning.activities for update to authenticated using(learning.can_edit_activity(id)) with check(learning.can_edit_lesson(lesson_id));
create policy activity_delete on learning.activities for delete to authenticated using(learning.can_edit_activity(id));
create policy assignment_read on learning.activity_assignments for select to authenticated using(
 learning.can_edit_activity(activity_id) or (deleted_at is null and learning.can_read_activity(activity_id) and exists(
 select 1 from core.get_current_user() cu join delivery.enrollments e on e.user_id=cu.user_id
 where e.cohort_id=activity_assignments.cohort_id and e.status_code='active' and e.deleted_at is null)));
create policy assignment_manage on learning.activity_assignments for all to authenticated
 using(learning.can_manage_assignment(activity_id,cohort_id)) with check(learning.can_manage_assignment(activity_id,cohort_id));
do $$ declare tab text;begin
 foreach tab in array array['quizzes','projects','programming_challenges'] loop
   execute format('create policy catalog_read on learning.%I for select to authenticated using(learning.can_read_activity(activity_id))',tab);
   execute format('create policy catalog_manage on learning.%I for all to authenticated using(learning.can_edit_activity(activity_id)) with check(learning.can_edit_activity(activity_id))',tab);
 end loop;
end $$;
create policy question_read on learning.quiz_questions for select to authenticated using(exists(
 select 1 from learning.quizzes q where q.id=quiz_id and learning.can_read_activity(q.activity_id,true)));
create policy question_manage on learning.quiz_questions for all to authenticated using(exists(
 select 1 from learning.quizzes q where q.id=quiz_id and learning.can_edit_activity(q.activity_id))) with check(exists(
 select 1 from learning.quizzes q where q.id=quiz_id and learning.can_edit_activity(q.activity_id)));
create policy option_read on learning.quiz_options for select to authenticated using(exists(
 select 1 from learning.quiz_questions z join learning.quizzes q on q.id=z.quiz_id where z.id=question_id
 and (learning.can_edit_activity(q.activity_id) or (z.question_type<>'short_answer' and learning.can_read_activity(q.activity_id,true)))));
create policy option_manage on learning.quiz_options for all to authenticated using(exists(
 select 1 from learning.quiz_questions z join learning.quizzes q on q.id=z.quiz_id where z.id=question_id and learning.can_edit_activity(q.activity_id))) with check(exists(
 select 1 from learning.quiz_questions z join learning.quizzes q on q.id=z.quiz_id where z.id=question_id and learning.can_edit_activity(q.activity_id)));
-- RLS cannot hide columns: safe columns only; staff answer keys come from quiz_content.
revoke select on learning.quiz_options from public,anon,authenticated;
grant select(id,question_id,option_text,position,created_at) on learning.quiz_options to authenticated;
create policy attempt_read on learning.quiz_attempts for select to authenticated using(exists(
 select 1 from core.get_current_user() cu join learning.quizzes q on q.id=quiz_id where cu.status='active'
 and ((student_id=cu.user_id and 'student'=any(cu.roles)) or learning.can_edit_activity(q.activity_id))));
create policy answer_read on learning.quiz_answers for select to authenticated using(exists(
 select 1 from learning.quiz_attempts att join learning.quizzes q on q.id=att.quiz_id,core.get_current_user() cu
 where att.id=attempt_id and (learning.can_edit_activity(q.activity_id)
 or (att.student_id=cu.user_id and att.submitted_at is not null and q.show_results_immediately))));
do $$ declare tab text;begin
 foreach tab in array array['challenge_examples','challenge_test_cases','challenge_starter_templates'] loop
   execute format('create policy challenge_child_read on learning.%I for select to authenticated using(exists(select 1 from learning.programming_challenges pc where pc.id=challenge_id and (learning.can_edit_activity(pc.activity_id) or (learning.can_read_activity(pc.activity_id,true) %s))))',tab,case when tab='challenge_test_cases' then 'and not is_hidden' else '' end);
   execute format('create policy challenge_child_manage on learning.%I for all to authenticated using(exists(select 1 from learning.programming_challenges pc where pc.id=challenge_id and learning.can_edit_activity(pc.activity_id))) with check(exists(select 1 from learning.programming_challenges pc where pc.id=challenge_id and learning.can_edit_activity(pc.activity_id)))',tab);
 end loop;
end $$;

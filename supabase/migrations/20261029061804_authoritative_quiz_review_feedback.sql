-- Review uses the stored grading verdict, including multiple choice and text answers.
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
   ||case when keys or (att.submitted_at is not null and q.show_results_immediately) then jsonb_build_object(
     'is_correct',(select coalesce(bool_and(ans.is_correct),false) from learning.quiz_answers ans where ans.attempt_id=att.id and ans.question_id=z.id),
     'points_awarded',(select coalesce(sum(ans.points_awarded),0) from learning.quiz_answers ans where ans.attempt_id=att.id and ans.question_id=z.id)) else '{}'::jsonb end
   order by z.position,z.id),'[]'::jsonb) into questions from learning.quiz_questions z where z.quiz_id=q.id;
 return jsonb_build_object('quiz',to_jsonb(q)||jsonb_build_object('allowed_attempts',coalesce(q.max_attempts,1)+(select count(*) from learning.quiz_retake_approvals r join learning.quiz_attempts t on t.id=r.attempt_id where t.quiz_id=q.id and t.student_id=actor.user_id)),'attempt',case when att.id is null then null else to_jsonb(att) end,'questions',questions);
end $$;


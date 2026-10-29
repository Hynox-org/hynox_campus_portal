create or replace function learning.start_coding_activity(p_activity uuid,p_student uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;assignment uuid;prog learning.student_activity_progress;begin
 select * into actor from core.get_current_user();
 if actor.user_id is null or actor.user_id is distinct from p_student or not 'student'=any(actor.roles)
   or not learning.can_read_activity(p_activity,true) then raise exception 'Access denied.';end if;
 perform pg_advisory_xact_lock(hashtextextended('activity:'||p_student||':'||p_activity,0));
 select aa.id into assignment from learning.activity_assignments aa
 join delivery.enrollments e on e.cohort_id=aa.cohort_id and e.user_id=p_student and e.status_code='active' and e.deleted_at is null
 join delivery.cohorts co on co.id=aa.cohort_id and co.status_code='active' and co.deleted_at is null
 join learning.activities a on a.id=aa.activity_id and a.activity_type_code='programming'
 join academic.lessons l on l.id=a.lesson_id join academic.modules m on m.id=l.module_id
 join delivery.course_assignments ca on ca.cohort_id=co.id and ca.course_id=m.course_id and ca.deleted_at is null
 where aa.activity_id=p_activity and aa.deleted_at is null and (aa.available_from is null or aa.available_from<=now())
   and (aa.available_until is null or aa.available_until>=now()) order by aa.created_at,aa.id limit 1;
 if assignment is null then raise exception 'No active coding assignment.';end if;
 insert into learning.student_activity_progress(student_id,activity_id,activity_assignment_id,status_code,attempt_number,started_at)
 values(p_student,p_activity,assignment,'started',0,now()) on conflict(student_id,activity_assignment_id) do nothing;
 select * into prog from learning.student_activity_progress where student_id=p_student and activity_assignment_id=assignment;
 return to_jsonb(prog);
end $$;
create or replace function learning.forfeit_coding_activity(p_progress uuid,p_student uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;prog learning.student_activity_progress;begin
 select * into actor from core.get_current_user();
 select * into prog from learning.student_activity_progress where id=p_progress for update;
 if actor.user_id is null or actor.user_id is distinct from p_student or prog.student_id is distinct from actor.user_id
   or not 'student'=any(actor.roles) or not learning.can_read_activity(prog.activity_id)
   or not exists(select 1 from learning.programming_challenges c where c.activity_id=prog.activity_id and c.strict_mode)
   then raise exception 'Access denied.';end if;
 if p_reason is null or length(btrim(p_reason))=0 or length(p_reason)>200 then raise exception 'Invalid forfeit reason.';end if;
 if prog.forfeited or prog.status_code='completed' then return to_jsonb(prog);end if;
 update learning.student_activity_progress set status_code='failed',score=0,completed_at=null,forfeited=true,
   forfeit_reason=p_reason,violation_count=violation_count+1,updated_at=now() where id=prog.id returning * into prog;
 return to_jsonb(prog);
end $$;
revoke all on function learning.start_coding_activity(uuid,uuid),learning.forfeit_coding_activity(uuid,uuid,text) from public,anon;
grant execute on function learning.start_coding_activity(uuid,uuid),learning.forfeit_coding_activity(uuid,uuid,text) to authenticated;

-- Preserve the configured base limit; expose additional approved attempts to the Student UI.
do $$ declare definition text;begin
 select pg_get_functiondef('learning.quiz_content(uuid,uuid,boolean)'::regprocedure) into definition;
 definition=replace(definition,'''quiz'',to_jsonb(q)',
 $replacement$'quiz',to_jsonb(q)||jsonb_build_object('allowed_attempts',coalesce(q.max_attempts,1)+(
   select count(*) from learning.quiz_retake_approvals r join learning.quiz_attempts t on t.id=r.attempt_id
   where t.quiz_id=q.id and t.student_id=actor.user_id))$replacement$);
 execute definition;
end $$;

create or replace function core.notify_learning_change() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare row_data jsonb;activity uuid;campus uuid;person uuid;begin
 row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 person=nullif(row_data->>'student_id','')::uuid;
 if tg_table_name='activities' then activity=(row_data->>'id')::uuid;campus=(row_data->>'tenant_id')::uuid;
 elsif row_data ? 'activity_id' then activity=(row_data->>'activity_id')::uuid;
 elsif tg_table_name='quiz_retake_approvals' then
   select q.activity_id,t.student_id into activity,person from learning.quiz_attempts t join learning.quizzes q on q.id=t.quiz_id where t.id=(row_data->>'attempt_id')::uuid;
 elsif row_data ? 'quiz_id' then select activity_id into activity from learning.quizzes where id=(row_data->>'quiz_id')::uuid;
 elsif row_data ? 'question_id' then select q.activity_id into activity from learning.quiz_questions z join learning.quizzes q on q.id=z.quiz_id where z.id=(row_data->>'question_id')::uuid;
 elsif row_data ? 'project_id' then select activity_id into activity from learning.projects where id=(row_data->>'project_id')::uuid;
 elsif tg_table_name='project_reviews' then select p.activity_id,s.student_id into activity,person from learning.project_submissions s join learning.projects p on p.id=s.project_id where s.id=(row_data->>'submission_id')::uuid;
 elsif row_data ? 'challenge_id' then select activity_id into activity from learning.programming_challenges where id=(row_data->>'challenge_id')::uuid;
 end if;
 if campus is null then select tenant_id into campus from learning.activities where id=activity;end if;
 insert into core.dashboard_revisions(topic,domain) values('admin','delivery') on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;
 if campus is not null then insert into core.dashboard_revisions(topic,domain) values('campus:'||campus,'delivery') on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;end if;
 if person is not null then insert into core.dashboard_revisions(topic,domain) values('user:'||person,'delivery') on conflict(topic,domain) do update set revision=core.dashboard_revisions.revision+1;end if;
 return null;
end $$;
revoke all on function core.notify_learning_change() from public,anon,authenticated;
do $$ declare tab text;begin
 foreach tab in array array['activities','activity_assignments','quizzes','quiz_questions','quiz_options','quiz_attempts',
 'quiz_retake_approvals','projects','project_submissions','project_reviews','programming_challenges','challenge_examples',
 'challenge_test_cases','challenge_starter_templates','challenge_submissions','student_activity_progress'] loop
 execute format('create trigger notify_learning_change after insert or update or delete on learning.%I for each row execute function core.notify_learning_change()',tab);
 end loop;
end $$;

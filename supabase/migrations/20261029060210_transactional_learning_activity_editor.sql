create or replace function learning.validate_activity_parent() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from academic.lessons l where l.id=new.lesson_id and l.deleted_at is null
   and l.tenant_id=new.tenant_id and new.institution_id=new.tenant_id)
   or length(btrim(new.title))=0 or length(new.title)>500 or coalesce(new.max_score,100)<=0
   or coalesce(new.passing_score,0)<0 or coalesce(new.passing_score,0)>coalesce(new.max_score,100)
   or (new.available_from is not null and new.available_until is not null and new.available_from>new.available_until)
 then raise exception 'Invalid activity title, scoring, availability or campus hierarchy.';end if;
 if tg_op='UPDATE' then
   if row(new.tenant_id,new.institution_id,new.lesson_id,new.activity_type_code)
    is distinct from row(old.tenant_id,old.institution_id,old.lesson_id,old.activity_type_code) then raise exception 'Activity ownership and type cannot be changed.';end if;
   if row(new.max_score,new.passing_score) is distinct from row(old.max_score,old.passing_score)
    and exists(select 1 from learning.quizzes q join learning.quiz_attempts att on att.quiz_id=q.id where q.activity_id=new.id)
    then raise exception 'An attempted quiz cannot change its scoring scale.';end if;
 end if;
 return new;
end $$;
create trigger validate_activity_parent before insert or update on learning.activities for each row execute function learning.validate_activity_parent();
create or replace function learning.validate_assignment_parent() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare co delivery.cohorts;begin
 select co0.* into co from delivery.cohorts co0
 join learning.activities a on a.id=new.activity_id
 join academic.lessons l on l.id=a.lesson_id join academic.modules m on m.id=l.module_id
 join academic.courses c on c.id=m.course_id
 join delivery.course_assignments ca on ca.course_id=c.id and ca.cohort_id=co0.id and ca.deleted_at is null
 where co0.id=new.cohort_id and co0.deleted_at is null and co0.tenant_id=a.tenant_id and co0.program_id=c.program_id;
 if co.id is null or (new.available_from is not null and new.available_until is not null and new.available_from>new.available_until)
   or (co.start_date is not null and (new.available_from::date<co.start_date or new.available_until::date<co.start_date))
   or (co.end_date is not null and (new.available_from::date>co.end_date or new.available_until::date>co.end_date))
 then raise exception 'Invalid assignment course, campus or dates.';end if;
 if tg_op='UPDATE' and row(new.activity_id,new.cohort_id) is distinct from row(old.activity_id,old.cohort_id)
 then raise exception 'Assignment ownership cannot change.';end if;
 return new;
end $$;
create trigger validate_assignment_parent before insert or update on learning.activity_assignments for each row execute function learning.validate_assignment_parent();
revoke all on function learning.validate_activity_parent(),learning.validate_assignment_parent() from public,anon,authenticated;

create or replace function learning.assign_activity(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid=(p_input->>'activity_id')::uuid;co uuid=(p_input->>'cohort_id')::uuid;actor record;result learning.activity_assignments;begin
 select * into actor from core.get_current_user();
 if not learning.can_manage_assignment(a,co) then raise exception 'Access denied.';end if;
 insert into learning.activity_assignments(activity_id,cohort_id,is_required,available_from,available_until,created_by)
 values(a,co,coalesce((p_input->>'is_required')::boolean,true),nullif(p_input->>'available_from','')::timestamptz,
   nullif(p_input->>'available_until','')::timestamptz,actor.user_id)
 on conflict(activity_id,cohort_id) do update set is_required=excluded.is_required,available_from=excluded.available_from,
   available_until=excluded.available_until,deleted_at=null,updated_at=now() returning * into result;
 return to_jsonb(result);
end $$;

create or replace function learning.save_activity(p_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;a learning.activities;l academic.lessons;q learning.quizzes;item jsonb;kind text=p_input->>'activity_type_code';
 max_points integer=coalesce((p_input->>'max_score')::integer,100);pass_points integer=coalesce((p_input->>'passing_score')::integer,0);
 desired_status text;begin
 select * into actor from core.get_current_user();
 if jsonb_typeof(p_input) is distinct from 'object' or actor.user_id is null then raise exception 'Invalid activity.';end if;
 if p_id is null then
   select * into l from academic.lessons where id=(p_input->>'lesson_id')::uuid and deleted_at is null;
   if l.id is null or not learning.can_edit_lesson(l.id) then raise exception 'Access denied.';end if;
   if l.tenant_id is distinct from (p_input->>'tenant_id')::uuid or l.tenant_id is distinct from (p_input->>'institution_id')::uuid then raise exception 'Invalid campus.';end if;
   insert into learning.activities(tenant_id,institution_id,lesson_id,activity_type_code,status_code,title,created_by)
   values(l.tenant_id,l.tenant_id,l.id,kind,'draft',p_input->>'title',actor.user_id) returning * into a;
 else
   select * into a from learning.activities where id=p_id and deleted_at is null for update;
   if a.id is null or not learning.can_edit_activity(a.id) then raise exception 'Access denied.';end if;
   if kind is distinct from a.activity_type_code then raise exception 'Activity type cannot change.';end if;
 end if;
 desired_status=coalesce(p_input->>'status_code',a.status_code);
 update learning.activities set title=btrim(p_input->>'title'),description=nullif(p_input->>'description',''),instructions=nullif(p_input->>'instructions',''),
   max_score=max_points,passing_score=pass_points,is_mandatory=coalesce((p_input->>'is_mandatory')::boolean,true),
   position=coalesce((p_input->>'position')::integer,a.position),updated_at=now() where id=a.id returning * into a;
 if kind='quiz' then
   if coalesce((p_input->>'quiz_max_attempts')::integer,1)<1 or coalesce((p_input->>'quiz_max_attempts')::integer,1)>100
     or (p_input->>'quiz_time_limit')::integer<1 or (p_input->>'quiz_time_limit')::integer>1440
     or (coalesce((p_input->>'quiz_strict_mode')::boolean,false) and nullif(p_input->>'quiz_time_limit','') is null)
     then raise exception 'Invalid quiz attempt limit or duration.';end if;
   insert into learning.quizzes(activity_id,time_limit_minutes,max_attempts,shuffle_questions,shuffle_options,show_results_immediately,strict_mode)
   values(a.id,(p_input->>'quiz_time_limit')::integer,coalesce((p_input->>'quiz_max_attempts')::integer,1),
     coalesce((p_input->>'quiz_shuffle_questions')::boolean,false),coalesce((p_input->>'quiz_shuffle_options')::boolean,false),
     coalesce((p_input->>'quiz_show_results_immediately')::boolean,true),coalesce((p_input->>'quiz_strict_mode')::boolean,false))
   on conflict(activity_id) do update set time_limit_minutes=excluded.time_limit_minutes,max_attempts=excluded.max_attempts,
     shuffle_questions=excluded.shuffle_questions,shuffle_options=excluded.shuffle_options,
     show_results_immediately=excluded.show_results_immediately,strict_mode=excluded.strict_mode,updated_at=now() returning * into q;
   if p_input ? 'questions' then
     if p_id is not null then raise exception 'Edit questions individually before attempts begin.';end if;
     if jsonb_typeof(p_input->'questions')<>'array' or jsonb_array_length(p_input->'questions')>500 then raise exception 'Invalid question list.';end if;
     for item in select value from jsonb_array_elements(p_input->'questions') loop
       perform learning.save_quiz_question(q.id,null,item->>'question_text',item->>'question_type',(item->>'points')::numeric,
         coalesce((item->>'position')::integer,1),item->'options');
     end loop;
   end if;
   if desired_status='published' and not exists(select 1 from learning.quiz_questions where quiz_id=q.id) then raise exception 'Add questions before publishing the quiz.';end if;
 elsif kind='project' then
   if coalesce(p_input->>'project_difficulty','intermediate') not in ('beginner','intermediate','advanced','easy','medium','hard')
     or (p_input->>'project_estimated_hours')::numeric<=0 then raise exception 'Invalid project difficulty or duration.';end if;
   insert into learning.projects(activity_id,project_overview,requirements,deliverables,submission_instructions,difficulty_level,estimated_hours,max_score)
   values(a.id,coalesce(p_input->>'project_overview',''),nullif(p_input->>'project_requirements',''),nullif(p_input->>'project_deliverables',''),
     nullif(p_input->>'project_submission_instructions',''),coalesce(p_input->>'project_difficulty','intermediate'),(p_input->>'project_estimated_hours')::numeric,max_points)
   on conflict(activity_id) do update set project_overview=excluded.project_overview,requirements=excluded.requirements,deliverables=excluded.deliverables,
     submission_instructions=excluded.submission_instructions,difficulty_level=excluded.difficulty_level,estimated_hours=excluded.estimated_hours,max_score=max_points,updated_at=now();
 elsif kind='programming' then
   if coalesce(p_input->>'chal_difficulty','easy') not in ('easy','medium','hard') or length(btrim(coalesce(p_input->>'chal_problem_statement','')))=0
     or coalesce((p_input->>'chal_time_limit')::integer,1000) not between 100 and 10000
     or coalesce((p_input->>'chal_memory_limit')::integer,256) not between 64 and 512 then raise exception 'Invalid coding challenge limits or problem statement.';end if;
   insert into learning.programming_challenges(activity_id,difficulty_level,problem_statement,input_format,output_format,constraints_text,starter_code,time_limit_ms,memory_limit_mb,strict_mode)
   values(a.id,coalesce(p_input->>'chal_difficulty','easy'),p_input->>'chal_problem_statement',nullif(p_input->>'chal_input_format',''),nullif(p_input->>'chal_output_format',''),
     nullif(p_input->>'chal_constraints',''),nullif(p_input->>'chal_starter_code',''),coalesce((p_input->>'chal_time_limit')::integer,1000),
     coalesce((p_input->>'chal_memory_limit')::integer,256),coalesce((p_input->>'chal_strict_mode')::boolean,false))
   on conflict(activity_id) do update set difficulty_level=excluded.difficulty_level,problem_statement=excluded.problem_statement,input_format=excluded.input_format,
     output_format=excluded.output_format,constraints_text=excluded.constraints_text,starter_code=excluded.starter_code,time_limit_ms=excluded.time_limit_ms,
     memory_limit_mb=excluded.memory_limit_mb,strict_mode=excluded.strict_mode,updated_at=now();
 else raise exception 'Unsupported activity type.';
 end if;
 if p_input ? 'assignments' then
   if jsonb_typeof(p_input->'assignments')<>'array' or jsonb_array_length(p_input->'assignments')>250 then raise exception 'Invalid assignment list.';end if;
   for item in select value from jsonb_array_elements(p_input->'assignments') loop
     if item ? 'id' and not exists(select 1 from learning.activity_assignments aa where aa.id=(item->>'id')::uuid
       and aa.activity_id=a.id and aa.cohort_id=(item->>'cohort_id')::uuid) then raise exception 'Invalid assignment ownership.';end if;
     perform learning.assign_activity(item||jsonb_build_object('activity_id',a.id));
   end loop;
 end if;
 update learning.activities set status_code=desired_status where id=a.id returning * into a;
 return to_jsonb(a);
end $$;
revoke all on function learning.assign_activity(jsonb),learning.save_activity(uuid,jsonb) from public,anon;
grant execute on function learning.assign_activity(jsonb),learning.save_activity(uuid,jsonb) to authenticated;

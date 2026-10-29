-- One authoritative, read-only calculation for dashboards and persisted progress.
-- Completion status uses exact counts, never a rounded display percentage.
create or replace function delivery.course_progress_snapshot(p_student_ids uuid[], p_course_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor record; result jsonb; forbidden boolean;
begin
  select * into actor from core.get_current_user();
  if actor.user_id is null or actor.status <> 'active' then raise exception 'Access denied.'; end if;
  if p_student_ids is null or p_course_ids is null then raise exception 'Progress identifiers are required.'; end if;
  if cardinality(p_student_ids)>250 or cardinality(p_course_ids)>500 then raise exception 'Progress batch is too large.'; end if;
  if array_position(p_student_ids,null) is not null or array_position(p_course_ids,null) is not null then raise exception 'Invalid progress identifiers.'; end if;
  if not actor.roles && array['super_admin','institution_admin','teacher','trainer']::text[]
     and exists(select 1 from unnest(p_student_ids) id where id<>actor.user_id) then raise exception 'Access denied.'; end if;

  with eligible as materialized (
    select distinct u.id user_id,c.id course_id,
      (u.id=actor.user_id or 'super_admin'=any(actor.roles) or academic.can_edit_course(c.id)) can_read
    from core.users u
    join delivery.enrollments e on e.user_id=u.id and e.status_code='active' and e.deleted_at is null
    join delivery.cohorts co on co.id=e.cohort_id and co.status_code='active' and co.deleted_at is null
    join delivery.course_assignments ca on ca.cohort_id=co.id and ca.deleted_at is null
    join academic.courses c on c.id=ca.course_id and c.program_id=co.program_id and c.tenant_id=u.tenant_id and c.deleted_at is null
    join academic.programs p on p.id=c.program_id and p.deleted_at is null
    join institution.institutions campus on campus.id=c.tenant_id and campus.deleted_at is null and campus.status not in ('inactive','suspended')
    join academic.statuses cs on cs.id=c.status_id and cs.code='active'
    join academic.statuses ps on ps.id=p.status_id and ps.code='active'
    join academic.visibility_types cv on cv.id=c.visibility_type_id and cv.code<>'private'
    join academic.visibility_types pv on pv.id=p.visibility_type_id and pv.code<>'private'
    where u.id=any(p_student_ids) and c.id=any(p_course_ids) and u.deleted_at is null and u.status='active'
  ), curriculum as materialized (
    select e.user_id,e.course_id,l.id lesson_id,lt.code lesson_type
    from eligible e join academic.modules m on m.course_id=e.course_id and m.deleted_at is null
    join academic.statuses ms on ms.id=m.status_id and ms.code='active'
    join academic.lessons l on l.module_id=m.id and l.deleted_at is null
    join academic.statuses ls on ls.id=l.status_id and ls.code='active'
    left join academic.lesson_types lt on lt.id=l.lesson_type_id
  ), lesson_totals as (
    select l.user_id,l.course_id,count(*)::integer total_lessons,
      count(*) filter(where lp.status_code='completed')::integer completed_lessons,
      bool_or(lp.status_code in ('in_progress','completed')) started,
      min(lp.started_at) started_at,max(lp.completed_at) completed_at
    from curriculum l left join delivery.lesson_progress lp on lp.user_id=l.user_id and lp.lesson_id=l.lesson_id
    where coalesce(l.lesson_type,'text') not in ('assignment','assessment')
    group by l.user_id,l.course_id
  ), required_activities as materialized (
    select distinct l.user_id,l.course_id,a.id activity_id,a.activity_type_code
    from curriculum l join learning.activities a on a.lesson_id=l.lesson_id and a.deleted_at is null
      and a.status_code='published' and coalesce(a.is_mandatory,true)
    join learning.activity_assignments aa on aa.activity_id=a.id and aa.deleted_at is null and aa.is_required
    join delivery.cohorts co on co.id=aa.cohort_id and co.deleted_at is null and co.status_code='active'
    join delivery.enrollments en on en.cohort_id=co.id and en.user_id=l.user_id and en.status_code='active' and en.deleted_at is null
    join delivery.course_assignments ca on ca.cohort_id=co.id and ca.course_id=l.course_id and ca.deleted_at is null
  ), evidence as (
    select r.*,
      case r.activity_type_code
        when 'quiz' then (select min(at.submitted_at) from learning.quizzes q join learning.quiz_attempts at on at.quiz_id=q.id
          where q.activity_id=r.activity_id and at.student_id=r.user_id and at.passed and not at.forfeited and at.submitted_at is not null)
        when 'project' then (select max(coalesce(rv.reviewed_at,rv.created_at,s.submitted_at)) from learning.projects p join learning.project_submissions s on s.project_id=p.id
          join learning.project_reviews rv on rv.submission_id=s.id where p.activity_id=r.activity_id and s.student_id=r.user_id and rv.review_status='approved')
        when 'programming' then (select min(s.submitted_at) from learning.programming_challenges c join learning.challenge_submissions s on s.challenge_id=c.id
          where c.activity_id=r.activity_id and s.student_id=r.user_id and s.submission_status_code='accepted')
        else null end completed_at,
      (select min(pr.started_at) from learning.student_activity_progress pr where pr.student_id=r.user_id and pr.activity_id=r.activity_id
        and pr.deleted_at is null and pr.status_code<>'assigned') started_at
    from required_activities r
  ), activity_totals as (
    select user_id,course_id,count(*)::integer total_activities,count(completed_at)::integer completed_activities,
      min(started_at) started_at,max(completed_at) completed_at from evidence group by user_id,course_id
  ), totals as (
    select e.*,coalesce(l.total_lessons,0) total_lessons,coalesce(l.completed_lessons,0) completed_lessons,
      coalesce(a.total_activities,0) total_activities,coalesce(a.completed_activities,0) completed_activities,
      (coalesce(l.started,false) or a.started_at is not null or a.completed_activities>0) started,
      least(l.started_at,a.started_at) started_at,greatest(l.completed_at,a.completed_at) completed_at
    from eligible e left join lesson_totals l using(user_id,course_id) left join activity_totals a using(user_id,course_id)
  ), snapshots as (
    select t.*,t.total_lessons+t.total_activities total_items,t.completed_lessons+t.completed_activities completed_items,
      case when t.total_lessons+t.total_activities=0 then 0::numeric
        else round(100.0*(t.completed_lessons+t.completed_activities)/(t.total_lessons+t.total_activities),2) end progress_percentage,
      case when t.total_lessons+t.total_activities>0 and t.completed_lessons+t.completed_activities=t.total_lessons+t.total_activities then 'completed'
        when t.started or t.completed_lessons+t.completed_activities>0 then 'in_progress' else 'not_started' end status_code
    from totals t
  ) select coalesce(bool_or(not s.can_read),false),coalesce(jsonb_agg(jsonb_build_object(
      'id',coalesce(cp.id,s.course_id),'user_id',s.user_id,'course_id',s.course_id,
      'completed_lessons',s.completed_lessons,'total_lessons',s.total_lessons,
      'completed_activities',s.completed_activities,'total_activities',s.total_activities,
      'completed_items',s.completed_items,'total_items',s.total_items,
      'progress_percentage',s.progress_percentage,'status_code',s.status_code,
      'started_at',coalesce(cp.started_at,s.started_at),'completed_at',case when s.status_code='completed' then coalesce(s.completed_at,cp.completed_at) end,
      'last_accessed_at',cp.last_accessed_at,'created_at',cp.created_at,'updated_at',cp.updated_at)
      order by s.user_id,s.course_id),'[]'::jsonb)
    into forbidden,result from snapshots s left join delivery.course_progress cp on cp.user_id=s.user_id and cp.course_id=s.course_id;
  if forbidden then raise exception 'Access denied.'; end if;
  if jsonb_array_length(result)>5000 then raise exception 'Progress batch is too large.'; end if;
  return result;
end $$;
revoke all on function delivery.course_progress_snapshot(uuid[],uuid[]) from public,anon;
grant execute on function delivery.course_progress_snapshot(uuid[],uuid[]) to authenticated;

create or replace function delivery.refresh_course_progress(p_student_id uuid,p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare snapshot jsonb; saved delivery.course_progress;
begin
  -- Serialize competing completions for this student/course before reading totals.
  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text||':'||p_course_id::text,0));
  snapshot=delivery.course_progress_snapshot(array[p_student_id],array[p_course_id])->0;
  if snapshot is null then raise exception 'Course is unavailable or is not assigned to this student.'; end if;
  insert into delivery.course_progress(user_id,course_id,status_code,completed_lessons,total_lessons,progress_percentage,started_at,completed_at,last_accessed_at)
    values(p_student_id,p_course_id,snapshot->>'status_code',(snapshot->>'completed_lessons')::integer,(snapshot->>'total_lessons')::integer,
      (snapshot->>'progress_percentage')::numeric,(snapshot->>'started_at')::timestamptz,(snapshot->>'completed_at')::timestamptz,now())
    on conflict(user_id,course_id) do update set status_code=excluded.status_code,completed_lessons=excluded.completed_lessons,
      total_lessons=excluded.total_lessons,progress_percentage=excluded.progress_percentage,
      started_at=coalesce(delivery.course_progress.started_at,excluded.started_at),completed_at=excluded.completed_at,
      last_accessed_at=excluded.last_accessed_at,updated_at=now() returning * into saved;
  return snapshot||to_jsonb(saved);
end $$;
revoke all on function delivery.refresh_course_progress(uuid,uuid) from public,anon;
grant execute on function delivery.refresh_course_progress(uuid,uuid) to authenticated;

create index if not exists activity_assignments_live_cohort on learning.activity_assignments(cohort_id,activity_id) where deleted_at is null;
create index if not exists quiz_attempts_passed_student on learning.quiz_attempts(student_id,quiz_id) where passed and not forfeited and submitted_at is not null;

create or replace function delivery.set_lesson_progress(p_student_id uuid,p_lesson_id uuid,p_course_id uuid,p_complete boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record; saved delivery.lesson_progress; snapshot jsonb;
begin
  select * into actor from core.get_current_user();
  if actor.user_id is null or actor.status<>'active' or actor.user_id<>p_student_id or not 'student'=any(actor.roles) then
    raise exception 'Only the student may update their lesson progress.';
  end if;
  if p_student_id is null or p_lesson_id is null or p_course_id is null or p_complete is null then raise exception 'Invalid lesson progress input.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_student_id::text||':'||p_course_id::text,0));
  if not exists(select 1 from academic.lessons l
    join academic.modules m on m.id=l.module_id and m.deleted_at is null
    join academic.courses c on c.id=m.course_id and c.deleted_at is null
    join academic.statuses ls on ls.id=l.status_id and ls.code='active'
    join academic.statuses ms on ms.id=m.status_id and ms.code='active'
    where l.id=p_lesson_id and c.id=p_course_id and l.deleted_at is null
      and l.tenant_id=c.tenant_id and l.institution_id=c.tenant_id and m.tenant_id=c.tenant_id and m.institution_id=c.tenant_id)
    then raise exception 'Lesson is unavailable or does not belong to this course.'; end if;
  snapshot=delivery.course_progress_snapshot(array[p_student_id],array[p_course_id])->0;
  if snapshot is null then raise exception 'This course is not assigned or is unavailable.'; end if;
  insert into delivery.lesson_progress(user_id,lesson_id,status_code,progress_percentage,started_at,completed_at,last_accessed_at)
    values(p_student_id,p_lesson_id,case when p_complete then 'completed' else 'in_progress' end,
      case when p_complete then 100 else 10 end,now(),case when p_complete then now() end,now())
    on conflict(user_id,lesson_id) do update set
      status_code=case when delivery.lesson_progress.status_code='completed' or p_complete then 'completed' else 'in_progress' end,
      progress_percentage=case when delivery.lesson_progress.status_code='completed' or p_complete then 100 else greatest(10,delivery.lesson_progress.progress_percentage) end,
      started_at=coalesce(delivery.lesson_progress.started_at,excluded.started_at),
      completed_at=case when delivery.lesson_progress.status_code='completed' or p_complete then coalesce(delivery.lesson_progress.completed_at,now()) else null end,
      last_accessed_at=now(),updated_at=now() returning * into saved;
  snapshot=delivery.refresh_course_progress(p_student_id,p_course_id);
  return jsonb_build_object('progress',to_jsonb(saved),'course_progress',snapshot);
end $$;
revoke all on function delivery.set_lesson_progress(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function delivery.set_lesson_progress(uuid,uuid,uuid,boolean) to authenticated;

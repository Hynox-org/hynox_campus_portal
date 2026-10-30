-- An identical pending submission retry must return the existing record without
-- resetting progress dates or producing spurious learning revisions.
create or replace function learning.submit_project(p_project uuid,p_student uuid,p_progress uuid,p_url text,p_notes text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor record;project learning.projects;prog learning.student_activity_progress;sub learning.project_submissions;review learning.project_reviews;begin
 if p_url is null or p_url !~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'
  or length(p_url)>2000 or length(coalesce(p_notes,''))>20000 then raise exception 'Provide a valid HTTPS GitHub repository URL and bounded notes.';end if;
 select * into actor from core.get_current_user();
 select * into project from learning.projects where id=p_project;
 if actor.user_id is null or actor.user_id is distinct from p_student or actor.status<>'active' or not 'student'=any(actor.roles)
   or project.id is null or not learning.can_read_activity(project.activity_id,true) then raise exception 'This activity is unavailable.';end if;
 perform pg_advisory_xact_lock(hashtextextended('activity:'||p_student||':'||project.activity_id,0));
 select * into sub from learning.project_submissions where project_id=p_project and student_id=p_student for update;
 if sub.id is not null then
   if p_progress is not null and p_progress is distinct from sub.student_activity_progress_id then raise exception 'Invalid activity progress.';end if;
   select * into review from learning.project_reviews where submission_id=sub.id;
   if review.id is null and sub.github_url=p_url and coalesce(sub.submission_notes,'')=coalesce(p_notes,'') then return to_jsonb(sub);end if;
   if review.review_status is null or review.review_status not in ('rejected','revision_requested') then raise exception 'This project is awaiting review or already approved.';end if;
 end if;
 prog=learning.begin_student_activity(project.activity_id,p_student,p_progress);
 insert into learning.project_submissions(project_id,student_id,student_activity_progress_id,github_url,submission_notes)
 values(p_project,p_student,prog.id,p_url,nullif(p_notes,'')) on conflict(project_id,student_id) do update
 set student_activity_progress_id=prog.id,github_url=excluded.github_url,submission_notes=excluded.submission_notes,submitted_at=now(),updated_at=now() returning * into sub;
 delete from learning.project_reviews where submission_id=sub.id;
 return to_jsonb(sub);
end $$;

-- Super Admin can inspect past/inactive groups without being able to mark them.
create or replace function delivery.can_read_attendance(p_cohort uuid,p_student uuid default null)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select delivery.can_mark_attendance(p_cohort) or exists(select 1 from core.get_current_user() cu
 join delivery.cohorts c on c.id=p_cohort and c.deleted_at is null
 join institution.institutions i on i.id=c.institution_id and i.status='active'
 where cu.status='active' and cu.user_id is not null and (
 'super_admin'=any(cu.roles) or ('institution_admin'=any(cu.roles) and cu.tenant_id=c.institution_id) or
 (p_student=cu.user_id and 'student'=any(cu.roles) and exists(select 1 from delivery.enrollments e
 where e.cohort_id=c.id and e.user_id=cu.user_id and e.status_code='active' and e.deleted_at is null))));
$$;

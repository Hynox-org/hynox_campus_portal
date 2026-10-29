-- Changing a group's dates/program must not invalidate its existing delivery hierarchy.
create function delivery.protect_cohort_assignment_dates() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.deleted_at is not null then return new; end if;
 if new.program_id is distinct from old.program_id and (
  exists(select 1 from delivery.enrollments where cohort_id=new.id and deleted_at is null)
  or exists(select 1 from delivery.course_assignments where cohort_id=new.id and deleted_at is null)
 ) then raise exception 'Create a new cohort to change the program after enrollment or course assignment.'; end if;
 if exists(select 1 from delivery.course_assignments a where a.cohort_id=new.id and a.deleted_at is null
   and (a.start_date<new.start_date or a.start_date>new.end_date or a.due_date<new.start_date or a.due_date>new.end_date))
 then raise exception 'Cohort dates must contain all existing course assignment dates.'; end if;
 return new;
end;
$$;
revoke all on function delivery.protect_cohort_assignment_dates() from public,anon,authenticated;
create trigger protect_cohort_assignment_dates before update of start_date,end_date,program_id on delivery.cohorts
 for each row execute function delivery.protect_cohort_assignment_dates();

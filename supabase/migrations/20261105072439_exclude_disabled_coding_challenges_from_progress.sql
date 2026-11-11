-- Coding challenges are temporarily disabled in the application. Keep their
-- rows intact, but do not let an existing required challenge block course
-- completion while students cannot access it.
do $$
declare
  definition text;
  updated_definition text;
  target constant text := 'and a.status_code=''published'' and coalesce(a.is_mandatory,true)';
begin
  select pg_get_functiondef('delivery.course_progress_snapshot(uuid[],uuid[])'::regprocedure)
    into definition;

  if position(target in definition) = 0 then
    raise exception 'course_progress_snapshot definition has changed; progress feature gate was not applied';
  end if;

  updated_definition := replace(
    definition,
    target,
    target || ' and a.activity_type_code not in (''programming'',''programming_challenge'')'
  );
  execute updated_definition;
end $$;

-- Limit the temporary shared account to its selected, assigned role per request.
-- Other users retain the existing role resolution.
create or replace function core.get_current_user()
returns table (user_id uuid, tenant_id uuid, roles text[], status text)
language sql stable security definer
set search_path = core, auth, pg_catalog
as $$
  select u.id, u.tenant_id,
    coalesce(array_agg(r.name) filter (where r.name is not null and (
      coalesce(a.raw_app_meta_data->>'shared_dashboard_login', 'false') <> 'true'
      or (u.status = 'active' and
        coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
          ->> 'x-campus-dashboard-role' = a.id::text || ':' || r.name)
    )), '{}'::text[]), u.status
  from core.users u
  join auth.users a on a.id = u.auth_user_id
  left join core.user_roles ur on ur.user_id = u.id
  left join core.roles r on r.id = ur.role_id
  where u.auth_user_id = auth.uid() and u.deleted_at is null
  group by u.id, u.tenant_id, u.status;
$$;
revoke all on function core.get_current_user() from public;
grant execute on function core.get_current_user() to authenticated, anon, service_role, postgres;

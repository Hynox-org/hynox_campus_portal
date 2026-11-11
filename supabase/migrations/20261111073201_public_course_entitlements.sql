set lock_timeout = '5s';

insert into core.invitation_types(code, description) values
  ('public_course_purchase', 'Onboarding invitation for a public course buyer')
on conflict (code) do nothing;

alter table public.hynox_campus_payments
  add column course_code text,
  add column portal_provision_status text not null default 'PENDING',
  add column portal_provisioned_at timestamptz,
  add column portal_provision_error text,
  add constraint hynox_campus_payments_course_code_format
    check (course_code is null or course_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint hynox_campus_payments_portal_provision_status_check
    check (portal_provision_status in ('PENDING', 'COMPLETED', 'FAILED'));

create index hynox_campus_payments_portal_provision_idx
  on public.hynox_campus_payments(portal_provision_status, updated_at)
  where payment_status = 'COMPLETED' and portal_provision_status <> 'COMPLETED';

create table delivery.public_course_offerings (
  purchase_code text primary key check (purchase_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  course_id uuid not null unique references academic.courses(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table delivery.public_course_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references core.users(id) on delete cascade,
  course_id uuid not null references academic.courses(id) on delete restrict,
  purchase_code text not null references delivery.public_course_offerings(purchase_code) on delete restrict,
  payment_reference text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references core.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and revoked_at is null) or status = 'revoked')
);

create index public_course_entitlements_user_status_idx
  on delivery.public_course_entitlements(user_id, status);
create index public_course_entitlements_course_status_idx
  on delivery.public_course_entitlements(course_id, status);

alter table delivery.public_course_offerings enable row level security;
alter table delivery.public_course_entitlements enable row level security;
revoke all on delivery.public_course_offerings, delivery.public_course_entitlements from anon, authenticated;
grant select, insert, update, delete on delivery.public_course_offerings to authenticated, service_role;
grant select, update on delivery.public_course_entitlements to authenticated;
grant all on delivery.public_course_entitlements to service_role;

create policy public_course_offerings_admin on delivery.public_course_offerings
  for all to authenticated
  using (exists(select 1 from core.get_current_user() cu where 'super_admin' = any(cu.roles)))
  with check (exists(select 1 from core.get_current_user() cu where 'super_admin' = any(cu.roles)));

create policy public_course_entitlements_read on delivery.public_course_entitlements
  for select to authenticated
  using (
    exists(select 1 from core.get_current_user() cu where cu.user_id = public_course_entitlements.user_id or 'super_admin' = any(cu.roles))
  );

create policy public_course_entitlements_admin_update on delivery.public_course_entitlements
  for update to authenticated
  using (exists(select 1 from core.get_current_user() cu where 'super_admin' = any(cu.roles)))
  with check (exists(select 1 from core.get_current_user() cu where 'super_admin' = any(cu.roles)));

create function core.has_public_course_access(target_course_id uuid)
returns boolean
language sql stable security definer
set search_path = core, delivery, auth, pg_catalog
as $$
  select exists(
    select 1
    from core.users u
    join delivery.public_course_entitlements e on e.user_id = u.id
    where u.auth_user_id = auth.uid()
      and u.status = 'active'
      and u.deleted_at is null
      and e.course_id = target_course_id
      and e.status = 'active'
  );
$$;
revoke all on function core.has_public_course_access(uuid) from public, anon;
grant execute on function core.has_public_course_access(uuid) to authenticated, service_role;

create policy courses_public_entitlement_read on academic.courses
  for select to authenticated
  using (deleted_at is null and (select core.has_public_course_access(id)));

create policy modules_public_entitlement_read on academic.modules
  for select to authenticated
  using (deleted_at is null and (select core.has_public_course_access(course_id)));

create policy lessons_public_entitlement_read on academic.lessons
  for select to authenticated
  using (
    deleted_at is null and exists(
      select 1 from academic.modules m
      where m.id = lessons.module_id
        and m.deleted_at is null
        and (select core.has_public_course_access(m.course_id))
    )
  );

create policy lesson_resources_public_entitlement_read on academic.lesson_resources
  for select to authenticated
  using (
    deleted_at is null and exists(
      select 1
      from academic.lessons l
      join academic.modules m on m.id = l.module_id
      where l.id = lesson_resources.lesson_id
        and l.deleted_at is null
        and m.deleted_at is null
        and (select core.has_public_course_access(m.course_id))
    )
  );

create function core.provision_public_purchase(payment_id bigint)
returns jsonb
language plpgsql security definer
set search_path = core, delivery, academic, public, auth, pg_catalog
as $$
declare
  payment public.hynox_campus_payments%rowtype;
  offering delivery.public_course_offerings%rowtype;
  account core.users%rowtype;
  invitation core.user_invitations%rowtype;
  role_id_value uuid;
  existing_entitlement delivery.public_course_entitlements%rowtype;
  matches integer;
begin
  select * into payment from public.hynox_campus_payments where id = payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if payment.payment_status <> 'COMPLETED' then raise exception 'Payment is not completed'; end if;
  if payment.course_code is null then raise exception 'Payment course code is missing'; end if;

  select * into offering
  from delivery.public_course_offerings
  where purchase_code = payment.course_code and active
  for share;
  if not found then raise exception 'Course offering is unavailable'; end if;
  if not exists(select 1 from academic.courses c where c.id = offering.course_id and c.deleted_at is null) then
    raise exception 'Course is unavailable';
  end if;
  if payment.customer_email is null
    or length(payment.customer_email) > 254
    or payment.customer_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then
    raise exception 'Payment email is invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(payment.customer_email), 913));
  select count(*) into matches from core.users where lower(email) = lower(payment.customer_email);
  if matches > 1 then raise exception 'Buyer email is ambiguous'; end if;
  if matches = 1 then
    select * into account from core.users where lower(email) = lower(payment.customer_email) for update;
    if account.deleted_at is not null or account.status not in ('active', 'invited') then
      raise exception 'Buyer account is unavailable';
    end if;
  else
    insert into core.users(full_name, email, phone, tenant_id, status, onboarding_source)
    values(
      left(btrim(coalesce(payment.customer_name, 'Course learner')), 200),
      lower(payment.customer_email), payment.customer_phone, null, 'invited', 'api_created'
    ) returning * into account;
  end if;

  select id into strict role_id_value from core.roles where name = 'public';
  insert into core.user_roles(user_id, role_id) values(account.id, role_id_value) on conflict do nothing;

  select * into existing_entitlement
  from delivery.public_course_entitlements
  where payment_reference = payment.merchant_order_id
  for update;
  if found and (existing_entitlement.user_id <> account.id or existing_entitlement.course_id <> offering.course_id) then
    raise exception 'Payment is already linked to another entitlement';
  end if;

  insert into delivery.public_course_entitlements(user_id, course_id, purchase_code, payment_reference)
  values(account.id, offering.course_id, offering.purchase_code, payment.merchant_order_id)
  on conflict(payment_reference) do nothing;

  if account.auth_user_id is null then
    select * into invitation
    from core.user_invitations
    where user_id = account.id
      and invitation_type = 'public_course_purchase'
      and status in ('created', 'sent', 'pending')
      and expires_at > statement_timestamp()
    order by created_at desc limit 1 for update;
    if not found then
      update core.user_invitations
      set status = 'revoked', mail_state = 'cancelled', mail_lease = null,
          mail_lease_until = null, updated_at = now()
      where user_id = account.id and status in ('created', 'sent', 'pending', 'failed');
      insert into core.user_invitations(
        user_id, tenant_id, invited_by, expires_at, invitation_type, mail_state
      ) values(
        account.id, null, null, now() + interval '7 days', 'public_course_purchase', 'queued'
      ) returning * into invitation;
    end if;
  else
    perform core.set_user_role_claim(account.auth_user_id);
  end if;

  update public.hynox_campus_payments
  set portal_provision_status = 'COMPLETED', portal_provisioned_at = now(),
      portal_provision_error = null, updated_at = now()
  where id = payment.id;

  return jsonb_build_object(
    'user_id', account.id,
    'course_id', offering.course_id,
    'invitation_queued', account.auth_user_id is null,
    'status', 'COMPLETED'
  );
end;
$$;
revoke all on function core.provision_public_purchase(bigint) from public, anon, authenticated;
grant execute on function core.provision_public_purchase(bigint) to service_role;

notify pgrst, 'reload schema';

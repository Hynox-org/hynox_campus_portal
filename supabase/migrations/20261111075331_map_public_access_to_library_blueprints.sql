set lock_timeout = '5s';

drop policy if exists courses_public_entitlement_read on academic.courses;
drop policy if exists modules_public_entitlement_read on academic.modules;
drop policy if exists lessons_public_entitlement_read on academic.lessons;
drop policy if exists lesson_resources_public_entitlement_read on academic.lesson_resources;
drop function if exists core.has_public_course_access(uuid);

alter table delivery.public_course_offerings
  drop constraint public_course_offerings_course_id_fkey,
  drop constraint public_course_offerings_course_id_key;
alter table delivery.public_course_offerings rename column course_id to course_template_id;
alter table delivery.public_course_offerings
  add constraint public_course_offerings_template_fkey
    foreign key(course_template_id) references library.course_templates(id) on delete restrict,
  add constraint public_course_offerings_template_key unique(course_template_id);

alter table delivery.public_course_entitlements
  drop constraint public_course_entitlements_course_id_fkey;
alter table delivery.public_course_entitlements rename column course_id to course_template_id;
alter table delivery.public_course_entitlements
  add constraint public_course_entitlements_template_fkey
    foreign key(course_template_id) references library.course_templates(id) on delete restrict;

insert into delivery.public_course_offerings(purchase_code, display_name, course_template_id, active)
select mapping.purchase_code, mapping.display_name, template.id, true
from (values
  ('ai-machine-learning', 'AI & Machine Learning', 'ai-machine-learning'),
  ('d2c-mentorship', 'D2C Mentorship', 'd2c-mentorship'),
  ('digital-marketing', 'Digital Marketing', 'digital-marketing'),
  ('full-stack-development', 'Full Stack Development', 'full-stack-development'),
  ('management-consulting', 'Management Consulting', 'management-consulting'),
  ('product-design', 'Product Design', 'product-design'),
  ('ui-ux-design', 'UI/UX Design', 'ui-ux-design')
) as mapping(purchase_code, display_name, template_slug)
join library.course_templates template
  on template.slug = mapping.template_slug and template.deleted_at is null and template.is_latest
on conflict(purchase_code) do update
set display_name = excluded.display_name,
    course_template_id = excluded.course_template_id,
    active = true,
    updated_at = now();

do $$
begin
  if (select count(*) from delivery.public_course_offerings where active) <> 7 then
    raise exception 'All seven public course blueprints must be present before mapping purchases';
  end if;
end $$;

drop index delivery.public_course_entitlements_course_status_idx;
create index public_course_entitlements_template_status_idx
  on delivery.public_course_entitlements(course_template_id, status);

create function core.has_public_course_template_access(target_template_id uuid)
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
      and e.course_template_id = target_template_id
      and e.status = 'active'
  );
$$;
revoke all on function core.has_public_course_template_access(uuid) from public, anon;
grant execute on function core.has_public_course_template_access(uuid) to authenticated, service_role;

alter policy select_course_templates on library.course_templates using (
  deleted_at is null and (
    library.is_super_admin()
    or (is_published and (select core.has_public_course_template_access(id)))
  )
);
alter policy select_module_templates on library.module_templates using (
  deleted_at is null and exists(
    select 1 from library.course_templates ct
    where ct.id = module_templates.course_template_id
      and ct.deleted_at is null
      and (
        library.is_super_admin()
        or (ct.is_published and (select core.has_public_course_template_access(ct.id)))
      )
  )
);
alter policy select_lesson_templates on library.lesson_templates using (
  deleted_at is null and exists(
    select 1
    from library.module_templates mt
    join library.course_templates ct on ct.id = mt.course_template_id
    where mt.id = lesson_templates.module_template_id
      and mt.deleted_at is null and ct.deleted_at is null
      and (
        library.is_super_admin()
        or (ct.is_published and (select core.has_public_course_template_access(ct.id)))
      )
  )
);
alter policy select_resource_templates on library.resource_templates using (
  deleted_at is null and exists(
    select 1
    from library.lesson_templates lt
    join library.module_templates mt on mt.id = lt.module_template_id
    join library.course_templates ct on ct.id = mt.course_template_id
    where lt.id = resource_templates.lesson_template_id
      and lt.deleted_at is null and mt.deleted_at is null and ct.deleted_at is null
      and (
        library.is_super_admin()
        or (ct.is_published and (select core.has_public_course_template_access(ct.id)))
      )
  )
);

create or replace function core.provision_public_purchase(payment_id bigint)
returns jsonb
language plpgsql security definer
set search_path = core, delivery, library, public, auth, pg_catalog
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
  if not exists(
    select 1 from library.course_templates c
    where c.id = offering.course_template_id and c.deleted_at is null and c.is_published
  ) then raise exception 'Course blueprint is unavailable'; end if;
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
  if found and (
    existing_entitlement.user_id <> account.id
    or existing_entitlement.course_template_id <> offering.course_template_id
  ) then raise exception 'Payment is already linked to another entitlement'; end if;

  insert into delivery.public_course_entitlements(
    user_id, course_template_id, purchase_code, payment_reference
  ) values(
    account.id, offering.course_template_id, offering.purchase_code, payment.merchant_order_id
  ) on conflict(payment_reference) do nothing;

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
    'course_template_id', offering.course_template_id,
    'invitation_queued', account.auth_user_id is null,
    'status', 'COMPLETED'
  );
end;
$$;
revoke all on function core.provision_public_purchase(bigint) from public, anon, authenticated;
grant execute on function core.provision_public_purchase(bigint) to service_role;

notify pgrst, 'reload schema';

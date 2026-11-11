set lock_timeout = '5s';

alter table public.hynox_campus_payments
  add column portal_mail_kind text,
  add column portal_mail_state text not null default 'none',
  add column portal_mail_attempts integer not null default 0,
  add column portal_mail_next_attempt_at timestamptz not null default now(),
  add column portal_mail_lease uuid,
  add column portal_mail_lease_until timestamptz,
  add column portal_mail_message_id text,
  add constraint hynox_campus_payments_portal_mail_kind_check
    check (portal_mail_kind is null or portal_mail_kind in ('purchase_confirmation', 'duplicate_refund_review')),
  add constraint hynox_campus_payments_portal_mail_state_check
    check (portal_mail_state in ('none', 'queued', 'processing', 'sent', 'failed', 'cancelled')),
  add constraint hynox_campus_payments_portal_mail_attempts_check
    check (portal_mail_attempts between 0 and 5);

create index hynox_campus_payments_portal_mail_queue_idx
  on public.hynox_campus_payments(portal_mail_state, portal_mail_next_attempt_at, id)
  where portal_mail_state in ('queued', 'processing');

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
  duplicate_purchase boolean := false;
  onboarding_queued boolean := false;
begin
  select * into payment from public.hynox_campus_payments where id = payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if payment.payment_status <> 'COMPLETED' then raise exception 'Payment is not completed'; end if;
  if payment.portal_provision_status = 'COMPLETED' then
    return jsonb_build_object(
      'status', 'COMPLETED', 'already_provisioned', true,
      'mail_state', payment.portal_mail_state, 'mail_kind', payment.portal_mail_kind
    );
  end if;
  if payment.course_code is null then raise exception 'Payment course code is missing'; end if;

  select * into offering from delivery.public_course_offerings
  where purchase_code = payment.course_code and active for share;
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
    values(left(btrim(coalesce(payment.customer_name, 'Course learner')), 200),
      lower(payment.customer_email), payment.customer_phone, null, 'invited', 'api_created')
    returning * into account;
  end if;

  select id into strict role_id_value from core.roles where name = 'public';
  insert into core.user_roles(user_id, role_id) values(account.id, role_id_value) on conflict do nothing;

  select * into existing_entitlement from delivery.public_course_entitlements
  where payment_reference = payment.merchant_order_id for update;
  if found and (existing_entitlement.user_id <> account.id
    or existing_entitlement.course_template_id <> offering.course_template_id) then
    raise exception 'Payment is already linked to another entitlement';
  end if;

  duplicate_purchase := exists(
    select 1 from delivery.public_course_entitlements e
    where e.user_id = account.id and e.course_template_id = offering.course_template_id
      and e.status = 'active' and e.payment_reference <> payment.merchant_order_id
  );
  if not duplicate_purchase then
    insert into delivery.public_course_entitlements(
      user_id, course_template_id, purchase_code, payment_reference
    ) values(account.id, offering.course_template_id, offering.purchase_code, payment.merchant_order_id)
    on conflict(payment_reference) do nothing;
  end if;

  if account.auth_user_id is null then
    select * into invitation from core.user_invitations
    where user_id = account.id and invitation_type = 'public_course_purchase'
      and status in ('created', 'sent', 'pending') and expires_at > statement_timestamp()
    order by created_at desc limit 1 for update;
    if not found then
      update core.user_invitations
      set status = 'revoked', mail_state = 'cancelled', mail_lease = null,
          mail_lease_until = null, updated_at = now()
      where user_id = account.id and status in ('created', 'sent', 'pending', 'failed');
      insert into core.user_invitations(
        user_id, tenant_id, invited_by, expires_at, invitation_type, mail_state
      ) values(account.id, null, null, now() + interval '7 days', 'public_course_purchase', 'queued')
      returning * into invitation;
    elsif invitation.mail_state <> 'processing' then
      update core.user_invitations
      set mail_state = 'queued', mail_attempts = 0, mail_next_attempt_at = now(),
          mail_lease = null, mail_lease_until = null, mail_message_id = null, updated_at = now()
      where id = invitation.id returning * into invitation;
    end if;
    onboarding_queued := true;
  else
    perform core.set_user_role_claim(account.auth_user_id);
  end if;

  update public.hynox_campus_payments
  set portal_provision_status = 'COMPLETED', portal_provisioned_at = now(),
      portal_provision_error = null,
      portal_mail_kind = case
        when duplicate_purchase then 'duplicate_refund_review'
        when account.auth_user_id is not null then 'purchase_confirmation'
        else null
      end,
      portal_mail_state = case
        when duplicate_purchase or account.auth_user_id is not null then 'queued'
        else 'none'
      end,
      portal_mail_attempts = 0, portal_mail_next_attempt_at = now(),
      portal_mail_lease = null, portal_mail_lease_until = null,
      portal_mail_message_id = null, updated_at = now()
  where id = payment.id;

  return jsonb_build_object(
    'user_id', account.id, 'course_template_id', offering.course_template_id,
    'duplicate_purchase', duplicate_purchase, 'invitation_queued', onboarding_queued,
    'mail_kind', case when duplicate_purchase then 'duplicate_refund_review'
      when account.auth_user_id is not null then 'purchase_confirmation' else null end,
    'status', 'COMPLETED'
  );
end;
$$;
revoke all on function core.provision_public_purchase(bigint) from public, anon, authenticated;
grant execute on function core.provision_public_purchase(bigint) to service_role;

create function core.claim_public_purchase_mail()
returns jsonb
language plpgsql security definer
set search_path = core, delivery, library, public, pg_catalog
as $$
declare
  payment public.hynox_campus_payments%rowtype;
  lease_value uuid := gen_random_uuid();
  buyer core.users%rowtype;
  purchased_course text;
  course_names jsonb;
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  update public.hynox_campus_payments
  set portal_mail_state = 'failed', portal_mail_lease = null, portal_mail_lease_until = null, updated_at = now()
  where portal_mail_state = 'processing' and portal_mail_attempts >= 5 and portal_mail_lease_until < now();

  select p.* into payment
  from public.hynox_campus_payments p
  where p.portal_provision_status = 'COMPLETED'
    and p.portal_mail_kind is not null
    and ((p.portal_mail_state = 'queued' and p.portal_mail_next_attempt_at <= now())
      or (p.portal_mail_state = 'processing' and p.portal_mail_lease_until < now()))
    and p.portal_mail_attempts < 5
  order by p.portal_mail_next_attempt_at, p.id
  limit 1 for update skip locked;
  if not found then return null; end if;

  update public.hynox_campus_payments
  set portal_mail_state = 'processing', portal_mail_attempts = portal_mail_attempts + 1,
      portal_mail_lease = lease_value, portal_mail_lease_until = now() + interval '2 minutes', updated_at = now()
  where id = payment.id;

  select * into buyer from core.users where lower(email) = lower(payment.customer_email) and deleted_at is null;
  select o.display_name into purchased_course from delivery.public_course_offerings o
  where o.purchase_code = payment.course_code;
  select coalesce(jsonb_agg(o.display_name order by o.display_name), '[]'::jsonb) into course_names
  from (
    select distinct e.purchase_code from delivery.public_course_entitlements e
    where e.user_id = buyer.id and e.status = 'active'
  ) access join delivery.public_course_offerings o on o.purchase_code = access.purchase_code;

  return jsonb_build_object(
    'payment_id', payment.id, 'lease', lease_value, 'email', payment.customer_email,
    'name', coalesce(nullif(btrim(payment.customer_name), ''), buyer.full_name, 'Course learner'),
    'mail_kind', payment.portal_mail_kind, 'purchased_course', purchased_course,
    'courses', course_names, 'payment_reference', payment.merchant_order_id
  );
end;
$$;
revoke all on function core.claim_public_purchase_mail() from public, anon, authenticated;
grant execute on function core.claim_public_purchase_mail() to service_role;

create function core.finish_public_purchase_mail(
  payment_id bigint, lease_value uuid, succeeded boolean, message_id text default null
)
returns boolean
language plpgsql security definer
set search_path = public, pg_catalog
as $$
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  update public.hynox_campus_payments
  set portal_mail_state = case when succeeded then 'sent'
      when portal_mail_attempts >= 5 then 'failed' else 'queued' end,
      portal_mail_next_attempt_at = case when succeeded then portal_mail_next_attempt_at
        else now() + make_interval(secs => least(3600, 30 * (2 ^ greatest(portal_mail_attempts - 1, 0)))) end,
      portal_mail_lease = null, portal_mail_lease_until = null,
      portal_mail_message_id = case when succeeded then left(message_id, 500) else null end,
      updated_at = now()
  where id = payment_id and portal_mail_lease = lease_value and portal_mail_state = 'processing';
  return found;
end;
$$;
revoke all on function core.finish_public_purchase_mail(bigint, uuid, boolean, text) from public, anon, authenticated;
grant execute on function core.finish_public_purchase_mail(bigint, uuid, boolean, text) to service_role;

notify pgrst, 'reload schema';

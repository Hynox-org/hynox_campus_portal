set lock_timeout = '5s';

alter table public.hynox_campus_payments
  add column portal_mail_idempotency_key uuid not null default gen_random_uuid();

create or replace function core.claim_public_purchase_mail()
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
    'courses', course_names, 'idempotency_key', payment.portal_mail_idempotency_key
  );
end;
$$;
revoke all on function core.claim_public_purchase_mail() from public, anon, authenticated;
grant execute on function core.claim_public_purchase_mail() to service_role;

notify pgrst, 'reload schema';

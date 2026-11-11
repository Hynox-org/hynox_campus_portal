do $$
declare definition text;
begin
  if to_regprocedure('core.provision_public_purchase(uuid)') is not null then
    select pg_get_functiondef('core.provision_public_purchase(uuid)'::regprocedure) into definition;
    drop function core.provision_public_purchase(uuid);
    definition := replace(definition, 'provision_public_purchase(payment_id uuid)', 'provision_public_purchase(payment_id bigint)');
    execute definition;
  end if;
end $$;

revoke all on function core.provision_public_purchase(bigint) from public, anon, authenticated;
grant execute on function core.provision_public_purchase(bigint) to service_role;
notify pgrst, 'reload schema';

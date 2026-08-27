\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

do $$
declare
  v_supply uuid := '69100000-0000-4000-8000-000000000011';
  v_provider uuid := '69100000-0000-4000-8000-000000000010';
  v_location uuid := '69100000-0000-4000-8000-000000000012';
begin
  delete from public.order_items where order_id in (
    '69100000-0000-4000-8000-000000000021',
    '69100000-0000-4000-8000-000000000022'
  );
  delete from public.orders where id in (
    '69100000-0000-4000-8000-000000000021',
    '69100000-0000-4000-8000-000000000022'
  );
  delete from public.supply_shift_order_sheets
  where area_id = (select id from public.areas where code = 'EDC_LOGISTICS')
    and work_date = date '2026-09-01';
  delete from public.user_work_shift_assignments
  where user_id in (
    '69100000-0000-4000-8000-000000000002',
    '69100000-0000-4000-8000-000000000003'
  );
  delete from public.user_roles
  where user_id in (
    '69100000-0000-4000-8000-000000000002',
    '69100000-0000-4000-8000-000000000003'
  );
  delete from public.users where id in (
    '69100000-0000-4000-8000-000000000001',
    '69100000-0000-4000-8000-000000000002',
    '69100000-0000-4000-8000-000000000003'
  );
  delete from public.stock_balances where supply_id = v_supply;
  delete from public.supply_providers where supply_id = v_supply;
  delete from public.supplies where id = v_supply;
  delete from public.storage_locations where id = v_location;
  delete from public.providers where id = v_provider;
  delete from public.supply_categories where code = 'P9_CONC_NORMAL';
end;
$$;

commit;

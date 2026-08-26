-- Committed local-only fixture for the two-session Phase 5 lock test.
do $p5_concurrency_setup$
declare
  v_supply uuid;
  v_unit uuid;
  v_admin_role uuid;
  v_approved uuid;
begin
  select id, unit_id into strict v_supply, v_unit
  from public.supplies where code = '71000860';
  select id into strict v_admin_role
  from public.roles where code = 'ADMIN' and is_system;
  select id into strict v_approved
  from public.order_statuses where code = 'APPROVED';

  insert into public.areas(id, code, name)
  values
    ('55000000-0000-4000-8000-000000000001', 'P5CC_AREA_A', 'P5 concurrency A'),
    ('55000000-0000-4000-8000-000000000002', 'P5CC_AREA_B', 'P5 concurrency B');

  insert into public.users(
    id, vinfast_id, email, role_id, area_id, first_name, last_name,
    is_active, is_verified, is_deleted
  ) values (
    '55000000-0000-4000-8000-000000000003', 955000001,
    'p5cc_admin@local.test', v_admin_role,
    '55000000-0000-4000-8000-000000000001', 'P5', 'Concurrency',
    true, true, false
  );
  insert into public.user_roles(user_id, role_id)
  values ('55000000-0000-4000-8000-000000000003', v_admin_role)
  on conflict (user_id, role_id) do update
    set is_active = true, is_deleted = false;

  insert into public.providers(id, code, name)
  values ('55000000-0000-4000-8000-000000000004', 'P5CC_PROVIDER', 'P5 concurrency Provider');
  insert into public.supply_providers(supply_id, provider_id)
  values (v_supply, '55000000-0000-4000-8000-000000000004');

  insert into public.storage_locations(id, code, area_id, name)
  values (
    '55000000-0000-4000-8000-000000000005', 'P5CC_LOCATION',
    '55000000-0000-4000-8000-000000000001', 'P5 concurrency location'
  );
  insert into public.stock_balances(
    id, supply_id, provider_id, area_id, storage_location_id,
    quantity, set_per_qty, stack_quantity, total_set_quantity
  ) values (
    '55000000-0000-4000-8000-000000000006', v_supply,
    '55000000-0000-4000-8000-000000000004',
    '55000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000005', 250, 25, 10, 250
  );

  insert into public.orders(
    id, code, from_area_id, to_area_id, requested_by, status_id
  ) values (
    '55000000-0000-4000-8000-000000000007', 'P5CC_ORDER',
    '55000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000002',
    '55000000-0000-4000-8000-000000000003', v_approved
  );
  insert into public.order_items(
    id, order_id, supply_id, provider_id, unit_id,
    quantity_requested, quantity_approved, quantity_issued,
    set_per_qty, requested_stack_quantity, requested_total_set_quantity
  ) values (
    '55000000-0000-4000-8000-000000000008',
    '55000000-0000-4000-8000-000000000007', v_supply,
    '55000000-0000-4000-8000-000000000004', v_unit,
    75, 75, 0, 25, 3, 75
  );
  insert into public.order_item_allocations(
    id, order_item_id, stock_balance_id, expected_stack_quantity
  ) values (
    '55000000-0000-4000-8000-000000000009',
    '55000000-0000-4000-8000-000000000008',
    '55000000-0000-4000-8000-000000000006', 3
  );
end
$p5_concurrency_setup$;

-- LOCAL/DISPOSABLE DATABASE ONLY.
-- Persistent fixtures for the real two-session Phase 6 lock tests.
set session_replication_role = replica;
delete from public.stock_transactions where order_id::text like '66000000-0000-4000-8000-%';
delete from public.order_revisions where order_id::text like '66000000-0000-4000-8000-%';
delete from public.inventory_discrepancies where order_id::text like '66000000-0000-4000-8000-%';
delete from public.order_item_allocations where order_item_id::text like '66000000-0000-4000-8000-%';
delete from public.order_items where order_id::text like '66000000-0000-4000-8000-%';
delete from public.orders where id::text like '66000000-0000-4000-8000-%';
delete from public.stock_balances where id::text like '66000000-0000-4000-8000-%';
delete from public.storage_locations where id::text like '66000000-0000-4000-8000-%';
delete from public.supply_providers where provider_id = '66000000-0000-4000-8000-000000000004';
delete from public.providers where id = '66000000-0000-4000-8000-000000000004';
delete from public.user_roles where user_id = '66000000-0000-4000-8000-000000000003';
delete from public.users where id = '66000000-0000-4000-8000-000000000003';
delete from public.areas where id in (
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000002'
);
set session_replication_role = origin;

do $p6_concurrency_setup$
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

  insert into public.areas(id, code, name) values
    ('66000000-0000-4000-8000-000000000001','P6CC_AREA_A','P6 concurrency A'),
    ('66000000-0000-4000-8000-000000000002','P6CC_AREA_B','P6 concurrency B');
  insert into public.users(
    id, vinfast_id, email, role_id, area_id, first_name, last_name,
    is_active, is_verified, is_deleted
  ) values (
    '66000000-0000-4000-8000-000000000003', 966000001,
    'p6cc_admin@local.test', v_admin_role,
    '66000000-0000-4000-8000-000000000001', 'P6', 'Concurrency',
    true, true, false
  );
  insert into public.user_roles(user_id, role_id)
  values ('66000000-0000-4000-8000-000000000003', v_admin_role)
  on conflict (user_id, role_id) do update
    set is_active = true, is_deleted = false;
  insert into public.providers(id, code, name)
  values ('66000000-0000-4000-8000-000000000004','P6CC_PROVIDER','P6 concurrency Provider');
  insert into public.supply_providers(supply_id, provider_id)
  values (v_supply, '66000000-0000-4000-8000-000000000004');

  insert into public.storage_locations(id, code, area_id, name) values
    ('66000000-0000-4000-8000-000000000011','P6CC_SAME','66000000-0000-4000-8000-000000000001','P6 same Order'),
    ('66000000-0000-4000-8000-000000000021','P6CC_SHARED','66000000-0000-4000-8000-000000000001','P6 shared balance'),
    ('66000000-0000-4000-8000-000000000031','P6CC_ADJUST','66000000-0000-4000-8000-000000000001','P6 adjustment'),
    ('66000000-0000-4000-8000-000000000041','P6CC_CONFIRM','66000000-0000-4000-8000-000000000001','P6 confirmation');

  insert into public.stock_balances(
    id, supply_id, provider_id, area_id, storage_location_id,
    quantity, set_per_qty, stack_quantity, total_set_quantity
  ) values
    ('66000000-0000-4000-8000-000000000012',v_supply,'66000000-0000-4000-8000-000000000004','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000011',105,21,5,105),
    ('66000000-0000-4000-8000-000000000022',v_supply,'66000000-0000-4000-8000-000000000004','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000021',105,21,5,105),
    ('66000000-0000-4000-8000-000000000032',v_supply,'66000000-0000-4000-8000-000000000004','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000031',105,21,5,105),
    ('66000000-0000-4000-8000-000000000042',v_supply,'66000000-0000-4000-8000-000000000004','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000041',105,21,5,105);

  insert into public.orders(id, code, from_area_id, to_area_id, requested_by, status_id) values
    ('66000000-0000-4000-8000-000000000013','P6CC_SAME_ORDER','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000003',v_approved),
    ('66000000-0000-4000-8000-000000000023','P6CC_SHARED_A','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000003',v_approved),
    ('66000000-0000-4000-8000-000000000024','P6CC_SHARED_B','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000003',v_approved),
    ('66000000-0000-4000-8000-000000000033','P6CC_ISSUE_ADJUST','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000003',v_approved),
    ('66000000-0000-4000-8000-000000000043','P6CC_CONFIRM_ISSUE','66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000003',v_approved);

  insert into public.order_items(
    id, order_id, supply_id, provider_id, unit_id,
    quantity_requested, quantity_approved, quantity_issued,
    set_per_qty, requested_stack_quantity, requested_total_set_quantity
  ) values
    ('66000000-0000-4000-8000-000000000014','66000000-0000-4000-8000-000000000013',v_supply,'66000000-0000-4000-8000-000000000004',v_unit,21,21,0,21,1,21),
    ('66000000-0000-4000-8000-000000000025','66000000-0000-4000-8000-000000000023',v_supply,'66000000-0000-4000-8000-000000000004',v_unit,63,63,0,21,3,63),
    ('66000000-0000-4000-8000-000000000026','66000000-0000-4000-8000-000000000024',v_supply,'66000000-0000-4000-8000-000000000004',v_unit,63,63,0,21,3,63),
    ('66000000-0000-4000-8000-000000000034','66000000-0000-4000-8000-000000000033',v_supply,'66000000-0000-4000-8000-000000000004',v_unit,21,21,0,21,1,21),
    ('66000000-0000-4000-8000-000000000044','66000000-0000-4000-8000-000000000043',v_supply,'66000000-0000-4000-8000-000000000004',v_unit,63,63,0,21,3,63);

  insert into public.order_item_allocations(
    id, order_item_id, stock_balance_id, expected_stack_quantity,
    actual_stack_quantity, confirmed_at
  ) values
    ('66000000-0000-4000-8000-000000000015','66000000-0000-4000-8000-000000000014','66000000-0000-4000-8000-000000000012',1,1,now()),
    ('66000000-0000-4000-8000-000000000027','66000000-0000-4000-8000-000000000025','66000000-0000-4000-8000-000000000022',3,3,now()),
    ('66000000-0000-4000-8000-000000000028','66000000-0000-4000-8000-000000000026','66000000-0000-4000-8000-000000000022',3,3,now()),
    ('66000000-0000-4000-8000-000000000035','66000000-0000-4000-8000-000000000034','66000000-0000-4000-8000-000000000032',1,1,now()),
    ('66000000-0000-4000-8000-000000000045','66000000-0000-4000-8000-000000000044','66000000-0000-4000-8000-000000000042',3,null,null);
end
$p6_concurrency_setup$;

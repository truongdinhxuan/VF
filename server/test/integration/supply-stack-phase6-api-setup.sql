-- LOCAL/DISPOSABLE DATABASE ONLY. Requires the Phase 6 concurrency fixture.
set session_replication_role = replica;
delete from public.stock_transactions where order_id = '67000000-0000-4000-8000-000000000003';
delete from public.order_revisions where order_id = '67000000-0000-4000-8000-000000000003';
delete from public.order_item_allocations where order_item_id = '67000000-0000-4000-8000-000000000004';
delete from public.order_item_allocations where order_item_id = '67000000-0000-4000-8000-000000000007';
delete from public.order_items where order_id = '67000000-0000-4000-8000-000000000003';
delete from public.order_items where order_id = '67000000-0000-4000-8000-000000000006';
delete from public.orders where id = '67000000-0000-4000-8000-000000000003';
delete from public.orders where id = '67000000-0000-4000-8000-000000000006';
delete from public.stock_balances where id = '67000000-0000-4000-8000-000000000002';
delete from public.storage_locations where id = '67000000-0000-4000-8000-000000000001';
set session_replication_role = origin;

delete from public.user_roles where user_id = '67000000-0000-4000-8000-000000000009';
delete from public.users where id = '67000000-0000-4000-8000-000000000009';

do $p6_api_setup$
declare v_supply uuid; v_unit uuid; v_approved uuid; v_packing_role uuid;
begin
  select id, unit_id into strict v_supply, v_unit
  from public.supplies where code='71000860';
  select id into strict v_approved
  from public.order_statuses where code='APPROVED';
  select id into strict v_packing_role
  from public.roles where code='DATA_PACKING';
  insert into public.users(
    id,vinfast_id,email,role_id,area_id,first_name,last_name,
    is_active,is_verified,is_deleted
  ) values(
    '67000000-0000-4000-8000-000000000009',967000009,
    'p6_http_packing@local.test',v_packing_role,
    '66000000-0000-4000-8000-000000000002','P6','No Issue',true,true,false
  );
  insert into public.user_roles(user_id,role_id)
  values('67000000-0000-4000-8000-000000000009',v_packing_role)
  on conflict(user_id,role_id) do update
    set is_active=true,is_deleted=false;
  insert into public.storage_locations(id,code,area_id,name)
  values('67000000-0000-4000-8000-000000000001','P6_API','66000000-0000-4000-8000-000000000001','P6 HTTP location');
  insert into public.stock_balances(
    id,supply_id,provider_id,area_id,storage_location_id,
    quantity,set_per_qty,stack_quantity,total_set_quantity
  ) values(
    '67000000-0000-4000-8000-000000000002',v_supply,
    '66000000-0000-4000-8000-000000000004','66000000-0000-4000-8000-000000000001',
    '67000000-0000-4000-8000-000000000001',63,21,3,63
  );
  insert into public.orders(id,code,from_area_id,to_area_id,requested_by,status_id)
  values(
    '67000000-0000-4000-8000-000000000003','P6_HTTP_ORDER',
    '66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002',
    '66000000-0000-4000-8000-000000000003',v_approved
  );
  insert into public.orders(id,code,from_area_id,to_area_id,requested_by,status_id)
  values(
    '67000000-0000-4000-8000-000000000006','P6_HTTP_NOT_READY',
    '66000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002',
    '66000000-0000-4000-8000-000000000003',v_approved
  );
  insert into public.order_items(
    id,order_id,supply_id,provider_id,unit_id,
    quantity_requested,quantity_approved,quantity_issued,
    set_per_qty,requested_stack_quantity,requested_total_set_quantity
  ) values(
    '67000000-0000-4000-8000-000000000004','67000000-0000-4000-8000-000000000003',v_supply,
    '66000000-0000-4000-8000-000000000004',v_unit,42,42,0,21,2,42
  );
  insert into public.order_item_allocations(
    id,order_item_id,stock_balance_id,expected_stack_quantity,
    actual_stack_quantity,confirmed_at
  ) values(
    '67000000-0000-4000-8000-000000000005','67000000-0000-4000-8000-000000000004',
    '67000000-0000-4000-8000-000000000002',2,2,now()
  );
  insert into public.order_items(
    id,order_id,supply_id,provider_id,unit_id,
    quantity_requested,quantity_approved,quantity_issued,
    set_per_qty,requested_stack_quantity,requested_total_set_quantity
  ) values(
    '67000000-0000-4000-8000-000000000007','67000000-0000-4000-8000-000000000006',v_supply,
    '66000000-0000-4000-8000-000000000004',v_unit,21,21,0,21,1,21
  );
  insert into public.order_item_allocations(
    id,order_item_id,stock_balance_id,expected_stack_quantity,
    actual_stack_quantity,confirmed_at
  ) values(
    '67000000-0000-4000-8000-000000000008','67000000-0000-4000-8000-000000000007',
    '67000000-0000-4000-8000-000000000002',1,null,null
  );
end
$p6_api_setup$;

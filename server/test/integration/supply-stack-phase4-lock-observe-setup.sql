-- Second committed local fixture used only to observe pg_stat_activity lock wait.
do $p4_lock_setup$
declare v_supply uuid; v_unit uuid; v_approved uuid;
begin
  select id,unit_id into strict v_supply,v_unit from public.supplies where code='71000860';
  select id into strict v_approved from public.order_statuses where code='APPROVED';
  insert into public.storage_locations(id,code,area_id,name)
    values('44000000-0000-4000-8000-000000000009','P4CC_LOCATION_2',
      '44000000-0000-4000-8000-000000000001','P4 lock-observe location');
  insert into public.stock_balances(id,supply_id,provider_id,area_id,storage_location_id,
    quantity,set_per_qty,stack_quantity,total_set_quantity)
    values('44000000-0000-4000-8000-000000000010',v_supply,
      '44000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000001',
      '44000000-0000-4000-8000-000000000009',310,31,10,310);
  insert into public.orders(id,code,from_area_id,to_area_id,requested_by,status_id)
    values('44000000-0000-4000-8000-000000000011','P4CC_ORDER_2',
      '44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002',
      '44000000-0000-4000-8000-000000000003',v_approved);
  insert into public.order_items(id,order_id,supply_id,provider_id,unit_id,
    quantity_requested,quantity_approved,quantity_issued,set_per_qty,
    requested_stack_quantity,requested_total_set_quantity)
    values('44000000-0000-4000-8000-000000000012','44000000-0000-4000-8000-000000000011',
      v_supply,'44000000-0000-4000-8000-000000000004',v_unit,155,155,0,31,5,155);
end
$p4_lock_setup$;

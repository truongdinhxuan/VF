-- LOCAL/DISPOSABLE DATABASE ONLY. Fixture for Fastify allocation endpoint tests.
do $p4_api_setup$
declare v_supply uuid; v_unit uuid; v_approved uuid;
begin
  select id,unit_id into strict v_supply,v_unit from public.supplies where code='71000860';
  select id into strict v_approved from public.order_statuses where code='APPROVED';
  insert into public.storage_locations(id,code,area_id,name)
    values('44000000-0000-4000-8000-000000000018','P4CC_API_LOCATION',
      '44000000-0000-4000-8000-000000000001','P4 API location');
  insert into public.stock_balances(id,supply_id,provider_id,area_id,storage_location_id,
    quantity,set_per_qty,stack_quantity,total_set_quantity)
    values('44000000-0000-4000-8000-000000000017',v_supply,
      '44000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000001',
      '44000000-0000-4000-8000-000000000018',320,32,10,320);
  insert into public.orders(id,code,from_area_id,to_area_id,requested_by,status_id)
    values('44000000-0000-4000-8000-000000000015','P4CC_API_ORDER',
      '44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002',
      '44000000-0000-4000-8000-000000000003',v_approved);
  insert into public.order_items(id,order_id,supply_id,provider_id,unit_id,
    quantity_requested,quantity_approved,quantity_issued,set_per_qty,
    requested_stack_quantity,requested_total_set_quantity)
    values('44000000-0000-4000-8000-000000000016','44000000-0000-4000-8000-000000000015',
      v_supply,'44000000-0000-4000-8000-000000000004',v_unit,160,160,0,32,5,160);
end
$p4_api_setup$;

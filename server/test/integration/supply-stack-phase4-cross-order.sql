-- LOCAL/DISPOSABLE DATABASE ONLY. Confirms the documented no-reservation limit.
do $p4_cross_order$
declare v_supply uuid; v_unit uuid; v_approved uuid;
begin
  select id,unit_id into strict v_supply,v_unit from public.supplies where code='71000860';
  select id into strict v_approved from public.order_statuses where code='APPROVED';
  insert into public.orders(id,code,from_area_id,to_area_id,requested_by,status_id)
    values('44000000-0000-4000-8000-000000000013','P4CC_ORDER_3',
      '44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002',
      '44000000-0000-4000-8000-000000000003',v_approved);
  insert into public.order_items(id,order_id,supply_id,provider_id,unit_id,
    quantity_requested,quantity_approved,quantity_issued,set_per_qty,
    requested_stack_quantity,requested_total_set_quantity)
    values('44000000-0000-4000-8000-000000000014','44000000-0000-4000-8000-000000000013',
      v_supply,'44000000-0000-4000-8000-000000000004',v_unit,155,155,0,31,5,155);
  perform public.allocate_stack_order(
    '44000000-0000-4000-8000-000000000013',
    '44000000-0000-4000-8000-000000000003'
  );
end
$p4_cross_order$;

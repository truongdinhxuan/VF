-- LOCAL/DISPOSABLE DATABASE ONLY. Persistent fixture for two-session lock test.
do $p4_concurrency_setup$
declare
  v_supply uuid; v_unit uuid; v_admin_role uuid; v_approved uuid;
begin
  select s.id,s.unit_id into strict v_supply,v_unit from public.supplies s
  join public.supply_categories c on c.id=s.category_id
  where s.code='71000860' and c.code='KIEN_SAT_TC';
  select id into strict v_admin_role from public.roles where code='ADMIN' and is_system;
  select id into strict v_approved from public.order_statuses where code='APPROVED';

  insert into public.areas(id,code,name) values
    ('44000000-0000-4000-8000-000000000001','P4CC_AREA_A','P4 concurrency A'),
    ('44000000-0000-4000-8000-000000000002','P4CC_AREA_B','P4 concurrency B');
  insert into public.users(id,vinfast_id,email,role_id,area_id,first_name,last_name,is_active,is_verified,is_deleted)
    values('44000000-0000-4000-8000-000000000003',940000003,'p4cc_admin@local.test',v_admin_role,
      '44000000-0000-4000-8000-000000000001','P4','Concurrency',true,true,false);
  insert into public.user_roles(user_id,role_id) values('44000000-0000-4000-8000-000000000003',v_admin_role)
    on conflict(user_id,role_id) do update set is_active=true,is_deleted=false;
  insert into public.providers(id,code,name)
    values('44000000-0000-4000-8000-000000000004','P4CC_PROVIDER','P4 concurrency provider');
  insert into public.supply_providers(supply_id,provider_id)
    values(v_supply,'44000000-0000-4000-8000-000000000004');
  insert into public.storage_locations(id,code,area_id,name)
    values('44000000-0000-4000-8000-000000000005','P4CC_LOCATION',
      '44000000-0000-4000-8000-000000000001','P4 concurrency location');
  insert into public.stock_balances(id,supply_id,provider_id,area_id,storage_location_id,
    quantity,set_per_qty,stack_quantity,total_set_quantity)
    values('44000000-0000-4000-8000-000000000006',v_supply,
      '44000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000001',
      '44000000-0000-4000-8000-000000000005',300,30,10,300);
  insert into public.orders(id,code,from_area_id,to_area_id,requested_by,status_id)
    values('44000000-0000-4000-8000-000000000007','P4CC_ORDER',
      '44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002',
      '44000000-0000-4000-8000-000000000003',v_approved);
  insert into public.order_items(id,order_id,supply_id,provider_id,unit_id,
    quantity_requested,quantity_approved,quantity_issued,set_per_qty,
    requested_stack_quantity,requested_total_set_quantity)
    values('44000000-0000-4000-8000-000000000008','44000000-0000-4000-8000-000000000007',
      v_supply,'44000000-0000-4000-8000-000000000004',v_unit,150,150,0,30,5,150);
end
$p4_concurrency_setup$;

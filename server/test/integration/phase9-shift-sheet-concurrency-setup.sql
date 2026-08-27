\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

do $$
declare
  v_leader uuid := '69100000-0000-4000-8000-000000000001';
  v_data1 uuid := '69100000-0000-4000-8000-000000000002';
  v_data2 uuid := '69100000-0000-4000-8000-000000000003';
  v_role uuid;
  v_source uuid;
  v_target uuid;
  v_shift uuid;
  v_unit uuid;
  v_category uuid;
  v_provider uuid := '69100000-0000-4000-8000-000000000010';
  v_supply uuid := '69100000-0000-4000-8000-000000000011';
  v_location uuid := '69100000-0000-4000-8000-000000000012';
  v_status uuid;
begin
  delete from public.order_items where order_id in (
    '69100000-0000-4000-8000-000000000021',
    '69100000-0000-4000-8000-000000000022'
  );
  delete from public.orders where id in (
    '69100000-0000-4000-8000-000000000021',
    '69100000-0000-4000-8000-000000000022'
  );
  delete from public.user_work_shift_assignments where user_id in (v_data1, v_data2);
  delete from public.user_roles where user_id in (v_data1, v_data2);
  delete from public.users where id in (v_data1, v_data2, v_leader);
  delete from public.stock_balances where supply_id = v_supply;
  delete from public.supply_providers where supply_id = v_supply;
  delete from public.supplies where id = v_supply;
  delete from public.storage_locations where id = v_location;
  delete from public.providers where id = v_provider;
  delete from public.supply_shift_order_sheets
  where area_id = (select id from public.areas where code = 'EDC_LOGISTICS')
    and work_date = date '2026-09-01';

  select id into strict v_role from public.roles where code = 'DATA_PACKING';
  insert into public.areas(code, name, is_active, is_deleted)
  values ('VTDG', 'Vật tư đóng gói', true, false)
  on conflict (code) do update set is_active = true, is_deleted = false
  returning id into v_source;
  select id into strict v_target from public.areas where code = 'EDC_LOGISTICS';
  select id into strict v_shift from public.work_shifts where code = 'S1';
  select id into strict v_unit from public.units where code = 'SET';
  select id into strict v_status from public.order_statuses where code = 'DRAFT';

  insert into public.supply_categories(code, name, is_active, is_deleted)
  values ('P9_CONC_NORMAL', 'P9 concurrency normal', true, false)
  on conflict (code) do update set is_active = true, is_deleted = false
  returning id into v_category;

  insert into public.providers(id, code, name, is_active, is_deleted)
  values (v_provider, 'P9_CONC_PROVIDER', 'P9 concurrency provider', true, false);
  insert into public.supplies(
    id, code, short_text, category_id, unit_id, is_active, is_deleted
  ) values (
    v_supply, 'P9_CONC_SUPPLY', 'P9 concurrency supply',
    v_category, v_unit, true, false
  );
  insert into public.supply_providers(supply_id, provider_id, is_active, is_deleted)
  values (v_supply, v_provider, true, false);
  insert into public.storage_locations(id, code, area_id, name, is_active, is_deleted)
  values (v_location, 'P9_CONC_LOC', v_source, 'P9 concurrency location', true, false);
  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id,
    quantity, is_active, is_deleted
  ) values (v_supply, v_provider, v_source, v_location, 1, true, false);

  insert into public.users(
    id, vinfast_id, email, role_id, area_id, managed_by_user_id,
    is_active, is_verified, is_deleted, first_name, last_name
  ) values
    (v_leader, 949100001, 'p9-conc-leader@local.test', v_role, v_target, null,
      true, true, false, 'P9', 'Leader'),
    (v_data1, 949100002, 'p9-conc-data1@local.test', v_role, v_target, v_leader,
      true, true, false, 'P9', 'Data1'),
    (v_data2, 949100003, 'p9-conc-data2@local.test', v_role, v_target, v_leader,
      true, true, false, 'P9', 'Data2');
  insert into public.user_roles(user_id, role_id, is_active, is_deleted)
  values (v_data1, v_role, true, false), (v_data2, v_role, true, false)
  on conflict (user_id, role_id) do update set is_active = true, is_deleted = false;
  insert into public.user_work_shift_assignments(
    user_id, work_shift_id, effective_from, assigned_by, is_active, is_deleted
  ) values
    (v_data1, v_shift, '2026-08-01T00:00:00Z', v_leader, true, false),
    (v_data2, v_shift, '2026-08-01T00:00:00Z', v_leader, true, false);

  insert into public.orders(
    id, code, from_area_id, to_area_id, requested_by, status_id,
    is_active, is_deleted
  ) values
    ('69100000-0000-4000-8000-000000000021', 'P9-CONCURRENT-A', v_source, v_target, v_data1, v_status, true, false),
    ('69100000-0000-4000-8000-000000000022', 'P9-CONCURRENT-B', v_source, v_target, v_data2, v_status, true, false);
  insert into public.order_items(
    order_id, supply_id, provider_id, unit_id, quantity_requested,
    quantity_approved, quantity_issued, is_active, is_deleted
  ) values
    ('69100000-0000-4000-8000-000000000021', v_supply, v_provider, v_unit, 1, 0, 0, true, false),
    ('69100000-0000-4000-8000-000000000022', v_supply, v_provider, v_unit, 1, 0, 0, true, false);
end;
$$;

commit;

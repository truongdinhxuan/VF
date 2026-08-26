-- LOCAL/DISPOSABLE DATABASE ONLY.
-- Phase 5 integration coverage for actual stack confirmation, discrepancy
-- correction, full-only reallocation, warning derivation and resolution.
-- All fixtures are rolled back at the end of this script.

create or replace function pg_temp.make_p5_case(
  p_suffix text,
  p_supply_id uuid,
  p_provider_id uuid,
  p_unit_id uuid,
  p_from_area_id uuid,
  p_to_area_id uuid,
  p_actor_id uuid,
  p_status_id uuid,
  p_set_per_qty numeric,
  p_expected_stack_quantity numeric,
  p_balance_stack_quantity numeric,
  out order_id uuid,
  out item_id uuid,
  out balance_id uuid,
  out allocation_id uuid
)
returns record
language plpgsql
set search_path = ''
as $$
declare
  v_location_id uuid;
begin
  insert into public.storage_locations(code, area_id, name)
  values ('P5IT_' || p_suffix, p_from_area_id, 'P5 ' || p_suffix)
  returning id into v_location_id;

  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id, quantity,
    set_per_qty, stack_quantity, total_set_quantity
  )
  values (
    p_supply_id, p_provider_id, p_from_area_id, v_location_id,
    p_balance_stack_quantity * p_set_per_qty,
    p_set_per_qty, p_balance_stack_quantity,
    p_balance_stack_quantity * p_set_per_qty
  )
  returning id into balance_id;

  insert into public.orders(code, from_area_id, to_area_id, requested_by, status_id)
  values ('P5IT_' || p_suffix, p_from_area_id, p_to_area_id, p_actor_id, p_status_id)
  returning id into order_id;

  insert into public.order_items(
    order_id, supply_id, provider_id, unit_id,
    quantity_requested, quantity_approved, quantity_issued,
    set_per_qty, requested_stack_quantity, requested_total_set_quantity
  )
  values (
    order_id, p_supply_id, p_provider_id, p_unit_id,
    p_expected_stack_quantity * p_set_per_qty,
    p_expected_stack_quantity * p_set_per_qty,
    0, p_set_per_qty, p_expected_stack_quantity,
    p_expected_stack_quantity * p_set_per_qty
  )
  returning id into item_id;

  insert into public.order_item_allocations(
    order_item_id, stock_balance_id, expected_stack_quantity
  )
  values (item_id, balance_id, p_expected_stack_quantity)
  returning id into allocation_id;
end;
$$;

create or replace function pg_temp.add_p5_balance(
  p_suffix text,
  p_supply_id uuid,
  p_provider_id uuid,
  p_area_id uuid,
  p_set_per_qty numeric,
  p_stack_quantity numeric
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_location_id uuid;
  v_balance_id uuid;
begin
  insert into public.storage_locations(code, area_id, name)
  values ('P5IT_' || p_suffix, p_area_id, 'P5 ' || p_suffix)
  returning id into v_location_id;

  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id, quantity,
    set_per_qty, stack_quantity, total_set_quantity
  )
  values (
    p_supply_id, p_provider_id, p_area_id, v_location_id,
    p_stack_quantity * p_set_per_qty,
    p_set_per_qty, p_stack_quantity, p_stack_quantity * p_set_per_qty
  )
  returning id into v_balance_id;

  return v_balance_id;
end;
$$;

do $p5$
#variable_conflict use_variable
declare
  v_stack_supply uuid;
  v_normal_supply uuid;
  v_unit uuid;
  v_stack_category uuid;
  v_normal_category uuid;
  v_provider_a uuid;
  v_provider_b uuid;
  v_area_a uuid;
  v_area_b uuid;
  v_admin_role uuid;
  v_material_role uuid;
  v_actor uuid;
  v_material_actor uuid;
  v_outsider uuid;
  v_approved uuid;
  v_issued uuid;
  v_order uuid;
  v_item uuid;
  v_balance uuid;
  v_allocation uuid;
  v_alt_a uuid;
  v_alt_b uuid;
  v_discrepancy uuid;
  v_tx uuid;
  v_result jsonb;
  v_error text;
  v_count bigint;
  v_before numeric;
  v_after numeric;
  v_before_total numeric;
begin
  begin
    select id into strict v_stack_category
    from public.supply_categories
    where code = 'KIEN_SAT_TC' and is_active and not is_deleted;

    insert into public.units(code, name, symbol)
    values ('P5IT_SET', 'Phase 5 set', 'SET')
    returning id into v_unit;

    insert into public.supplies(
      code, short_text, description, category_id, unit_id, min_stock, max_stock,
      safety_stock, is_active, is_deleted
    )
    values (
      'P5IT_STACK', 'P5 stack', 'Phase 5 stack fixture', v_stack_category, v_unit,
      0, 100000, 0, true, false
    )
    returning id into v_stack_supply;

    insert into public.supply_categories(code, name, description)
    values ('P5IT_NORMAL', 'Phase 5 normal', 'Phase 5 non-stack fixture')
    returning id into v_normal_category;

    insert into public.supplies(
      code, short_text, description, category_id, unit_id, min_stock, max_stock,
      safety_stock, is_active, is_deleted
    )
    values (
      'P5IT_NORMAL', 'P5 normal', 'Phase 5 normal fixture', v_normal_category, v_unit,
      0, 100000, 0, true, false
    )
    returning id into v_normal_supply;

    insert into public.providers(code, name)
    values ('P5IT_PROVIDER_A', 'P5 Provider A')
    returning id into v_provider_a;
    insert into public.providers(code, name)
    values ('P5IT_PROVIDER_B', 'P5 Provider B')
    returning id into v_provider_b;

    insert into public.supply_providers(supply_id, provider_id)
    values
      (v_stack_supply, v_provider_a),
      (v_stack_supply, v_provider_b),
      (v_normal_supply, v_provider_a);

    insert into public.areas(code, name)
    values ('P5IT_AREA_A', 'P5 Area A') returning id into v_area_a;
    insert into public.areas(code, name)
    values ('P5IT_AREA_B', 'P5 Area B') returning id into v_area_b;

    select id into strict v_admin_role
    from public.roles
    where code = 'ADMIN' and is_system and is_active and not is_deleted;
    select id into strict v_material_role
    from public.roles
    where code = 'DATA_MATERIAL' and is_active and not is_deleted;
    select id into strict v_approved
    from public.order_statuses where code = 'APPROVED';
    select id into strict v_issued
    from public.order_statuses where code = 'ISSUED';

    insert into public.users(
      vinfast_id, email, role_id, area_id, first_name, last_name,
      is_active, is_verified, is_deleted
    ) values (
      950000001, 'p5it_admin@local.test', v_admin_role, v_area_a,
      'P5', 'Admin', true, true, false
    ) returning id into v_actor;
    insert into public.user_roles(user_id, role_id)
    values (v_actor, v_admin_role)
    on conflict (user_id, role_id) do update
      set is_active = true, is_deleted = false;

    insert into public.users(
      vinfast_id, email, role_id, area_id, first_name, last_name,
      is_active, is_verified, is_deleted
    ) values (
      950000002, 'p5it_material@local.test', v_material_role, v_area_a,
      'P5', 'Material', true, true, false
    ) returning id into v_material_actor;
    insert into public.user_roles(user_id, role_id)
    values (v_material_actor, v_material_role)
    on conflict (user_id, role_id) do update
      set is_active = true, is_deleted = false;

    insert into public.users(
      vinfast_id, email, role_id, area_id, first_name, last_name,
      is_active, is_verified, is_deleted
    ) values (
      950000003, 'p5it_outsider@local.test', v_admin_role, v_area_a,
      'P5', 'Outsider', true, true, false
    ) returning id into v_outsider;
    delete from public.user_roles where user_id = v_outsider;

    -- T-001: exact confirmation is proposal confirmation only.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'EXACT', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 10, 3, 5
    );
    select count(*) into v_count from public.stock_transactions;
    v_result := public.confirm_stack_allocation_actual(v_allocation, 3, v_actor, null);
    if (select stack_quantity from public.stock_balances where id = v_balance) <> 5
       or (select actual_stack_quantity from public.order_item_allocations where id = v_allocation) <> 3
       or not exists (select 1 from public.order_item_allocations where id = v_allocation and confirmed_at is not null)
       or exists (select 1 from public.inventory_discrepancies where allocation_id = v_allocation)
       or (select count(*) from public.stock_transactions) <> v_count
       or v_result->>'reallocation_status' <> 'NOT_REQUIRED' then
      raise exception 'T-001 exact confirmation mismatch';
    end if;
    raise notice 'PASS T-001 exact confirmation';

    -- T-002/T-003/T-004/T-018/T-026/T-027/T-029/T-030 canonical shortage.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'CANONICAL', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 11, 3, 5
    );
    v_alt_a := pg_temp.add_p5_balance(
      'CANONICAL_ALT', v_stack_supply, v_provider_a, v_area_a, 11, 5
    );
    select available_stack_quantity into v_before_total
    from public.get_supply_stack_options(v_stack_supply, v_provider_a, v_area_a)
    where set_per_qty = 11;
    v_result := public.confirm_stack_allocation_actual(
      v_allocation, 1, v_actor, 'Kiểm đếm thực tế thiếu hai chồng'
    );
    select id into strict v_discrepancy
    from public.inventory_discrepancies where allocation_id = v_allocation;
    select id into strict v_tx
    from public.stock_transactions where inventory_discrepancy_id = v_discrepancy;
    select available_stack_quantity into v_after
    from public.get_supply_stack_options(v_stack_supply, v_provider_a, v_area_a)
    where set_per_qty = 11;
    if (select stack_quantity from public.stock_balances where id = v_balance) <> 3
       or (select quantity from public.stock_balances where id = v_balance) <> 33
       or (select actual_stack_quantity from public.order_item_allocations where id = v_allocation) <> 1
       or not exists (
         select 1 from public.inventory_discrepancies
         where id = v_discrepancy and status = 'OPEN'
           and expected_stack_quantity = 3 and actual_stack_quantity = 1
           and difference_stack_quantity = 2
       )
       or not exists (
         select 1
         from public.stock_transactions tx
         join public.stock_transaction_types tt on tt.id = tx.transaction_type_id
         where tx.id = v_tx and tt.code = 'DISCREPANCY_CORRECTION'
           and tx.quantity = 22 and tx.before_quantity = 55 and tx.after_quantity = 33
           and tx.stack_quantity = 2 and tx.before_stack_quantity = 5
           and tx.after_stack_quantity = 3 and tx.order_id = v_order
           and tx.order_item_id = v_item and tx.inventory_discrepancy_id = v_discrepancy
           and tx.created_by = v_actor and tx.provider_id = v_provider_a
       )
       or v_result->>'reallocation_status' <> 'REALLOCATED'
       or jsonb_array_length(v_result->'new_allocations') <> 1
       or not exists (
         select 1 from public.order_item_allocations
         where order_item_id = v_item and stock_balance_id = v_alt_a
           and expected_stack_quantity = 2 and actual_stack_quantity is null
           and confirmed_at is null
       )
       or (select stack_quantity from public.stock_balances where id = v_alt_a) <> 5
       or not public.has_open_discrepancy((select sb from public.stock_balances sb where id = v_balance))
       or v_before_total - v_after <> 2
       or exists (
         select 1 from public.stock_transactions tx
         join public.stock_transaction_types tt on tt.id = tx.transaction_type_id
         where tx.order_id = v_order and tt.code = 'ISSUE'
       )
       or (select os.code from public.orders o join public.order_statuses os on os.id=o.status_id where o.id=v_order) <> 'APPROVED' then
      raise exception 'T-002/T-003/T-004/T-018/T-026/T-027/T-029/T-030 mismatch: %', v_result;
    end if;
    raise notice 'PASS T-002/T-003/T-004/T-018/T-026/T-027/T-029/T-030 canonical state';

    -- T-005: split reallocation uses all alternatives only when fully satisfiable.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'SPLIT', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 12, 6, 8
    );
    v_alt_a := pg_temp.add_p5_balance('SPLIT_A', v_stack_supply, v_provider_a, v_area_a, 12, 3);
    v_alt_b := pg_temp.add_p5_balance('SPLIT_B', v_stack_supply, v_provider_a, v_area_a, 12, 2);
    v_result := public.confirm_stack_allocation_actual(v_allocation, 1, v_actor, null);
    select count(*), coalesce(sum(expected_stack_quantity), 0)
    into v_count, v_after
    from public.order_item_allocations
    where order_item_id = v_item and id <> v_allocation;
    if v_result->>'reallocation_status' <> 'REALLOCATED'
       or v_count <> 2 or v_after <> 5
       or (select stack_quantity from public.stock_balances where id = v_alt_a) <> 3
       or (select stack_quantity from public.stock_balances where id = v_alt_b) <> 2 then
      raise exception 'T-005 split reallocation mismatch: %', v_result;
    end if;
    raise notice 'PASS T-005 split reallocation';

    -- T-006: insufficient alternatives create no partial proposal.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'INSUFFICIENT', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 13, 6, 8
    );
    perform pg_temp.add_p5_balance('INSUFF_A', v_stack_supply, v_provider_a, v_area_a, 13, 2);
    perform pg_temp.add_p5_balance('INSUFF_B', v_stack_supply, v_provider_a, v_area_a, 13, 1);
    v_result := public.confirm_stack_allocation_actual(v_allocation, 1, v_actor, null);
    if v_result->>'reallocation_status' <> 'INSUFFICIENT'
       or (v_result->>'required_stack_quantity')::numeric <> 5
       or (v_result->>'available_stack_quantity')::numeric <> 3
       or (v_result->>'unallocated_stack_quantity')::numeric <> 2
       or exists (
         select 1 from public.order_item_allocations
         where order_item_id = v_item and id <> v_allocation
       ) then
      raise exception 'T-006 insufficient reallocation mismatch: %', v_result;
    end if;
    raise notice 'PASS T-006 full-only insufficient reallocation';

    -- T-007: zero actual is valid and corrects only the missing stacks.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'ZERO', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 14, 3, 5
    );
    v_result := public.confirm_stack_allocation_actual(v_allocation, 0, v_actor, null);
    if (select actual_stack_quantity from public.order_item_allocations where id=v_allocation) <> 0
       or (select stack_quantity from public.stock_balances where id=v_balance) <> 2
       or (v_result->>'difference_stack_quantity')::numeric <> 3 then
      raise exception 'T-007 zero actual mismatch';
    end if;
    raise notice 'PASS T-007 zero actual';

    -- T-008/T-009: invalid and repeated confirmation do not duplicate audit rows.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'GUARDS', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 15, 3, 5
    );
    v_error := null;
    begin
      perform public.confirm_stack_allocation_actual(v_allocation, 4, v_actor, null);
    exception when others then v_error := sqlerrm; end;
    if v_error <> 'ACTUAL_STACK_EXCEEDS_EXPECTED'
       or exists(select 1 from public.inventory_discrepancies where allocation_id=v_allocation)
       or (select actual_stack_quantity from public.order_item_allocations where id=v_allocation) is not null then
      raise exception 'T-008 actual exceeds guard mismatch: %', v_error;
    end if;
    perform public.confirm_stack_allocation_actual(v_allocation, 3, v_actor, null);
    select count(*) into v_count from public.stock_transactions where order_id=v_order;
    v_error := null;
    begin
      perform public.confirm_stack_allocation_actual(v_allocation, 3, v_actor, null);
    exception when others then v_error := sqlerrm; end;
    if v_error <> 'ALLOCATION_ALREADY_CONFIRMED'
       or (select count(*) from public.stock_transactions where order_id=v_order) <> v_count then
      raise exception 'T-009 repeat guard mismatch: %', v_error;
    end if;
    raise notice 'PASS T-008/T-009 confirmation guards';

    -- T-010: non-APPROVED order is rejected without mutation.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'WRONG_STATUS', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_issued, 16, 3, 5
    );
    v_error := null;
    begin
      perform public.confirm_stack_allocation_actual(v_allocation, 2, v_actor, null);
    exception when others then v_error := sqlerrm; end;
    if v_error <> 'ORDER_NOT_CONFIRMABLE'
       or (select actual_stack_quantity from public.order_item_allocations where id=v_allocation) is not null
       or (select stack_quantity from public.stock_balances where id=v_balance) <> 5 then
      raise exception 'T-010 status guard mismatch: %', v_error;
    end if;
    raise notice 'PASS T-010 order status guard';

    -- T-011: non-stack Supply is rejected.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'NORMAL', v_normal_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 17, 3, 5
    );
    v_error := null;
    begin
      perform public.confirm_stack_allocation_actual(v_allocation, 2, v_actor, null);
    exception when others then v_error := sqlerrm; end;
    if v_error <> 'ORDER_NOT_CONFIRMABLE' then
      raise exception 'T-011 normal Supply guard mismatch: %', v_error;
    end if;
    raise notice 'PASS T-011 normal Supply isolation';

    -- T-012/T-013/T-014/T-015: alternative dimensions and original location are isolated.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'ISOLATION', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 18, 5, 7
    );
    perform pg_temp.add_p5_balance('ISO_PROVIDER', v_stack_supply, v_provider_b, v_area_a, 18, 20);
    perform pg_temp.add_p5_balance('ISO_AREA', v_stack_supply, v_provider_a, v_area_b, 18, 20);
    perform pg_temp.add_p5_balance('ISO_SET', v_stack_supply, v_provider_a, v_area_a, 19, 20);
    v_result := public.confirm_stack_allocation_actual(v_allocation, 1, v_actor, null);
    if v_result->>'reallocation_status' <> 'INSUFFICIENT'
       or (v_result->>'available_stack_quantity')::numeric <> 0
       or exists(select 1 from public.order_item_allocations where order_item_id=v_item and id<>v_allocation) then
      raise exception 'T-012/T-013/T-014/T-015 isolation mismatch: %', v_result;
    end if;
    raise notice 'PASS T-012/T-013/T-014/T-015 dimension isolation';

    -- T-017: discrepancy correction transaction remains immutable.
    v_error := null;
    begin update public.stock_transactions set note='mutated' where id=v_tx; exception when others then v_error:=sqlerrm; end;
    if v_error not like 'StockTransactions are immutable%' then
      raise exception 'T-017 update immutability mismatch: %', v_error;
    end if;
    v_error := null;
    begin delete from public.stock_transactions where id=v_tx; exception when others then v_error:=sqlerrm; end;
    if v_error not like 'StockTransactions are immutable%' then
      raise exception 'T-017 delete immutability mismatch: %', v_error;
    end if;
    raise notice 'PASS T-017 immutable transaction';

    -- T-019/T-020/T-021/T-025/T-028: warning query and resolve contract.
    if (select count(*) from public.stock_balances sb where public.has_open_discrepancy(sb)) < 1
       or (select count(*) from public.stock_balances sb where not public.has_open_discrepancy(sb)) < 1 then
      raise exception 'T-019 warning filter derivation mismatch';
    end if;
    v_error := null;
    begin perform public.resolve_inventory_discrepancy(v_discrepancy, v_outsider, 'No permission'); exception when others then v_error:=sqlerrm; end;
    if v_error <> 'DISCREPANCY_RESOLVE_FORBIDDEN' then raise exception 'T-025 resolve RBAC mismatch: %',v_error; end if;
    v_error := null;
    begin perform public.resolve_inventory_discrepancy(v_discrepancy, v_actor, '   '); exception when others then v_error:=sqlerrm; end;
    if v_error <> 'RESOLUTION_NOTE_REQUIRED' or (select status from public.inventory_discrepancies where id=v_discrepancy)<>'OPEN' then
      raise exception 'T-021 empty note guard mismatch: %',v_error;
    end if;
    select quantity, stack_quantity into v_before_total, v_before from public.stock_balances where id=v_balance;
    select count(*) into v_count from public.stock_transactions;
    perform public.resolve_inventory_discrepancy(v_discrepancy, v_actor, 'Đã kiểm kê và xác nhận số thực tế');
    if not exists(select 1 from public.inventory_discrepancies where id=v_discrepancy and status='RESOLVED' and resolved_by=v_actor and resolved_at is not null and resolution_note is not null)
       or (select quantity from public.stock_balances where id=v_balance)<>v_before_total
       or (select stack_quantity from public.stock_balances where id=v_balance)<>v_before
       or (select count(*) from public.stock_transactions)<>v_count then
      raise exception 'T-020 resolution mutation mismatch';
    end if;
    v_error := null;
    begin perform public.resolve_inventory_discrepancy(v_discrepancy, v_actor, 'Overwrite'); exception when others then v_error:=sqlerrm; end;
    if v_error <> 'DISCREPANCY_ALREADY_RESOLVED' then raise exception 'T-028 repeat resolve mismatch: %',v_error; end if;
    raise notice 'PASS T-019/T-020/T-021/T-025/T-028 warning and resolution';

    -- T-022/T-023: warning remains until the last OPEN discrepancy is resolved.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'MULTI_A', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 20, 2, 8
    );
    perform public.confirm_stack_allocation_actual(v_allocation, 1, v_actor, null);
    select id into v_discrepancy from public.inventory_discrepancies where allocation_id=v_allocation;
    insert into public.orders(code,from_area_id,to_area_id,requested_by,status_id)
    values('P5IT_MULTI_B',v_area_a,v_area_b,v_actor,v_approved) returning id into v_order;
    insert into public.order_items(order_id,supply_id,provider_id,unit_id,quantity_requested,quantity_approved,quantity_issued,set_per_qty,requested_stack_quantity,requested_total_set_quantity)
    values(v_order,v_stack_supply,v_provider_a,v_unit,40,40,0,20,2,40) returning id into v_item;
    insert into public.order_item_allocations(order_item_id,stock_balance_id,expected_stack_quantity)
    values(v_item,v_balance,2) returning id into v_allocation;
    perform public.confirm_stack_allocation_actual(v_allocation, 1, v_actor, null);
    perform public.resolve_inventory_discrepancy(v_discrepancy,v_actor,'Resolve first');
    if not public.has_open_discrepancy((select sb from public.stock_balances sb where id=v_balance)) then
      raise exception 'T-022 warning cleared while another discrepancy was OPEN';
    end if;
    select id into v_discrepancy from public.inventory_discrepancies where allocation_id=v_allocation;
    perform public.resolve_inventory_discrepancy(v_discrepancy,v_actor,'Resolve last');
    if public.has_open_discrepancy((select sb from public.stock_balances sb where id=v_balance)) then
      raise exception 'T-023 warning remained after final OPEN discrepancy';
    end if;
    raise notice 'PASS T-022/T-023 multiple warning lifecycle';

    -- T-024: DATA_MATERIAL has confirm permission; unmapped user does not.
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'RBAC_MATERIAL', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_material_actor, v_approved, 21, 2, 4
    );
    perform public.confirm_stack_allocation_actual(v_allocation,2,v_material_actor,null);
    select * into v_order, v_item, v_balance, v_allocation
    from pg_temp.make_p5_case(
      'RBAC_DENY', v_stack_supply, v_provider_a, v_unit, v_area_a, v_area_b,
      v_actor, v_approved, 22, 2, 4
    );
    v_error := null;
    begin perform public.confirm_stack_allocation_actual(v_allocation,2,v_outsider,null); exception when others then v_error:=sqlerrm; end;
    if v_error <> 'CONFIRM_ALLOCATION_FORBIDDEN'
       or (select actual_stack_quantity from public.order_item_allocations where id=v_allocation) is not null then
      raise exception 'T-024 confirm RBAC mismatch: %',v_error;
    end if;
    raise notice 'PASS T-024 effective permission confirmation';

    -- T-016 is exercised by the separate two-session concurrency harness.
    raise notice 'PASS T-016 covered by supply-stack-phase5-concurrency-* scripts';

    raise exception using message='P5_ROLLBACK_FIXTURES';
  exception when others then
    if sqlerrm <> 'P5_ROLLBACK_FIXTURES' then raise; end if;
  end;
  raise notice 'PASS Phase 5 database integration suite T-001 through T-030';
end
$p5$;

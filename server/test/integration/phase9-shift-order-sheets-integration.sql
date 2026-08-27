\set ON_ERROR_STOP on

begin;

do $$
declare
  v_leader uuid := '69000000-0000-4000-8000-000000000001';
  v_data1 uuid := '69000000-0000-4000-8000-000000000002';
  v_data2 uuid := '69000000-0000-4000-8000-000000000003';
  v_data_s3 uuid := '69000000-0000-4000-8000-000000000004';
  v_data_s7 uuid := '69000000-0000-4000-8000-000000000005';
  v_packing_role uuid;
  v_area_source uuid;
  v_area_target uuid;
  v_s1 uuid;
  v_s3 uuid;
  v_s7 uuid;
  v_unit uuid;
  v_normal_category uuid;
  v_stack_category uuid;
  v_provider uuid;
  v_normal_supply uuid;
  v_stack_supply uuid;
  v_location uuid;
  v_normal_balance uuid;
  v_stack_11_balance uuid;
  v_stack_8_balance uuid;
  v_draft_status uuid;
  v_order1 uuid;
  v_order2 uuid;
  v_create_more_order uuid;
  v_invalid_context_order uuid;
  v_stack_positive_order uuid;
  v_zero_order uuid;
  v_stack_zero_order uuid;
  v_sheet uuid;
  v_invalid_sheet uuid;
  v_sheet_count integer;
  v_before_quantity numeric;
  v_before_transactions integer;
  v_resolved record;
begin
  select id into strict v_packing_role from public.roles where code = 'DATA_PACKING';
  insert into public.areas(code, name, is_active, is_deleted)
  values ('VTDG', 'Vật tư đóng gói', true, false)
  on conflict (code) do update
  set is_active = true, is_deleted = false
  returning id into v_area_source;
  select id into strict v_area_target from public.areas where code = 'EDC_LOGISTICS';
  select id into strict v_s1 from public.work_shifts where code = 'S1';
  select id into strict v_s3 from public.work_shifts where code = 'S3';
  select id into strict v_s7 from public.work_shifts where code = 'S7';
  select id into strict v_unit from public.units where code = 'SET';
  select id into strict v_stack_category from public.supply_categories where code = 'KIEN_SAT_TC';
  select id into strict v_draft_status from public.order_statuses where code = 'DRAFT';

  insert into public.users(
    id, vinfast_id, email, role_id, area_id, managed_by_user_id,
    is_active, is_verified, is_deleted, first_name, last_name
  ) values
    (v_leader, 949000001, 'p9-leader@local.test', v_packing_role, v_area_target, null,
      true, true, false, 'Phase9', 'Leader'),
    (v_data1, 949000002, 'p9-data1@local.test', v_packing_role, v_area_target, v_leader,
      true, true, false, 'Phase9', 'Data1'),
    (v_data2, 949000003, 'p9-data2@local.test', v_packing_role, v_area_target, v_leader,
      true, true, false, 'Phase9', 'Data2'),
    (v_data_s3, 949000004, 'p9-s3@local.test', v_packing_role, v_area_target, v_leader,
      true, true, false, 'Phase9', 'S3'),
    (v_data_s7, 949000005, 'p9-s7@local.test', v_packing_role, v_area_target, v_leader,
      true, true, false, 'Phase9', 'S7');

  insert into public.user_roles(user_id, role_id, is_active, is_deleted)
  values
    (v_data1, v_packing_role, true, false),
    (v_data2, v_packing_role, true, false),
    (v_data_s3, v_packing_role, true, false),
    (v_data_s7, v_packing_role, true, false)
  on conflict (user_id, role_id) do update
  set is_active = true, is_deleted = false;

  insert into public.user_work_shift_assignments(
    user_id, work_shift_id, effective_from, assigned_by, is_active, is_deleted
  ) values
    (v_data1, v_s1, '2026-08-01 00:00:00+00', v_leader, true, false),
    (v_data2, v_s1, '2026-08-01 00:00:00+00', v_leader, true, false),
    (v_data_s3, v_s3, '2026-08-01 00:00:00+00', v_leader, true, false),
    (v_data_s7, v_s7, '2026-08-01 00:00:00+00', v_leader, true, false);

  insert into public.supply_categories(code, name, description, is_active, is_deleted)
  values ('P9_NORMAL', 'Phase 9 normal', 'Local test only', true, false)
  returning id into v_normal_category;

  insert into public.providers(code, name, description, is_active, is_deleted)
  values ('P9_PROVIDER', 'Phase 9 Provider', 'Local test only', true, false)
  returning id into v_provider;

  insert into public.supplies(
    code, short_text, description, category_id, unit_id, is_active, is_deleted
  ) values
    ('P9_NORMAL_SUPPLY', 'Phase 9 normal', 'Local test', v_normal_category, v_unit, true, false)
  returning id into v_normal_supply;

  insert into public.supplies(
    code, short_text, description, category_id, unit_id, is_active, is_deleted
  ) values
    ('P9_STACK_SUPPLY', 'Phase 9 stack', 'Local test', v_stack_category, v_unit, true, false)
  returning id into v_stack_supply;

  insert into public.supply_providers(supply_id, provider_id, is_active, is_deleted)
  values
    (v_normal_supply, v_provider, true, false),
    (v_stack_supply, v_provider, true, false);

  insert into public.storage_locations(code, area_id, name, is_active, is_deleted)
  values ('P9_LOC', v_area_source, 'Phase 9 location', true, false)
  returning id into v_location;

  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id,
    quantity, is_active, is_deleted
  ) values (
    v_normal_supply, v_provider, v_area_source, v_location,
    1, true, false
  ) returning id into v_normal_balance;

  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id,
    quantity, set_per_qty, stack_quantity, total_set_quantity,
    is_active, is_deleted
  ) values
    (v_stack_supply, v_provider, v_area_source, v_location,
      11, 11, 1, 11, true, false)
  returning id into v_stack_11_balance;

  insert into public.storage_locations(code, area_id, name, is_active, is_deleted)
  values ('P9_LOC_8', v_area_source, 'Phase 9 location 8', true, false)
  returning id into v_location;

  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id,
    quantity, set_per_qty, stack_quantity, total_set_quantity,
    is_active, is_deleted
  ) values
    (v_stack_supply, v_provider, v_area_source, v_location,
      160, 8, 20, 160, true, false)
  returning id into v_stack_8_balance;

  -- P9-012/P9-013: explicit business timezone, independent of session timezone.
  set local timezone = 'UTC';
  select * into v_resolved
  from public.resolve_user_work_shift_instance(v_data1, '2026-08-26T23:00:00Z');
  if v_resolved.work_date <> date '2026-08-27'
     or v_resolved.shift_start_at <> '2026-08-26T23:00:00Z'::timestamptz then
    raise exception 'P9-012/P9-013 UTC to local resolver failed: %', row_to_json(v_resolved);
  end if;

  select * into v_resolved
  from public.resolve_user_work_shift_instance(v_data1, '2026-08-26T08:00:00Z');
  if v_resolved.work_date <> date '2026-08-26' or not v_resolved.is_overtime then
    raise exception 'P9-009 S1 overtime failed: %', row_to_json(v_resolved);
  end if;

  select * into v_resolved
  from public.resolve_user_work_shift_instance(v_data_s3, '2026-08-26T19:00:00Z');
  if v_resolved.work_date <> date '2026-08-26' or v_resolved.is_overtime then
    raise exception 'P9-007 S3 cross-midnight failed: %', row_to_json(v_resolved);
  end if;

  select * into v_resolved
  from public.resolve_user_work_shift_instance(v_data_s7, '2026-08-26T19:00:00Z');
  if v_resolved.work_date <> date '2026-08-26' or v_resolved.is_overtime then
    raise exception 'P9-008 S7 cross-midnight failed: %', row_to_json(v_resolved);
  end if;

  v_order1 := public.create_order_with_items(
    'P9-ORDER-1', v_area_source, v_area_target, v_data1, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_normal_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 100
    ))
  );
  select quantity into v_before_quantity from public.stock_balances where id = v_normal_balance;
  select count(*) into v_before_transactions from public.stock_transactions;
  v_sheet := public.submit_order_to_pending(
    v_order1, v_data1, null, '2026-08-26T02:00:00Z'
  );

  if not exists (
    select 1 from public.supply_shift_order_sheets
    where id = v_sheet and area_id = v_area_target and work_shift_id = v_s1
      and work_date = date '2026-08-26' and leader_id = v_leader
  ) then
    raise exception 'P9-001 sheet identity/link failed';
  end if;
  if (select shift_order_sheet_id from public.orders where id = v_order1) <> v_sheet then
    raise exception 'P9-001 Order was not linked';
  end if;
  if (select quantity from public.stock_balances where id = v_normal_balance) <> v_before_quantity
     or (select count(*) from public.stock_transactions) <> v_before_transactions then
    raise exception 'P9-020 Submit mutated stock';
  end if;

  v_order2 := public.create_order_with_items(
    'P9-ORDER-2', v_area_source, v_area_target, v_data2, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_normal_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 1
    ))
  );
  perform public.submit_order_to_pending(
    v_order2, v_data2, null, '2026-08-26T03:00:00Z'
  );
  select count(*) into v_sheet_count
  from public.supply_shift_order_sheets
  where area_id = v_area_target and work_shift_id = v_s1
    and work_date = date '2026-08-26' and not is_deleted;
  if v_sheet_count <> 1
     or (select shift_order_sheet_id from public.orders where id = v_order2) <> v_sheet then
    raise exception 'P9-002 same team did not share one sheet';
  end if;

  -- P9-024: Create More reuses the validated sheet context.
  v_create_more_order := public.create_order_with_items(
    'P9-CREATE-MORE', v_area_source, v_area_target, v_data1, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_normal_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 1
    ))
  );
  if public.submit_order_to_pending(
    v_create_more_order, v_data1, v_sheet, '2026-08-26T04:00:00Z'
  ) <> v_sheet then
    raise exception 'P9-024 Create More did not reuse the validated sheet';
  end if;

  -- P9-025: a Sheet from a different Area/group cannot be injected by the client.
  insert into public.supply_shift_order_sheets(
    area_id, work_shift_id, work_date, leader_id, is_active, is_deleted
  ) values (
    v_area_source, v_s1, date '2026-08-26', v_leader, true, false
  ) returning id into v_invalid_sheet;
  v_invalid_context_order := public.create_order_with_items(
    'P9-INVALID-SHEET', v_area_source, v_area_target, v_data1, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_normal_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 1
    ))
  );
  begin
    perform public.submit_order_to_pending(
      v_invalid_context_order, v_data1, v_invalid_sheet, '2026-08-26T04:05:00Z'
    );
    raise exception 'P9-025 invalid Sheet context unexpectedly submitted';
  exception when others then
    if sqlerrm not like '%ORDER_SHIFT_SHEET_CONTEXT_INVALID%' then raise; end if;
  end;

  -- P9-017: one eligible Stack is positive stock even when five are requested.
  v_stack_positive_order := public.create_order_with_items(
    'P9-POSITIVE-STACK', v_area_source, v_area_target, v_data1, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_stack_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 55,
      'set_per_qty', 11,
      'requested_stack_quantity', 5,
      'requested_total_set_quantity', 55
    ))
  );
  perform public.submit_order_to_pending(
    v_stack_positive_order, v_data1, v_sheet, '2026-08-26T04:10:00Z'
  );

  -- P9-014/P9-021 normal zero stock blocks transition and preserves Draft/items.
  v_zero_order := public.create_order_with_items(
    'P9-ZERO-NORMAL', v_area_source, v_area_target, v_data1, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_normal_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 1
    ))
  );
  update public.stock_balances set quantity = 0 where id = v_normal_balance;
  begin
    perform public.submit_order_to_pending(
      v_zero_order, v_data1, v_sheet, '2026-08-26T04:00:00Z'
    );
    raise exception 'P9-014 zero normal stock unexpectedly submitted';
  exception when others then
    if sqlerrm not like '%ORDER_ITEM_ZERO_STOCK%' then raise; end if;
  end;
  if (select status_id from public.orders where id = v_zero_order) <> v_draft_status
     or (select count(*) from public.order_items where order_id = v_zero_order) <> 1
     or (select shift_order_sheet_id from public.orders where id = v_zero_order) is not null then
    raise exception 'P9-021 zero-stock failure did not preserve Draft';
  end if;

  -- P9-016: exact 11 SET/chồng is zero; stock at 8 must not substitute.
  v_stack_zero_order := public.create_order_with_items(
    'P9-ZERO-STACK', v_area_source, v_area_target, v_data1, v_draft_status, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_stack_supply,
      'provider_id', v_provider,
      'unit_id', v_unit,
      'quantity_requested', 11,
      'set_per_qty', 11,
      'requested_stack_quantity', 1,
      'requested_total_set_quantity', 11
    ))
  );
  update public.stock_balances
  set quantity = 0, stack_quantity = 0, total_set_quantity = 0
  where id = v_stack_11_balance;
  begin
    perform public.submit_order_to_pending(
      v_stack_zero_order, v_data1, v_sheet, '2026-08-26T04:30:00Z'
    );
    raise exception 'P9-016 zero stack stock unexpectedly submitted';
  exception when others then
    if sqlerrm not like '%ORDER_ITEM_ZERO_STOCK%' then raise; end if;
  end;
end;
$$;

rollback;

select 'phase9-shift-order-sheets-integration: PASS' as result;

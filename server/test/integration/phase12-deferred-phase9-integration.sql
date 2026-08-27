\set ON_ERROR_STOP on

begin;

do $phase12$
declare
  v_role uuid;
  v_source uuid;
  v_other_source uuid := '91200000-0000-4000-8000-000000000002';
  v_target uuid;
  v_s1 uuid;
  v_s2 uuid;
  v_unit uuid;
  v_category uuid;
  v_supply uuid := '91200000-0000-4000-8000-000000000010';
  v_provider_a uuid := '91200000-0000-4000-8000-000000000011';
  v_provider_b uuid := '91200000-0000-4000-8000-000000000012';
  v_location_a uuid := '91200000-0000-4000-8000-000000000013';
  v_location_b uuid := '91200000-0000-4000-8000-000000000014';
  v_leader_a uuid := '91200000-0000-4000-8000-000000000020';
  v_leader_b uuid := '91200000-0000-4000-8000-000000000021';
  v_user_s1 uuid := '91200000-0000-4000-8000-000000000022';
  v_user_s2 uuid := '91200000-0000-4000-8000-000000000023';
  v_user_other_leader uuid := '91200000-0000-4000-8000-000000000024';
  v_user_no_assignment uuid := '91200000-0000-4000-8000-000000000025';
  v_user_no_leader uuid := '91200000-0000-4000-8000-000000000026';
  v_draft uuid;
  v_order_s1 uuid;
  v_order_s2 uuid;
  v_order_other_leader uuid;
  v_order_provider_zero uuid;
  v_order_area_zero uuid;
  v_order_no_assignment uuid;
  v_order_no_leader uuid;
  v_sheet_s1 uuid;
  v_sheet_s2 uuid;
  v_sheet_other_leader uuid;
  v_error text;
  v_resolved record;
begin
  select id into strict v_role from public.roles where code = 'DATA_PACKING';
  select id into strict v_target from public.areas where code = 'EDC_LOGISTICS';
  insert into public.areas(code, name, is_active, is_deleted)
  values ('VTDG', 'Vật tư đóng gói', true, false)
  on conflict (code) do update set is_active = true, is_deleted = false
  returning id into v_source;
  insert into public.areas(id, code, name)
  values (v_other_source, 'P12_OTHER_SOURCE', 'P12 other stock source');
  select id into strict v_s1 from public.work_shifts where code = 'S1';
  select id into strict v_s2 from public.work_shifts where code = 'S2';
  select id into strict v_unit from public.units where code = 'SET';
  select id into strict v_category from public.supply_categories where code = 'KIEN_SAT';
  select id into strict v_draft from public.order_statuses where code = 'DRAFT';

  insert into public.users(
    id, vinfast_id, email, role_id, area_id, managed_by_user_id,
    is_active, is_verified, is_deleted, first_name, last_name
  ) values
    (v_leader_a, 912000020, 'p12-leader-a@local.test', v_role, v_target, null, true, true, false, 'P12', 'Leader A'),
    (v_leader_b, 912000021, 'p12-leader-b@local.test', v_role, v_target, null, true, true, false, 'P12', 'Leader B'),
    (v_user_s1, 912000022, 'p12-s1@local.test', v_role, v_target, v_leader_a, true, true, false, 'P12', 'S1'),
    (v_user_s2, 912000023, 'p12-s2@local.test', v_role, v_target, v_leader_a, true, true, false, 'P12', 'S2'),
    (v_user_other_leader, 912000024, 'p12-other-leader@local.test', v_role, v_target, v_leader_b, true, true, false, 'P12', 'Other Leader'),
    (v_user_no_assignment, 912000025, 'p12-no-assignment@local.test', v_role, v_target, v_leader_a, true, true, false, 'P12', 'No Assignment'),
    (v_user_no_leader, 912000026, 'p12-no-leader@local.test', v_role, v_target, null, true, true, false, 'P12', 'No Leader');

  insert into public.user_roles(user_id, role_id)
  values
    (v_user_s1, v_role), (v_user_s2, v_role),
    (v_user_other_leader, v_role), (v_user_no_assignment, v_role),
    (v_user_no_leader, v_role)
  on conflict (user_id, role_id) do update
  set is_active = true, is_deleted = false;

  insert into public.user_work_shift_assignments(
    user_id, work_shift_id, effective_from, assigned_by
  ) values
    (v_user_s1, v_s1, '2026-08-01T00:00:00Z', v_leader_a),
    (v_user_s2, v_s2, '2026-08-01T00:00:00Z', v_leader_a),
    (v_user_other_leader, v_s1, '2026-08-01T00:00:00Z', v_leader_b),
    (v_user_no_leader, v_s1, '2026-08-01T00:00:00Z', v_leader_a);

  insert into public.providers(id, code, name) values
    (v_provider_a, 'P12_PROVIDER_ZERO', 'P12 Provider zero'),
    (v_provider_b, 'P12_PROVIDER_POSITIVE', 'P12 Provider positive');
  insert into public.supplies(id, code, short_text, category_id, unit_id)
  values (v_supply, 'P12_SUPPLY', 'P12 Supply', v_category, v_unit);
  insert into public.supply_providers(supply_id, provider_id)
  values (v_supply, v_provider_a), (v_supply, v_provider_b);
  insert into public.storage_locations(id, code, area_id, name) values
    (v_location_a, 'P12_SOURCE_A', v_source, 'P12 source A'),
    (v_location_b, 'P12_SOURCE_B', v_other_source, 'P12 source B');
  insert into public.stock_balances(
    supply_id, provider_id, area_id, storage_location_id, quantity
  ) values
    (v_supply, v_provider_b, v_source, v_location_a, 10),
    (v_supply, v_provider_a, v_other_source, v_location_b, 10);

  -- P9-011: 23:30Z is 06:30 on 27/08 in Asia/Ho_Chi_Minh.
  select * into v_resolved
  from public.resolve_user_work_shift_instance(v_user_s1, '2026-08-26T23:30:00Z');
  if v_resolved.work_date <> date '2026-08-27' or v_resolved.work_shift_code <> 'S1' then
    raise exception 'P9-011 UTC boundary mismatch: %', row_to_json(v_resolved);
  end if;

  -- P9-004: same Area/date but different assigned Shift creates two Sheets.
  v_order_s1 := public.create_order_with_items(
    'P12-SHIFT-S1', v_source, v_target, v_user_s1, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_b,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  v_order_s2 := public.create_order_with_items(
    'P12-SHIFT-S2', v_source, v_target, v_user_s2, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_b,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  v_sheet_s1 := public.submit_order_to_pending(v_order_s1, v_user_s1, null, '2026-08-26T23:30:00Z');
  v_sheet_s2 := public.submit_order_to_pending(v_order_s2, v_user_s2, null, '2026-08-27T07:30:00Z');
  if v_sheet_s1 = v_sheet_s2 or (
    select count(*) from public.supply_shift_order_sheets
    where area_id = v_target and work_date = date '2026-08-27'
      and work_shift_id in (v_s1, v_s2) and is_deleted = false
  ) <> 2 then
    raise exception 'P9-004 different shifts did not create two Sheets';
  end if;

  -- leader_id is metadata: another hierarchy in the same Area/Shift/Date reuses S1.
  v_order_other_leader := public.create_order_with_items(
    'P12-LEADER-METADATA', v_source, v_target, v_user_other_leader, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_b,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  v_sheet_other_leader := public.submit_order_to_pending(
    v_order_other_leader, v_user_other_leader, null, '2026-08-26T23:35:00Z'
  );
  if v_sheet_other_leader <> v_sheet_s1 then
    raise exception 'Leader metadata incorrectly split the business Sheet';
  end if;

  -- P9-018: Provider B stock cannot satisfy an item for Provider A.
  v_order_provider_zero := public.create_order_with_items(
    'P12-PROVIDER-ZERO', v_source, v_target, v_user_s1, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_a,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  begin
    perform public.submit_order_to_pending(v_order_provider_zero, v_user_s1, null, '2026-08-27T00:00:00Z');
    raise exception 'P9-018 provider isolation unexpectedly submitted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'ORDER_ITEM_ZERO_STOCK' then raise; end if;
  end;

  -- P9-019: stock in another Area cannot satisfy from_area VTDG.
  v_order_area_zero := public.create_order_with_items(
    'P12-AREA-ZERO', v_source, v_target, v_user_s1, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_a,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  begin
    perform public.submit_order_to_pending(v_order_area_zero, v_user_s1, null, '2026-08-27T00:05:00Z');
    raise exception 'P9-019 area isolation unexpectedly submitted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'ORDER_ITEM_ZERO_STOCK' then raise; end if;
  end;

  -- P9-026: no assignment is a safe failure before Sheet creation/link.
  v_order_no_assignment := public.create_order_with_items(
    'P12-NO-ASSIGNMENT', v_source, v_target, v_user_no_assignment, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_b,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  begin
    perform public.submit_order_to_pending(v_order_no_assignment, v_user_no_assignment, null, '2026-08-27T00:10:00Z');
    raise exception 'P9-026 missing assignment unexpectedly submitted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'WORK_SHIFT_ASSIGNMENT_NOT_FOUND' then raise; end if;
  end;
  if (select shift_order_sheet_id from public.orders where id = v_order_no_assignment) is not null then
    raise exception 'P9-026 linked a failed Order';
  end if;

  -- P9-027: no manager and no managed members must not self-elect a leader.
  v_order_no_leader := public.create_order_with_items(
    'P12-NO-LEADER', v_source, v_target, v_user_no_leader, v_draft, null,
    jsonb_build_array(jsonb_build_object(
      'supply_id', v_supply, 'provider_id', v_provider_b,
      'unit_id', v_unit, 'quantity_requested', 1
    ))
  );
  begin
    perform public.submit_order_to_pending(v_order_no_leader, v_user_no_leader, null, '2026-08-27T00:15:00Z');
    raise exception 'P9-027 missing hierarchy unexpectedly submitted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'ORDER_SHIFT_LEADER_NOT_FOUND' then raise; end if;
  end;
  if (select shift_order_sheet_id from public.orders where id = v_order_no_leader) is not null then
    raise exception 'P9-027 linked a failed Order';
  end if;

  raise notice 'PASS P9-004/P9-011/P9-018/P9-019/P9-026/P9-027 and leader metadata identity';
end
$phase12$;

rollback;

select 'phase12-deferred-phase9-integration: PASS' as result;

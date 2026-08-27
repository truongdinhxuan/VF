-- Phase 12 regression fix: leader_id is presentation metadata, not part of the
-- Shift Order Sheet identity. The authoritative key remains
-- (area_id, work_shift_id, work_date).

create or replace function public.submit_order_to_pending(
  p_order_id uuid,
  p_actor_id uuid,
  p_shift_order_sheet_id uuid default null,
  p_submitted_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_status_code text;
  v_pending_status_id uuid;
  v_requester public.users%rowtype;
  v_leader_id uuid;
  v_shift record;
  v_sheet public.supply_shift_order_sheets%rowtype;
  v_item record;
  v_available numeric;
  v_inventory_mode text;
begin
  if p_submitted_at is null then
    raise exception using message = 'ORDER_SUBMITTED_AT_INVALID';
  end if;

  if not public.has_permission(p_actor_id, 'supply.order.create') then
    raise exception using message = 'ORDER_SUBMIT_FORBIDDEN';
  end if;

  select order_row.* into v_order
  from public.orders order_row
  where order_row.id = p_order_id and order_row.is_deleted = false
  for update of order_row;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.requested_by <> p_actor_id then
    raise exception using message = 'ORDER_SUBMIT_FORBIDDEN';
  end if;

  select status.code into v_status_code
  from public.order_statuses status
  where status.id = v_order.status_id
    and status.is_active = true and status.is_deleted = false;
  if v_status_code is distinct from 'DRAFT' then
    raise exception using message = 'ORDER_NOT_DRAFT';
  end if;

  select requester.* into v_requester
  from public.users requester
  where requester.id = v_order.requested_by
    and requester.is_active = true
    and requester.is_verified = true
    and requester.is_deleted = false;
  if not found or v_requester.area_id is distinct from v_order.to_area_id then
    raise exception using message = 'ORDER_REQUESTER_CONTEXT_INVALID';
  end if;

  v_leader_id := v_requester.managed_by_user_id;
  if v_leader_id is null and exists (
    select 1 from public.users member
    where member.managed_by_user_id = v_requester.id
      and member.is_active = true and member.is_deleted = false
  ) then
    v_leader_id := v_requester.id;
  end if;
  if v_leader_id is null or not exists (
    select 1 from public.users leader
    where leader.id = v_leader_id
      and leader.is_active = true
      and leader.is_verified = true
      and leader.is_deleted = false
  ) then
    raise exception using message = 'ORDER_SHIFT_LEADER_NOT_FOUND';
  end if;

  select * into v_shift
  from public.resolve_user_work_shift_instance(v_order.requested_by, p_submitted_at);
  if not found then
    raise exception using message = 'WORK_SHIFT_ASSIGNMENT_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.order_items item
    where item.order_id = v_order.id
      and item.is_active = true and item.is_deleted = false
  ) then
    raise exception using message = 'ORDER_ITEMS_REQUIRED';
  end if;

  for v_item in
    select item.id, item.supply_id, item.provider_id, item.set_per_qty,
      supply.code as supply_code, provider.code as provider_code,
      category.code as category_code
    from public.order_items item
    join public.supplies supply on supply.id = item.supply_id
      and supply.is_active = true and supply.is_deleted = false
    join public.supply_categories category on category.id = supply.category_id
      and category.is_active = true and category.is_deleted = false
    join public.providers provider on provider.id = item.provider_id
      and provider.is_active = true and provider.is_deleted = false
    where item.order_id = v_order.id
      and item.is_active = true and item.is_deleted = false
    order by item.id
  loop
    if v_item.category_code = 'KIEN_SAT_TC' then
      v_inventory_mode := 'STACK';
      select coalesce(sum(balance.stack_quantity), 0) into v_available
      from public.stock_balances balance
      join public.storage_locations location on location.id = balance.storage_location_id
        and location.area_id = balance.area_id
        and location.is_active = true and location.is_deleted = false
      where balance.supply_id = v_item.supply_id
        and balance.provider_id = v_item.provider_id
        and balance.area_id = v_order.from_area_id
        and balance.set_per_qty = v_item.set_per_qty
        and balance.is_active = true and balance.is_deleted = false;
    else
      v_inventory_mode := 'NORMAL';
      select coalesce(sum(balance.quantity), 0) into v_available
      from public.stock_balances balance
      join public.storage_locations location on location.id = balance.storage_location_id
        and location.area_id = balance.area_id
        and location.is_active = true and location.is_deleted = false
      where balance.supply_id = v_item.supply_id
        and balance.provider_id = v_item.provider_id
        and balance.area_id = v_order.from_area_id
        and balance.set_per_qty is null
        and balance.is_active = true and balance.is_deleted = false;
    end if;

    if coalesce(v_available, 0) <= 0 then
      raise exception using
        message = 'ORDER_ITEM_ZERO_STOCK',
        detail = jsonb_build_object(
          'order_item_id', v_item.id,
          'supply_code', v_item.supply_code,
          'provider_code', v_item.provider_code,
          'set_per_qty', v_item.set_per_qty,
          'available_quantity', coalesce(v_available, 0),
          'inventory_mode', v_inventory_mode
        )::text;
    end if;
  end loop;

  if p_shift_order_sheet_id is not null then
    select sheet.* into v_sheet
    from public.supply_shift_order_sheets sheet
    where sheet.id = p_shift_order_sheet_id
      and sheet.is_active = true and sheet.is_deleted = false
    for update of sheet;

    if not found
       or v_sheet.area_id <> v_order.to_area_id
       or v_sheet.work_shift_id <> v_shift.work_shift_id
       or v_sheet.work_date <> v_shift.work_date then
      raise exception using message = 'ORDER_SHIFT_SHEET_CONTEXT_INVALID';
    end if;
  else
    insert into public.supply_shift_order_sheets(
      area_id, work_shift_id, work_date, leader_id, is_active, is_deleted
    ) values (
      v_order.to_area_id, v_shift.work_shift_id, v_shift.work_date,
      v_leader_id, true, false
    )
    on conflict (area_id, work_shift_id, work_date)
      where is_deleted = false
    do nothing
    returning * into v_sheet;

    if v_sheet.id is null then
      select sheet.* into v_sheet
      from public.supply_shift_order_sheets sheet
      where sheet.area_id = v_order.to_area_id
        and sheet.work_shift_id = v_shift.work_shift_id
        and sheet.work_date = v_shift.work_date
        and sheet.is_deleted = false
      for update of sheet;
    end if;
    if v_sheet.id is null or not v_sheet.is_active then
      raise exception using message = 'SHIFT_ORDER_SHEET_NOT_AVAILABLE';
    end if;
  end if;

  select status.id into v_pending_status_id
  from public.order_statuses status
  where status.code = 'PENDING'
    and status.is_active = true and status.is_deleted = false;
  if v_pending_status_id is null then
    raise exception using message = 'ORDER_STATUS_NOT_FOUND';
  end if;

  update public.orders
  set status_id = v_pending_status_id,
      submitted_at = p_submitted_at,
      shift_order_sheet_id = v_sheet.id,
      updated_at = now()
  where id = v_order.id;

  return v_sheet.id;
end;
$$;

revoke all on function public.submit_order_to_pending(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.submit_order_to_pending(uuid, uuid, uuid, timestamptz)
  to service_role;

comment on function public.submit_order_to_pending(uuid, uuid, uuid, timestamptz) is
  'Atomically submits an Order into the Area + WorkShift + WorkDate sheet; leader_id is metadata.';

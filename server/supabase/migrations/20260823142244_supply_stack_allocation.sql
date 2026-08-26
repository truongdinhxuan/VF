begin;

-- Supply Stack-Based Inventory, Phase 4: initial allocation proposal only.
-- Depends on the Phase 1 allocation table and Phase 3 stack OrderItem fields.
-- Allocation does not mutate inventory, create ledger rows, or reserve stock.

do $$
begin
  if to_regclass('public.order_item_allocations') is null
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'order_items'
         and column_name = 'requested_stack_quantity'
     ) then
    raise exception 'Supply stack Phase 1 and Phase 3 migrations must be applied before Phase 4';
  end if;
end
$$;

insert into public.permissions (
  code,
  name,
  module,
  description,
  is_system,
  is_active,
  is_deleted
)
values (
  'supply.order.allocate',
  'Phân bổ vị trí lấy hàng',
  'Supply',
  'Cho phép tạo đề xuất phân bổ vị trí cho KIEN_SAT_TC sau khi Order được duyệt',
  true,
  true,
  false
)
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description,
    is_system = true,
    is_active = true,
    is_deleted = false,
    updated_at = now();

-- The workbook does not assign allocation to a non-ADMIN business role.
-- Keep the established system ADMIN convention without guessing another role.
insert into public.role_permissions (
  role_id,
  permission_id,
  is_active,
  is_deleted
)
select r.id, p.id, true, false
from public.roles r
join public.permissions p on p.code = 'supply.order.allocate'
where r.code = 'ADMIN'
  and r.is_system = true
  and r.is_active = true
  and r.is_deleted = false
on conflict (role_id, permission_id) do update
set is_active = true,
    is_deleted = false,
    updated_at = now();

create or replace function public.allocate_stack_order(
  p_order_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_status_code text;
  v_item record;
  v_balance record;
  v_required_stack_quantity numeric;
  v_available_stack_quantity numeric;
  v_shortage_stack_quantity numeric;
  v_remaining_stack_quantity numeric;
  v_take_stack_quantity numeric;
  v_stack_item_count integer;
  v_allocation_count integer := 0;
begin
  if not public.has_permission(p_actor_id, 'supply.order.allocate') then
    raise exception using
      message = 'ALLOCATION_FORBIDDEN',
      detail = 'Actor does not have supply.order.allocate';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
    and o.is_active = true
    and o.is_deleted = false
  for update of o;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  select status.code
  into v_status_code
  from public.order_statuses status
  where status.id = v_order.status_id
    and status.is_active = true
    and status.is_deleted = false;

  if not found then
    raise exception using message = 'ORDER_STATUS_NOT_FOUND';
  end if;

  if v_status_code <> 'APPROVED' then
    raise exception using
      message = 'ORDER_NOT_APPROVED',
      detail = jsonb_build_object('current_status', v_status_code)::text;
  end if;

  if exists (
    select 1
    from public.order_item_allocations allocation
    join public.order_items item on item.id = allocation.order_item_id
    where item.order_id = p_order_id
  ) then
    raise exception using message = 'ALLOCATION_ALREADY_EXISTS';
  end if;

  select count(*)
  into v_stack_item_count
  from public.order_items item
  join public.supplies supply on supply.id = item.supply_id
  join public.supply_categories category on category.id = supply.category_id
  where item.order_id = p_order_id
    and item.is_active = true
    and item.is_deleted = false
    and supply.is_active = true
    and supply.is_deleted = false
    and category.is_active = true
    and category.is_deleted = false
    and category.code = 'KIEN_SAT_TC';

  if v_stack_item_count = 0 then
    raise exception using message = 'NO_STACK_ITEMS';
  end if;

  -- Serialize this availability snapshot with stock adjustment transactions.
  perform balance.id
  from public.stock_balances balance
  join public.storage_locations location
    on location.id = balance.storage_location_id
   and location.area_id = balance.area_id
   and location.is_active = true
   and location.is_deleted = false
  where balance.area_id = v_order.from_area_id
    and balance.is_active = true
    and balance.is_deleted = false
    and balance.set_per_qty is not null
    and balance.stack_quantity > 0
    and exists (
      select 1
      from public.order_items item
      join public.supplies supply on supply.id = item.supply_id
      join public.supply_categories category on category.id = supply.category_id
      where item.order_id = p_order_id
        and item.is_active = true
        and item.is_deleted = false
        and category.code = 'KIEN_SAT_TC'
        and category.is_active = true
        and category.is_deleted = false
        and balance.supply_id = item.supply_id
        and balance.provider_id = item.provider_id
        and balance.set_per_qty = item.set_per_qty
    )
  order by balance.id
  for update of balance;

  create temporary table if not exists stack_allocation_working (
    stock_balance_id uuid primary key,
    supply_id uuid not null,
    provider_id uuid not null,
    area_id uuid not null,
    set_per_qty numeric not null,
    storage_location_code text not null,
    available_stack_quantity numeric not null
  ) on commit drop;

  truncate table pg_temp.stack_allocation_working;

  insert into pg_temp.stack_allocation_working (
    stock_balance_id,
    supply_id,
    provider_id,
    area_id,
    set_per_qty,
    storage_location_code,
    available_stack_quantity
  )
  select
    balance.id,
    balance.supply_id,
    balance.provider_id,
    balance.area_id,
    balance.set_per_qty,
    location.code,
    balance.stack_quantity
  from public.stock_balances balance
  join public.storage_locations location
    on location.id = balance.storage_location_id
   and location.area_id = balance.area_id
   and location.is_active = true
   and location.is_deleted = false
  where balance.area_id = v_order.from_area_id
    and balance.is_active = true
    and balance.is_deleted = false
    and balance.set_per_qty is not null
    and balance.stack_quantity > 0
    and exists (
      select 1
      from public.order_items item
      join public.supplies supply on supply.id = item.supply_id
      join public.supply_categories category on category.id = supply.category_id
      where item.order_id = p_order_id
        and item.is_active = true
        and item.is_deleted = false
        and supply.is_active = true
        and supply.is_deleted = false
        and category.code = 'KIEN_SAT_TC'
        and category.is_active = true
        and category.is_deleted = false
        and balance.supply_id = item.supply_id
        and balance.provider_id = item.provider_id
        and balance.set_per_qty = item.set_per_qty
    );

  for v_item in
    select
      item.id,
      item.supply_id,
      item.provider_id,
      item.set_per_qty,
      item.quantity_approved,
      supply.code as supply_code
    from public.order_items item
    join public.supplies supply on supply.id = item.supply_id
    join public.supply_categories category on category.id = supply.category_id
    where item.order_id = p_order_id
      and item.is_active = true
      and item.is_deleted = false
      and supply.is_active = true
      and supply.is_deleted = false
      and category.is_active = true
      and category.is_deleted = false
      and category.code = 'KIEN_SAT_TC'
    order by item.created_at asc, item.id asc
  loop
    if v_item.set_per_qty is null
       or v_item.set_per_qty <= 0
       or v_item.quantity_approved is null
       or v_item.quantity_approved <= 0
       or mod(v_item.quantity_approved, v_item.set_per_qty) <> 0 then
      raise exception using
        message = 'STACK_APPROVAL_NOT_COMPATIBLE',
        detail = jsonb_build_object(
          'order_item_id', v_item.id,
          'supply_code', v_item.supply_code,
          'quantity_approved', v_item.quantity_approved,
          'set_per_qty', v_item.set_per_qty
        )::text;
    end if;

    v_required_stack_quantity :=
      v_item.quantity_approved / v_item.set_per_qty;

    select coalesce(sum(working.available_stack_quantity), 0)
    into v_available_stack_quantity
    from pg_temp.stack_allocation_working working
    where working.supply_id = v_item.supply_id
      and working.provider_id = v_item.provider_id
      and working.area_id = v_order.from_area_id
      and working.set_per_qty = v_item.set_per_qty
      and working.available_stack_quantity > 0;

    if v_available_stack_quantity < v_required_stack_quantity then
      v_shortage_stack_quantity :=
        v_required_stack_quantity - v_available_stack_quantity;
      raise exception using
        message = 'INSUFFICIENT_STACK_STOCK',
        detail = jsonb_build_object(
          'order_item_id', v_item.id,
          'supply_code', v_item.supply_code,
          'required_stack_quantity', v_required_stack_quantity,
          'available_stack_quantity', v_available_stack_quantity,
          'shortage_stack_quantity', v_shortage_stack_quantity,
          'set_per_qty', v_item.set_per_qty
        )::text;
    end if;

    v_remaining_stack_quantity := v_required_stack_quantity;

    for v_balance in
      select working.*
      from pg_temp.stack_allocation_working working
      where working.supply_id = v_item.supply_id
        and working.provider_id = v_item.provider_id
        and working.area_id = v_order.from_area_id
        and working.set_per_qty = v_item.set_per_qty
        and working.available_stack_quantity > 0
      order by
        working.available_stack_quantity desc,
        working.storage_location_code asc,
        working.stock_balance_id asc
    loop
      exit when v_remaining_stack_quantity = 0;

      v_take_stack_quantity := least(
        v_balance.available_stack_quantity,
        v_remaining_stack_quantity
      );

      if v_take_stack_quantity > 0 then
        insert into public.order_item_allocations (
          order_item_id,
          stock_balance_id,
          expected_stack_quantity,
          actual_stack_quantity,
          status,
          discrepancy_reason,
          allocated_at,
          confirmed_at,
          is_active,
          is_deleted
        )
        values (
          v_item.id,
          v_balance.stock_balance_id,
          v_take_stack_quantity,
          null,
          null,
          null,
          now(),
          null,
          true,
          false
        );

        update pg_temp.stack_allocation_working
        set available_stack_quantity =
          available_stack_quantity - v_take_stack_quantity
        where stock_balance_id = v_balance.stock_balance_id;

        v_remaining_stack_quantity :=
          v_remaining_stack_quantity - v_take_stack_quantity;
        v_allocation_count := v_allocation_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'allocated', true,
    'allocation_count', v_allocation_count
  );
end;
$$;

revoke execute on function public.allocate_stack_order(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.allocate_stack_order(uuid, uuid)
to service_role;

comment on function public.allocate_stack_order(uuid, uuid) is
  'Creates an atomic initial KIEN_SAT_TC picking proposal. Does not mutate or reserve stock.';

commit;

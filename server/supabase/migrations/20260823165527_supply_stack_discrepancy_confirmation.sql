begin;

do $$
begin
  if to_regclass('public.order_item_allocations') is null
     or to_regclass('public.inventory_discrepancies') is null
     or to_regclass('public.stock_transactions') is null
     or to_regprocedure('public.allocate_stack_order(uuid,uuid)') is null then
    raise exception 'Supply stack Phase 1-4 migrations must be applied before Phase 5';
  end if;
end
$$;

insert into public.permissions (
  code, name, module, description, is_system, is_active, is_deleted
)
values
  (
    'supply.order.confirm_allocation',
    'Xác nhận số chồng thực tế',
    'Supply',
    'Xác nhận actual stack quantity, ghi nhận sai lệch và phân bổ lại phần thiếu',
    true, true, false
  ),
  (
    'supply.discrepancy.resolve',
    'Xử lý cảnh báo sai lệch tồn',
    'Supply',
    'Đóng một inventory discrepancy sau khi đã kiểm kê và nhập ghi chú xử lý',
    true, true, false
  )
on conflict (code) do update
set name = excluded.name,
    module = excluded.module,
    description = excluded.description,
    is_system = true,
    is_active = true,
    is_deleted = false,
    updated_at = now();

-- DATA_MATERIAL is the existing seeded business role code for the physical
-- picking actor. Only ADMIN is marked is_system in the RBAC schema, so protect
-- the ADMIN assignment with is_system while resolving DATA_MATERIAL by its
-- unique canonical code. Resolution remains system-ADMIN only.
with seed(role_code, permission_code) as (
  values
    ('ADMIN', 'supply.order.confirm_allocation'),
    ('DATA_MATERIAL', 'supply.order.confirm_allocation'),
    ('ADMIN', 'supply.discrepancy.resolve')
)
insert into public.role_permissions (
  role_id, permission_id, is_active, is_deleted
)
select role.id, permission.id, true, false
from seed
join public.roles role
  on role.code = seed.role_code
 and (role.code <> 'ADMIN' or role.is_system = true)
 and role.is_active = true
 and role.is_deleted = false
join public.permissions permission
  on permission.code = seed.permission_code
 and permission.is_system = true
 and permission.is_active = true
 and permission.is_deleted = false
on conflict (role_id, permission_id) do update
set is_active = true,
    is_deleted = false,
    updated_at = now();

insert into public.stock_transaction_types (
  code, name, effect, requires_reason, is_system, is_active, is_deleted
)
values (
  'DISCREPANCY_CORRECTION',
  'Discrepancy correction',
  'DECREASE',
  false,
  true,
  true,
  false
)
on conflict (code) do update
set name = excluded.name,
    effect = excluded.effect,
    requires_reason = excluded.requires_reason,
    is_system = true,
    is_active = true,
    is_deleted = false,
    updated_at = now();

alter table public.stock_transactions
  add column inventory_discrepancy_id uuid;

alter table public.stock_transactions
  add constraint stock_transactions_inventory_discrepancy_id_fkey
  foreign key (inventory_discrepancy_id)
  references public.inventory_discrepancies(id)
  on delete restrict on update cascade;

create index stock_transactions_inventory_discrepancy_id_idx
  on public.stock_transactions(inventory_discrepancy_id)
  where inventory_discrepancy_id is not null;

create unique index inventory_discrepancies_allocation_key
  on public.inventory_discrepancies(allocation_id)
  where is_deleted = false;

alter table public.inventory_discrepancies
  add constraint inventory_discrepancies_difference_valid check (
    difference_stack_quantity > 0
    and expected_stack_quantity = actual_stack_quantity + difference_stack_quantity
  );

create or replace function public.confirm_stack_allocation_actual(
  p_allocation_id uuid,
  p_actual_stack_quantity numeric,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allocation public.order_item_allocations%rowtype;
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_balance public.stock_balances%rowtype;
  v_status_code text;
  v_category_code text;
  v_transaction_type_id uuid;
  v_discrepancy_id uuid;
  v_difference numeric;
  v_difference_total numeric;
  v_before_stack numeric;
  v_after_stack numeric;
  v_before_total numeric;
  v_after_total numeric;
  v_available_alternative numeric := 0;
  v_remaining numeric := 0;
  v_take numeric;
  v_reallocation_count integer := 0;
  v_reallocation_status text := 'NOT_REQUIRED';
  v_new_allocations jsonb := '[]'::jsonb;
  v_new_allocation_id uuid;
  v_candidate record;
begin
  if not public.has_permission(p_actor_id, 'supply.order.confirm_allocation') then
    raise exception using
      message = 'CONFIRM_ALLOCATION_FORBIDDEN',
      detail = 'Actor does not have supply.order.confirm_allocation';
  end if;

  if p_actual_stack_quantity is null or p_actual_stack_quantity < 0 then
    raise exception using message = 'ACTUAL_STACK_INVALID';
  end if;

  select allocation.*
  into v_allocation
  from public.order_item_allocations allocation
  where allocation.id = p_allocation_id
    and allocation.is_active = true
    and allocation.is_deleted = false
  for update of allocation;

  if not found then
    raise exception using message = 'ALLOCATION_NOT_FOUND';
  end if;

  if v_allocation.confirmed_at is not null
     or v_allocation.actual_stack_quantity is not null then
    raise exception using message = 'ALLOCATION_ALREADY_CONFIRMED';
  end if;

  if p_actual_stack_quantity > v_allocation.expected_stack_quantity then
    raise exception using
      message = 'ACTUAL_STACK_EXCEEDS_EXPECTED',
      detail = jsonb_build_object(
        'expected_stack_quantity', v_allocation.expected_stack_quantity,
        'actual_stack_quantity', p_actual_stack_quantity
      )::text;
  end if;

  select item.*
  into v_item
  from public.order_items item
  where item.id = v_allocation.order_item_id
    and item.is_active = true
    and item.is_deleted = false;

  if not found then
    raise exception using message = 'ORDER_ITEM_NOT_FOUND';
  end if;

  select orders.*
  into v_order
  from public.orders orders
  where orders.id = v_item.order_id
    and orders.is_active = true
    and orders.is_deleted = false
  for update of orders;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  select status.code
  into v_status_code
  from public.order_statuses status
  where status.id = v_order.status_id
    and status.is_active = true
    and status.is_deleted = false;

  if v_status_code is distinct from 'APPROVED' then
    raise exception using
      message = 'ORDER_NOT_CONFIRMABLE',
      detail = jsonb_build_object('current_status', v_status_code)::text;
  end if;

  select category.code
  into v_category_code
  from public.supplies supply
  join public.supply_categories category on category.id = supply.category_id
  where supply.id = v_item.supply_id
    and supply.is_active = true
    and supply.is_deleted = false
    and category.is_active = true
    and category.is_deleted = false;

  if v_category_code is distinct from 'KIEN_SAT_TC'
     or v_item.set_per_qty is null
     or v_item.set_per_qty <= 0 then
    raise exception using message = 'ORDER_NOT_CONFIRMABLE';
  end if;

  select balance.*
  into v_balance
  from public.stock_balances balance
  join public.storage_locations location
    on location.id = balance.storage_location_id
   and location.area_id = balance.area_id
   and location.is_active = true
   and location.is_deleted = false
  where balance.id = v_allocation.stock_balance_id
    and balance.supply_id = v_item.supply_id
    and balance.provider_id = v_item.provider_id
    and balance.area_id = v_order.from_area_id
    and balance.set_per_qty = v_item.set_per_qty
    and balance.is_active = true
    and balance.is_deleted = false
  for update of balance;

  if not found then
    raise exception using message = 'STOCK_BALANCE_NOT_FOUND';
  end if;

  update public.order_item_allocations
  set actual_stack_quantity = p_actual_stack_quantity,
      discrepancy_reason = nullif(btrim(p_reason), ''),
      confirmed_at = now(),
      updated_at = now()
  where id = v_allocation.id;

  if p_actual_stack_quantity = v_allocation.expected_stack_quantity then
    return jsonb_build_object(
      'allocation_id', v_allocation.id,
      'actual_stack_quantity', p_actual_stack_quantity,
      'discrepancy_id', null,
      'difference_stack_quantity', 0,
      'reallocation_status', v_reallocation_status,
      'required_stack_quantity', 0,
      'available_stack_quantity', 0,
      'unallocated_stack_quantity', 0,
      'new_allocations', v_new_allocations
    );
  end if;

  v_difference := v_allocation.expected_stack_quantity - p_actual_stack_quantity;
  v_difference_total := v_difference * v_item.set_per_qty;
  v_before_stack := v_balance.stack_quantity;
  v_before_total := v_balance.quantity;

  if v_before_stack is null
     or v_before_stack < v_difference
     or v_before_total < v_difference_total then
    raise exception using
      message = 'DISCREPANCY_CORRECTION_STOCK_CONFLICT',
      detail = jsonb_build_object(
        'stock_balance_id', v_balance.id,
        'required_stack_quantity', v_difference,
        'available_stack_quantity', v_before_stack
      )::text;
  end if;

  v_after_stack := v_before_stack - v_difference;
  v_after_total := v_before_total - v_difference_total;

  update public.stock_balances
  set stack_quantity = v_after_stack,
      total_set_quantity = v_after_total,
      quantity = v_after_total,
      updated_at = now()
  where id = v_balance.id;

  insert into public.inventory_discrepancies (
    stock_balance_id,
    order_id,
    order_item_id,
    allocation_id,
    expected_stack_quantity,
    actual_stack_quantity,
    difference_stack_quantity,
    reason,
    status,
    reported_by,
    reported_at,
    is_active,
    is_deleted
  )
  values (
    v_balance.id,
    v_order.id,
    v_item.id,
    v_allocation.id,
    v_allocation.expected_stack_quantity,
    p_actual_stack_quantity,
    v_difference,
    nullif(btrim(p_reason), ''),
    'OPEN',
    p_actor_id,
    now(),
    true,
    false
  )
  returning id into v_discrepancy_id;

  select transaction_type.id
  into v_transaction_type_id
  from public.stock_transaction_types transaction_type
  where transaction_type.code = 'DISCREPANCY_CORRECTION'
    and transaction_type.effect = 'DECREASE'
    and transaction_type.is_active = true
    and transaction_type.is_deleted = false;

  if not found then
    raise exception using message = 'DISCREPANCY_TRANSACTION_TYPE_NOT_FOUND';
  end if;

  insert into public.stock_transactions (
    supply_id,
    provider_id,
    area_id,
    storage_location_id,
    order_id,
    order_item_id,
    inventory_discrepancy_id,
    transaction_type_id,
    quantity,
    before_quantity,
    after_quantity,
    set_per_qty,
    stack_quantity,
    before_stack_quantity,
    after_stack_quantity,
    reason,
    reason_note,
    note,
    created_by,
    is_active,
    is_deleted
  )
  values (
    v_item.supply_id,
    v_item.provider_id,
    v_balance.area_id,
    v_balance.storage_location_id,
    v_order.id,
    v_item.id,
    v_discrepancy_id,
    v_transaction_type_id,
    v_difference_total,
    v_before_total,
    v_after_total,
    v_item.set_per_qty,
    v_difference,
    v_before_stack,
    v_after_stack,
    coalesce(nullif(btrim(p_reason), ''), 'Chênh lệch số chồng thực tế so với phân bổ'),
    nullif(btrim(p_reason), ''),
    'Automatic physical stock correction from confirmed stack allocation',
    p_actor_id,
    true,
    false
  );

  -- Lock every eligible alternative in stable id order before calculating the
  -- full-only plan. No alternative balance is mutated in Phase 5.
  perform alternative.id
  from public.stock_balances alternative
  join public.storage_locations location
    on location.id = alternative.storage_location_id
   and location.area_id = alternative.area_id
   and location.is_active = true
   and location.is_deleted = false
  where alternative.id <> v_balance.id
    and alternative.supply_id = v_item.supply_id
    and alternative.provider_id = v_item.provider_id
    and alternative.area_id = v_order.from_area_id
    and alternative.set_per_qty = v_item.set_per_qty
    and alternative.stack_quantity > 0
    and alternative.is_active = true
    and alternative.is_deleted = false
  order by alternative.id
  for update of alternative;

  select coalesce(sum(alternative.stack_quantity), 0)
  into v_available_alternative
  from public.stock_balances alternative
  join public.storage_locations location
    on location.id = alternative.storage_location_id
   and location.area_id = alternative.area_id
   and location.is_active = true
   and location.is_deleted = false
  where alternative.id <> v_balance.id
    and alternative.supply_id = v_item.supply_id
    and alternative.provider_id = v_item.provider_id
    and alternative.area_id = v_order.from_area_id
    and alternative.set_per_qty = v_item.set_per_qty
    and alternative.stack_quantity > 0
    and alternative.is_active = true
    and alternative.is_deleted = false;

  if v_available_alternative < v_difference then
    v_reallocation_status := 'INSUFFICIENT';
  else
    v_reallocation_status := 'REALLOCATED';
    v_remaining := v_difference;

    for v_candidate in
      select alternative.id, alternative.stack_quantity, location.code
      from public.stock_balances alternative
      join public.storage_locations location
        on location.id = alternative.storage_location_id
       and location.area_id = alternative.area_id
       and location.is_active = true
       and location.is_deleted = false
      where alternative.id <> v_balance.id
        and alternative.supply_id = v_item.supply_id
        and alternative.provider_id = v_item.provider_id
        and alternative.area_id = v_order.from_area_id
        and alternative.set_per_qty = v_item.set_per_qty
        and alternative.stack_quantity > 0
        and alternative.is_active = true
        and alternative.is_deleted = false
      order by alternative.stack_quantity desc, location.code asc, alternative.id asc
    loop
      exit when v_remaining = 0;
      v_take := least(v_candidate.stack_quantity, v_remaining);

      if v_take > 0 then
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
          v_candidate.id,
          v_take,
          null,
          null,
          null,
          now(),
          null,
          true,
          false
        )
        returning id into v_new_allocation_id;

        v_new_allocations := v_new_allocations || jsonb_build_array(
          jsonb_build_object(
            'id', v_new_allocation_id,
            'stock_balance_id', v_candidate.id,
            'expected_stack_quantity', v_take
          )
        );
        v_reallocation_count := v_reallocation_count + 1;
        v_remaining := v_remaining - v_take;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'allocation_id', p_allocation_id,
    'actual_stack_quantity', p_actual_stack_quantity,
    'discrepancy_id', v_discrepancy_id,
    'difference_stack_quantity', v_difference,
    'reallocation_status', v_reallocation_status,
    'required_stack_quantity', v_difference,
    'available_stack_quantity', v_available_alternative,
    'unallocated_stack_quantity',
      case
        when v_reallocation_status = 'INSUFFICIENT'
          then greatest(v_difference - v_available_alternative, 0)
        else 0
      end,
    'reallocation_count', v_reallocation_count,
    'new_allocations', v_new_allocations
  );
end;
$$;

revoke all on function public.confirm_stack_allocation_actual(
  uuid, numeric, uuid, text
) from public, anon, authenticated;
grant execute on function public.confirm_stack_allocation_actual(
  uuid, numeric, uuid, text
) to service_role;

create or replace function public.resolve_inventory_discrepancy(
  p_discrepancy_id uuid,
  p_actor_id uuid,
  p_resolution_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discrepancy public.inventory_discrepancies%rowtype;
  v_note text;
begin
  if not public.has_permission(p_actor_id, 'supply.discrepancy.resolve') then
    raise exception using
      message = 'DISCREPANCY_RESOLVE_FORBIDDEN',
      detail = 'Actor does not have supply.discrepancy.resolve';
  end if;

  v_note := nullif(btrim(p_resolution_note), '');
  if v_note is null then
    raise exception using message = 'RESOLUTION_NOTE_REQUIRED';
  end if;

  select discrepancy.*
  into v_discrepancy
  from public.inventory_discrepancies discrepancy
  where discrepancy.id = p_discrepancy_id
    and discrepancy.is_active = true
    and discrepancy.is_deleted = false
  for update of discrepancy;

  if not found then
    raise exception using message = 'DISCREPANCY_NOT_FOUND';
  end if;

  if v_discrepancy.status <> 'OPEN' then
    raise exception using message = 'DISCREPANCY_ALREADY_RESOLVED';
  end if;

  update public.inventory_discrepancies
  set status = 'RESOLVED',
      resolved_by = p_actor_id,
      resolved_at = now(),
      resolution_note = v_note,
      updated_at = now()
  where id = v_discrepancy.id;

  return jsonb_build_object(
    'id', v_discrepancy.id,
    'stock_balance_id', v_discrepancy.stock_balance_id,
    'status', 'RESOLVED',
    'resolved_by', p_actor_id,
    'resolution_note', v_note
  );
end;
$$;

revoke all on function public.resolve_inventory_discrepancy(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.resolve_inventory_discrepancy(uuid, uuid, text)
to service_role;

create or replace function public.has_open_discrepancy(
  balance public.stock_balances
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inventory_discrepancies discrepancy
    where discrepancy.stock_balance_id = balance.id
      and discrepancy.status = 'OPEN'
      and discrepancy.is_active = true
      and discrepancy.is_deleted = false
  );
$$;

revoke all on function public.has_open_discrepancy(public.stock_balances)
from public, anon, authenticated;
grant execute on function public.has_open_discrepancy(public.stock_balances)
to service_role;

comment on column public.stock_transactions.inventory_discrepancy_id is
  'Optional trace from an immutable stock ledger row to the discrepancy that caused it.';
comment on function public.confirm_stack_allocation_actual(uuid, numeric, uuid, text) is
  'Atomically confirms actual stack count, corrects physical stock shortage, writes the immutable ledger and discrepancy, then performs full-only reallocation.';
comment on function public.resolve_inventory_discrepancy(uuid, uuid, text) is
  'Atomically resolves an OPEN discrepancy without changing stock or historical transactions.';
comment on function public.has_open_discrepancy(public.stock_balances) is
  'Derived PostgREST computed field; no warning flag is persisted on StockBalances.';

commit;

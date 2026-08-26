begin;

-- Supply Stack-Based Order, Phase 6.
-- Extend the single authoritative issue_order RPC. Normal supplies retain the
-- existing client-directed quantity/location flow; KIEN_SAT_TC derives its
-- entire issue plan from confirmed allocations stored by Phases 4-5.

do $$
begin
  if to_regclass('public.order_item_allocations') is null
     or to_regprocedure('public.confirm_stack_allocation_actual(uuid,numeric,uuid,text)') is null
     or to_regprocedure('public.issue_order(uuid,uuid,jsonb,uuid,uuid)') is null then
    raise exception 'Supply stack Phase 1-5 migrations must be applied before Phase 6';
  end if;
end
$$;

-- StockTransactions embeds AdjustmentReason in the existing read API. Earlier
-- hardening granted service_role access to the ledger but omitted this lookup,
-- causing the post-Issue cache refresh to fail even after a successful commit.
grant select on table public.adjustment_reasons to service_role;

create or replace function public.issue_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_items jsonb,
  p_forklift_by uuid default null,
  p_taken_away_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_order_item record;
  v_balance public.stock_balances%rowtype;
  v_current_status_code text;
  v_new_status_code text;
  v_new_status_id uuid;
  v_issue_type_id uuid;
  v_issue_action_id uuid;
  v_item_payload jsonb;
  v_issue_payload jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_payload_item_ids uuid[] := array[]::uuid[];
  v_balance_ids uuid[] := array[]::uuid[];
  v_transaction_ids uuid[] := array[]::uuid[];
  v_transaction_id uuid;
  v_item_id uuid;
  v_location_id uuid;
  v_balance_id uuid;
  v_quantity numeric;
  v_item_issue_total numeric;
  v_approved_stack_quantity numeric;
  v_allocation_count integer;
  v_unconfirmed_count integer;
  v_actual_stack_total numeric;
  v_pending_stack_count integer := 0;
  v_demand record;
  v_mutation record;
  v_allocation record;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_stack_quantity numeric;
  v_after_stack_quantity numeric;
  v_location_code text;
  v_supply_code text;
  v_provider_code text;
begin
  if not public.has_permission(p_actor_id, 'supply.order.issue') then
    raise exception using
      message = 'ISSUE_FORBIDDEN',
      detail = 'Actor does not have supply.order.issue';
  end if;

  if p_items is null then
    p_items := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception using message = 'ISSUE_ITEMS_INVALID';
  end if;

  -- The Order row is the first business lock for every Issue operation.
  select orders.*
  into v_order
  from public.orders orders
  where orders.id = p_order_id
    and orders.is_active = true
    and orders.is_deleted = false
  for update of orders;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  select status.code
  into v_current_status_code
  from public.order_statuses status
  where status.id = v_order.status_id
    and status.is_active = true
    and status.is_deleted = false;

  if v_current_status_code in ('ISSUED', 'RECEIVED', 'COMPLETED') then
    raise exception using
      message = 'ORDER_ALREADY_ISSUED',
      detail = jsonb_build_object('current_status', v_current_status_code)::text;
  end if;
  if v_current_status_code not in ('APPROVED', 'PARTIAL_ISSUED') then
    raise exception using
      message = 'ORDER_NOT_ISSUABLE',
      detail = jsonb_build_object('current_status', v_current_status_code)::text;
  end if;

  select transaction_type.id
  into v_issue_type_id
  from public.stock_transaction_types transaction_type
  where transaction_type.code = 'ISSUE'
    and transaction_type.effect = 'DECREASE'
    and transaction_type.is_active = true
    and transaction_type.is_deleted = false;

  select action.id
  into v_issue_action_id
  from public.order_revision_actions action
  where action.code = 'ISSUE'
    and action.is_active = true
    and action.is_deleted = false;

  if v_issue_type_id is null or v_issue_action_id is null then
    raise exception using message = 'ISSUE_LOOKUP_NOT_FOUND';
  end if;

  -- Lock all active OrderItems in stable order. Allocation confirmation also
  -- locks the Order before it can commit, so Issue cannot consume an uncommitted
  -- actual quantity and does not need an opposite-order Allocation lock.
  perform item.id
  from public.order_items item
  where item.order_id = p_order_id
    and item.is_active = true
    and item.is_deleted = false
  order by item.id
  for update of item;

  -- Build the authoritative Stack plan from confirmed allocations only.
  for v_order_item in
    select
      item.*,
      supply.code as supply_code,
      category.code as category_code,
      provider.code as provider_code,
      supply.is_active and not supply.is_deleted as supply_is_valid,
      category.is_active and not category.is_deleted as category_is_valid,
      provider.is_active and not provider.is_deleted as provider_is_valid,
      supply_provider.is_active and not supply_provider.is_deleted
        as supply_provider_is_valid
    from public.order_items item
    join public.supplies supply
      on supply.id = item.supply_id
    join public.supply_categories category
      on category.id = supply.category_id
    join public.providers provider
      on provider.id = item.provider_id
    join public.supply_providers supply_provider
      on supply_provider.supply_id = item.supply_id
     and supply_provider.provider_id = item.provider_id
    where item.order_id = p_order_id
      and item.is_active = true
      and item.is_deleted = false
    order by item.id
  loop
    if not v_order_item.supply_is_valid
       or not v_order_item.category_is_valid
       or not v_order_item.provider_is_valid
       or not v_order_item.supply_provider_is_valid then
      raise exception using
        message = 'ORDER_NOT_ISSUABLE',
        detail = jsonb_build_object(
          'order_item_id', v_order_item.id,
          'reason', 'INACTIVE_ORDER_ITEM_REFERENCE'
        )::text;
    end if;

    if v_order_item.category_code = 'KIEN_SAT_TC' then
      if coalesce(v_order_item.quantity_issued, 0) > 0
         and coalesce(v_order_item.quantity_issued, 0) < coalesce(v_order_item.quantity_approved, 0) then
        raise exception using
          message = 'STACK_PARTIAL_ISSUE_NOT_SUPPORTED',
          detail = jsonb_build_object(
            'order_item_id', v_order_item.id,
            'quantity_approved', v_order_item.quantity_approved,
            'quantity_issued', v_order_item.quantity_issued
          )::text;
      end if;

      -- A fully issued Stack item may coexist with pending normal items while
      -- the Order is PARTIAL_ISSUED. Never deduct that Stack item a second time.
      if v_order_item.quantity_approved is not null
         and coalesce(v_order_item.quantity_issued, 0) = v_order_item.quantity_approved then
        continue;
      end if;

      v_pending_stack_count := v_pending_stack_count + 1;

      if v_order_item.quantity_approved is null
         or v_order_item.quantity_approved <= 0
         or v_order_item.set_per_qty is null
         or v_order_item.set_per_qty <= 0
         or mod(v_order_item.quantity_approved, v_order_item.set_per_qty) <> 0 then
        raise exception using
          message = 'STACK_APPROVAL_NOT_COMPATIBLE',
          detail = jsonb_build_object(
            'order_item_id', v_order_item.id,
            'supply_code', v_order_item.supply_code,
            'quantity_approved', v_order_item.quantity_approved,
            'set_per_qty', v_order_item.set_per_qty
          )::text;
      end if;

      v_approved_stack_quantity :=
        v_order_item.quantity_approved / v_order_item.set_per_qty;

      select
        count(*)::integer,
        count(*) filter (
          where allocation.actual_stack_quantity is null
             or allocation.confirmed_at is null
        )::integer,
        coalesce(sum(allocation.actual_stack_quantity), 0)
      into
        v_allocation_count,
        v_unconfirmed_count,
        v_actual_stack_total
      from public.order_item_allocations allocation
      where allocation.order_item_id = v_order_item.id
        and allocation.is_active = true
        and allocation.is_deleted = false;

      if v_allocation_count = 0 or v_unconfirmed_count > 0 then
        raise exception using
          message = 'STACK_ALLOCATIONS_NOT_CONFIRMED',
          detail = jsonb_build_object(
            'order_item_id', v_order_item.id,
            'supply_code', v_order_item.supply_code,
            'allocation_count', v_allocation_count,
            'unconfirmed_allocation_count', v_unconfirmed_count,
            'approved_stack_quantity', v_approved_stack_quantity,
            'actual_stack_quantity', v_actual_stack_total
          )::text;
      end if;

      if v_actual_stack_total <> v_approved_stack_quantity then
        raise exception using
          message = 'STACK_ISSUE_ALLOCATION_INCOMPLETE',
          detail = jsonb_build_object(
            'order_item_id', v_order_item.id,
            'supply_code', v_order_item.supply_code,
            'approved_stack_quantity', v_approved_stack_quantity,
            'actual_stack_quantity', v_actual_stack_total,
            'shortage_stack_quantity',
              greatest(v_approved_stack_quantity - v_actual_stack_total, 0)
          )::text;
      end if;

      for v_allocation in
        select
          allocation.id,
          allocation.stock_balance_id,
          allocation.actual_stack_quantity,
          balance.storage_location_id,
          location.code as location_code
        from public.order_item_allocations allocation
        left join public.stock_balances balance
          on balance.id = allocation.stock_balance_id
         and balance.supply_id = v_order_item.supply_id
         and balance.provider_id = v_order_item.provider_id
         and balance.area_id = v_order.from_area_id
         and balance.set_per_qty = v_order_item.set_per_qty
         and balance.is_active = true
         and balance.is_deleted = false
        left join public.storage_locations location
          on location.id = balance.storage_location_id
         and location.area_id = v_order.from_area_id
         and location.is_active = true
         and location.is_deleted = false
        where allocation.order_item_id = v_order_item.id
          and allocation.is_active = true
          and allocation.is_deleted = false
        order by allocation.id
      loop
        if v_allocation.storage_location_id is null
           or v_allocation.location_code is null then
          raise exception using
            message = 'STACK_ISSUE_STOCK_CONFLICT',
            detail = jsonb_build_object(
              'reason', 'SOURCE_BALANCE_INVALID',
              'order_item_id', v_order_item.id,
              'allocation_id', v_allocation.id,
              'stock_balance_id', v_allocation.stock_balance_id,
              'supply_code', v_order_item.supply_code,
              'provider_code', v_order_item.provider_code,
              'set_per_qty', v_order_item.set_per_qty
            )::text;
        end if;

        -- Zero actual is audit history only: no mutation and no zero ledger row.
        if v_allocation.actual_stack_quantity > 0 then
          v_plan := v_plan || jsonb_build_array(jsonb_build_object(
            'is_stack', true,
            'order_item_id', v_order_item.id,
            'allocation_id', v_allocation.id,
            'stock_balance_id', v_allocation.stock_balance_id,
            'set_per_qty', v_order_item.set_per_qty,
            'stack_quantity', v_allocation.actual_stack_quantity,
            'quantity',
              v_allocation.actual_stack_quantity * v_order_item.set_per_qty
          ));
        end if;
      end loop;
    end if;
  end loop;

  -- Preserve the current normal/KIEN_SAT_SPECIAL Issue contract. A Stack item
  -- supplied by the client is rejected because its location and quantity must
  -- come from confirmed allocations.
  for v_item_payload in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item_payload) <> 'object'
       or nullif(v_item_payload ->> 'order_item_id', '') is null then
      raise exception using message = 'ISSUE_ITEMS_INVALID';
    end if;

    v_item_id := (v_item_payload ->> 'order_item_id')::uuid;
    if v_item_id = any(v_payload_item_ids) then
      raise exception using message = 'ISSUE_ITEMS_INVALID', detail = 'Duplicate order_item_id';
    end if;
    v_payload_item_ids := array_append(v_payload_item_ids, v_item_id);

    select
      item.*,
      supply.code as supply_code,
      category.code as category_code,
      provider.code as provider_code,
      supply.is_active and not supply.is_deleted as supply_is_valid,
      category.is_active and not category.is_deleted as category_is_valid,
      provider.is_active and not provider.is_deleted as provider_is_valid,
      supply_provider.is_active and not supply_provider.is_deleted
        as supply_provider_is_valid
    into v_order_item
    from public.order_items item
    join public.supplies supply
      on supply.id = item.supply_id
    join public.supply_categories category
      on category.id = supply.category_id
    join public.providers provider
      on provider.id = item.provider_id
    join public.supply_providers supply_provider
      on supply_provider.supply_id = item.supply_id
     and supply_provider.provider_id = item.provider_id
    where item.id = v_item_id
      and item.order_id = p_order_id
      and item.is_active = true
      and item.is_deleted = false;

    if not found then
      raise exception using message = 'ORDER_ITEM_NOT_FOUND';
    end if;
    if not v_order_item.supply_is_valid
       or not v_order_item.category_is_valid
       or not v_order_item.provider_is_valid
       or not v_order_item.supply_provider_is_valid then
      raise exception using
        message = 'ORDER_NOT_ISSUABLE',
        detail = jsonb_build_object(
          'order_item_id', v_order_item.id,
          'reason', 'INACTIVE_ORDER_ITEM_REFERENCE'
        )::text;
    end if;
    if v_order_item.category_code = 'KIEN_SAT_TC' then
      raise exception using
        message = 'STACK_PARTIAL_ISSUE_NOT_SUPPORTED',
        detail = jsonb_build_object('order_item_id', v_order_item.id)::text;
    end if;
    if jsonb_typeof(v_item_payload -> 'issues') <> 'array'
       or jsonb_array_length(v_item_payload -> 'issues') = 0 then
      raise exception using message = 'ISSUE_ITEMS_INVALID';
    end if;
    if v_order_item.quantity_approved is null
       or v_order_item.quantity_approved <= 0 then
      raise exception using message = 'ORDER_NOT_ISSUABLE';
    end if;

    select coalesce(sum((issue ->> 'quantity')::numeric), 0)
    into v_item_issue_total
    from jsonb_array_elements(v_item_payload -> 'issues') issue;

    if v_item_issue_total <= 0 then
      raise exception using message = 'ISSUE_ITEMS_INVALID';
    end if;
    if coalesce(v_order_item.quantity_issued, 0) + v_item_issue_total
       > v_order_item.quantity_approved then
      raise exception using
        message = 'ORDER_ISSUE_EXCEEDS_APPROVED',
        detail = jsonb_build_object(
          'order_item_id', v_order_item.id,
          'quantity_approved', v_order_item.quantity_approved,
          'quantity_issued', v_order_item.quantity_issued,
          'requested_issue_quantity', v_item_issue_total
        )::text;
    end if;

    for v_issue_payload in
      select value from jsonb_array_elements(v_item_payload -> 'issues')
    loop
      if jsonb_typeof(v_issue_payload) <> 'object'
         or nullif(v_issue_payload ->> 'storage_location_id', '') is null then
        raise exception using message = 'ISSUE_ITEMS_INVALID';
      end if;
      v_location_id := (v_issue_payload ->> 'storage_location_id')::uuid;
      v_quantity := (v_issue_payload ->> 'quantity')::numeric;
      if v_quantity is null or v_quantity <= 0 then
        raise exception using message = 'ISSUE_ITEMS_INVALID';
      end if;

      select balance.id
      into v_balance_id
      from public.stock_balances balance
      join public.storage_locations location
        on location.id = balance.storage_location_id
       and location.area_id = balance.area_id
       and location.is_active = true
       and location.is_deleted = false
      where balance.supply_id = v_order_item.supply_id
        and balance.provider_id = v_order_item.provider_id
        and balance.area_id = v_order.from_area_id
        and balance.storage_location_id = v_location_id
        and balance.set_per_qty is null
        and balance.is_active = true
        and balance.is_deleted = false;

      if not found then
        raise exception using
          message = 'NORMAL_ISSUE_STOCK_CONFLICT',
          detail = jsonb_build_object(
            'order_item_id', v_order_item.id,
            'supply_code', v_order_item.supply_code,
            'provider_code', v_order_item.provider_code,
            'storage_location_id', v_location_id
          )::text;
      end if;

      v_plan := v_plan || jsonb_build_array(jsonb_build_object(
        'is_stack', false,
        'order_item_id', v_order_item.id,
        'stock_balance_id', v_balance_id,
        'set_per_qty', null,
        'stack_quantity', null,
        'quantity', v_quantity
      ));
    end loop;
  end loop;

  if jsonb_array_length(v_plan) = 0 then
    if v_pending_stack_count > 0 then
      raise exception using message = 'STACK_ISSUE_ALLOCATION_INCOMPLETE';
    end if;
    raise exception using message = 'ISSUE_ITEMS_INVALID';
  end if;

  select array_agg(target.stock_balance_id order by target.stock_balance_id)
  into v_balance_ids
  from (
    select distinct (entry ->> 'stock_balance_id')::uuid as stock_balance_id
    from jsonb_array_elements(v_plan) entry
  ) target;

  -- Every target balance, normal and Stack, is locked once in deterministic ID
  -- order before any balance mutation is performed.
  perform balance.id
  from public.stock_balances balance
  where balance.id = any(v_balance_ids)
  order by balance.id
  for update of balance;

  -- Validate aggregate demand per balance against the same locked snapshot.
  for v_demand in
    select
      (entry ->> 'stock_balance_id')::uuid as stock_balance_id,
      bool_or((entry ->> 'is_stack')::boolean) as is_stack,
      max(nullif(entry ->> 'set_per_qty', '')::numeric) as set_per_qty,
      sum(coalesce(nullif(entry ->> 'stack_quantity', '')::numeric, 0))
        as required_stack_quantity,
      sum((entry ->> 'quantity')::numeric) as required_quantity
    from jsonb_array_elements(v_plan) entry
    group by (entry ->> 'stock_balance_id')::uuid
    order by (entry ->> 'stock_balance_id')::uuid
  loop
    select balance.*
    into v_balance
    from public.stock_balances balance
    join public.storage_locations location
      on location.id = balance.storage_location_id
     and location.area_id = balance.area_id
     and location.is_active = true
     and location.is_deleted = false
    join public.supplies supply
      on supply.id = balance.supply_id
     and supply.is_active = true
     and supply.is_deleted = false
    join public.providers provider
      on provider.id = balance.provider_id
     and provider.is_active = true
     and provider.is_deleted = false
    where balance.id = v_demand.stock_balance_id
      and balance.area_id = v_order.from_area_id
      and balance.is_active = true
      and balance.is_deleted = false;

    if not found then
      raise exception using
        message = case when v_demand.is_stack
          then 'STACK_ISSUE_STOCK_CONFLICT'
          else 'NORMAL_ISSUE_STOCK_CONFLICT'
        end,
        detail = jsonb_build_object(
          'reason', 'SOURCE_BALANCE_INVALID',
          'stock_balance_id', v_demand.stock_balance_id
        )::text;
    end if;

    select location.code, supply.code, provider.code
    into v_location_code, v_supply_code, v_provider_code
    from public.storage_locations location
    join public.supplies supply on supply.id = v_balance.supply_id
    join public.providers provider on provider.id = v_balance.provider_id
    where location.id = v_balance.storage_location_id;

    if v_demand.is_stack then
      if v_balance.set_per_qty is distinct from v_demand.set_per_qty
         or v_balance.stack_quantity is null
         or v_balance.total_set_quantity is null
         or v_balance.quantity <> v_balance.total_set_quantity
         or v_balance.total_set_quantity <> v_balance.stack_quantity * v_balance.set_per_qty
         or v_balance.stack_quantity < v_demand.required_stack_quantity
         or v_balance.quantity < v_demand.required_quantity then
        raise exception using
          message = 'STACK_ISSUE_STOCK_CONFLICT',
          detail = jsonb_build_object(
            'stock_balance_id', v_balance.id,
            'supply_code', v_supply_code,
            'provider_code', v_provider_code,
            'location_code', v_location_code,
            'set_per_qty', v_demand.set_per_qty,
            'required_stack_quantity', v_demand.required_stack_quantity,
            'current_stack_quantity', v_balance.stack_quantity,
            'shortage_stack_quantity',
              greatest(v_demand.required_stack_quantity - coalesce(v_balance.stack_quantity, 0), 0)
          )::text;
      end if;
    elsif v_balance.set_per_qty is not null
       or v_balance.quantity < v_demand.required_quantity then
      raise exception using
        message = 'NORMAL_ISSUE_STOCK_CONFLICT',
        detail = jsonb_build_object(
          'stock_balance_id', v_balance.id,
          'supply_code', v_supply_code,
          'provider_code', v_provider_code,
          'location_code', v_location_code,
          'required_quantity', v_demand.required_quantity,
          'current_quantity', v_balance.quantity,
          'shortage_quantity',
            greatest(v_demand.required_quantity - v_balance.quantity, 0)
        )::text;
    end if;
  end loop;

  -- Mutate in the same balance/item order used for validation. Multiple
  -- allocations that reference one balance are aggregated before the update.
  for v_mutation in
    select
      (entry ->> 'stock_balance_id')::uuid as stock_balance_id,
      (entry ->> 'order_item_id')::uuid as order_item_id,
      bool_or((entry ->> 'is_stack')::boolean) as is_stack,
      max(nullif(entry ->> 'set_per_qty', '')::numeric) as set_per_qty,
      sum(coalesce(nullif(entry ->> 'stack_quantity', '')::numeric, 0))
        as stack_quantity,
      sum((entry ->> 'quantity')::numeric) as quantity
    from jsonb_array_elements(v_plan) entry
    group by
      (entry ->> 'stock_balance_id')::uuid,
      (entry ->> 'order_item_id')::uuid
    order by
      (entry ->> 'stock_balance_id')::uuid,
      (entry ->> 'order_item_id')::uuid
  loop
    select balance.*
    into v_balance
    from public.stock_balances balance
    where balance.id = v_mutation.stock_balance_id;

    v_before_quantity := v_balance.quantity;
    v_after_quantity := v_before_quantity - v_mutation.quantity;

    if v_mutation.is_stack then
      v_before_stack_quantity := v_balance.stack_quantity;
      v_after_stack_quantity := v_before_stack_quantity - v_mutation.stack_quantity;

      update public.stock_balances
      set quantity = v_after_quantity,
          stack_quantity = v_after_stack_quantity,
          total_set_quantity = v_after_quantity,
          updated_at = now()
      where id = v_balance.id;
    else
      v_before_stack_quantity := null;
      v_after_stack_quantity := null;

      update public.stock_balances
      set quantity = v_after_quantity,
          updated_at = now()
      where id = v_balance.id;
    end if;

    insert into public.stock_transactions (
      supply_id,
      provider_id,
      area_id,
      storage_location_id,
      order_id,
      order_item_id,
      transaction_type_id,
      quantity,
      before_quantity,
      after_quantity,
      set_per_qty,
      stack_quantity,
      before_stack_quantity,
      after_stack_quantity,
      reason_id,
      reason_note,
      reason,
      note,
      created_by,
      is_active,
      is_deleted
    )
    values (
      v_balance.supply_id,
      v_balance.provider_id,
      v_balance.area_id,
      v_balance.storage_location_id,
      p_order_id,
      v_mutation.order_item_id,
      v_issue_type_id,
      v_mutation.quantity,
      v_before_quantity,
      v_after_quantity,
      case when v_mutation.is_stack then v_mutation.set_per_qty else null end,
      case when v_mutation.is_stack then v_mutation.stack_quantity else null end,
      v_before_stack_quantity,
      v_after_stack_quantity,
      null,
      null,
      null,
      null,
      p_actor_id,
      true,
      false
    )
    returning id into v_transaction_id;

    v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
  end loop;

  for v_mutation in
    select
      (entry ->> 'order_item_id')::uuid as order_item_id,
      bool_or((entry ->> 'is_stack')::boolean) as is_stack,
      sum((entry ->> 'quantity')::numeric) as quantity
    from jsonb_array_elements(v_plan) entry
    group by (entry ->> 'order_item_id')::uuid
    order by (entry ->> 'order_item_id')::uuid
  loop
    if v_mutation.is_stack then
      update public.order_items
      set quantity_issued = v_mutation.quantity,
          updated_at = now()
      where id = v_mutation.order_item_id;
    else
      update public.order_items
      set quantity_issued = coalesce(quantity_issued, 0) + v_mutation.quantity,
          updated_at = now()
      where id = v_mutation.order_item_id;
    end if;
  end loop;

  if exists (
    select 1
    from public.order_items item
    where item.order_id = p_order_id
      and item.is_active = true
      and item.is_deleted = false
      and (
        item.quantity_approved is null
        or coalesce(item.quantity_issued, 0) < item.quantity_approved
      )
  ) then
    v_new_status_code := 'PARTIAL_ISSUED';
  else
    v_new_status_code := 'ISSUED';
  end if;

  select status.id
  into v_new_status_id
  from public.order_statuses status
  where status.code = v_new_status_code
    and status.is_active = true
    and status.is_deleted = false;

  if v_new_status_id is null then
    raise exception using message = 'ISSUE_LOOKUP_NOT_FOUND';
  end if;

  update public.orders
  set status_id = v_new_status_id,
      forklift_by = coalesce(p_forklift_by, forklift_by),
      taken_away_by = coalesce(p_taken_away_by, taken_away_by),
      issued_at = case
        when v_new_status_code = 'ISSUED' then now()
        else issued_at
      end,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_revisions (
    order_id,
    action_id,
    old_status_id,
    new_status_id,
    old_data,
    new_data,
    created_by
  )
  values (
    p_order_id,
    v_issue_action_id,
    v_order.status_id,
    v_new_status_id,
    jsonb_build_object('status_id', v_order.status_id),
    jsonb_build_object(
      'status_id', v_new_status_id,
      'transaction_ids', to_jsonb(v_transaction_ids),
      'stack_issue_source', 'CONFIRMED_ACTUAL_ALLOCATIONS'
    ),
    p_actor_id
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', v_new_status_code,
    'transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;

revoke all on function public.issue_order(uuid, uuid, jsonb, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.issue_order(uuid, uuid, jsonb, uuid, uuid)
to service_role;

comment on function public.issue_order(uuid, uuid, jsonb, uuid, uuid) is
  'Authoritative atomic Order Issue. KIEN_SAT_TC uses confirmed actual allocations; normal supplies retain client-directed issue quantities.';

commit;

-- Atomic issue operation for POST /orders/:id/issue.
-- A PostgreSQL function call is one database transaction: any exception rolls
-- back every balance update, transaction insert and order/item status update.

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
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_order_item public.order_items%rowtype;
  v_location public.storage_locations%rowtype;
  v_balance public.stock_balances%rowtype;
  v_actor_role public.role_name;
  v_item_payload jsonb;
  v_issue_payload jsonb;
  v_item_issue_total numeric;
  v_quantity numeric;
  v_before_quantity numeric;
  v_transaction_id uuid;
  v_transaction_ids uuid[] := array[]::uuid[];
  v_new_status public.order_status;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'items must contain at least one issue';
  end if;

  select r.role_name
    into v_actor_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_id
    and u.is_active = true;

  if not found or v_actor_role not in (
    'data Vật tư',
    'Tổ trưởng vật tư',
    'Material Control'
  ) then
    raise exception 'Actor is not allowed to issue stock';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status not in ('APPROVED', 'PARTIAL_ISSUED') then
    raise exception 'Order status % cannot be issued', v_order.status;
  end if;

  for v_item_payload in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item_payload) <> 'object'
       or nullif(v_item_payload ->> 'order_item_id', '') is null then
      raise exception 'order_item_id is required';
    end if;
    if jsonb_typeof(v_item_payload -> 'issues') <> 'array' then
      raise exception 'Each order item must contain issues';
    end if;
    if jsonb_array_length(v_item_payload -> 'issues') = 0 then
      raise exception 'Each order item must contain issues';
    end if;

    select *
      into v_order_item
    from public.order_items
    where id = (v_item_payload ->> 'order_item_id')::uuid
      and order_id = p_order_id
    for update;

    if not found then
      raise exception 'Order item not found in order';
    end if;
    if v_order_item.quantity_approved is null then
      raise exception 'Order item has not been approved';
    end if;

    select coalesce(sum((issue ->> 'quantity')::numeric), 0)
      into v_item_issue_total
    from jsonb_array_elements(v_item_payload -> 'issues') as issue;

    if v_item_issue_total <= 0 then
      raise exception 'Issue quantity must be greater than 0';
    end if;
    if coalesce(v_order_item.quantity_issued, 0) + v_item_issue_total
       > v_order_item.quantity_approved then
      raise exception 'Cannot issue more than quantity_approved for order item %',
        v_order_item.id;
    end if;

    for v_issue_payload in
      select value from jsonb_array_elements(v_item_payload -> 'issues')
    loop
      if jsonb_typeof(v_issue_payload) <> 'object'
         or nullif(v_issue_payload ->> 'storage_location_id', '') is null then
        raise exception 'storage_location_id is required';
      end if;

      v_quantity := (v_issue_payload ->> 'quantity')::numeric;
      if v_quantity is null or v_quantity <= 0 then
        raise exception 'Issue quantity must be greater than 0';
      end if;

      select *
        into v_location
      from public.storage_locations
      where id = (v_issue_payload ->> 'storage_location_id')::uuid
        and is_active = true;

      if not found then
        raise exception 'Storage location not found or inactive';
      end if;

      select *
        into v_balance
      from public.stock_balances
      where supply_id = v_order_item.supply_id
        and area_id = v_location.area_id
        and storage_location_id = v_location.id
      for update;

      if not found then
        raise exception 'Stock balance not found for supply and location';
      end if;
      if v_balance.quantity < v_quantity then
        raise exception 'Insufficient stock at location %', v_location.id;
      end if;

      v_before_quantity := v_balance.quantity;

      update public.stock_balances
      set quantity = v_before_quantity - v_quantity
      where id = v_balance.id;

      insert into public.stock_transactions (
        supply_id,
        area_id,
        storage_location_id,
        order_id,
        order_item_id,
        type,
        quantity,
        before_quantity,
        after_quantity,
        reason,
        note,
        created_by
      )
      values (
        v_order_item.supply_id,
        v_location.area_id,
        v_location.id,
        p_order_id,
        v_order_item.id,
        'ISSUE',
        v_quantity,
        v_before_quantity,
        v_before_quantity - v_quantity,
        null,
        null,
        p_actor_id
      )
      returning id into v_transaction_id;

      v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
    end loop;

    update public.order_items
    set quantity_issued = coalesce(quantity_issued, 0) + v_item_issue_total
    where id = v_order_item.id;
  end loop;

  if exists (
    select 1
    from public.order_items
    where order_id = p_order_id
      and (
        quantity_approved is null
        or coalesce(quantity_issued, 0) < quantity_approved
      )
  ) then
    v_new_status := 'PARTIAL_ISSUED';
  else
    v_new_status := 'ISSUED';
  end if;

  update public.orders
  set status = v_new_status,
      forklift_by = coalesce(p_forklift_by, forklift_by),
      taken_away_by = coalesce(p_taken_away_by, taken_away_by),
      issued_at = case when v_new_status = 'ISSUED' then now() else issued_at end
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'status', v_new_status,
    'transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;

revoke all on function public.issue_order(uuid, uuid, jsonb, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.issue_order(uuid, uuid, jsonb, uuid, uuid)
to service_role;

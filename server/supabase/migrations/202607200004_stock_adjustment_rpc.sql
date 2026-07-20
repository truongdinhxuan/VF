-- Atomic stock adjustment for POST /stock-adjustments.
-- Direct StockBalances mutation is intentionally not exposed by the API. This
-- function changes the balance and writes its immutable audit row in one
-- PostgreSQL transaction.

create or replace function public.apply_stock_adjustment(
  p_supply_id uuid,
  p_area_id uuid,
  p_storage_location_id uuid,
  p_type public.stock_transaction_type,
  p_quantity numeric,
  p_reason text,
  p_note text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.role_name;
  v_balance public.stock_balances%rowtype;
  v_transaction public.stock_transactions%rowtype;
  v_before_quantity numeric;
  v_after_quantity numeric;
begin
  if p_type not in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'IMPORT', 'EXPORT') then
    raise exception 'Unsupported stock adjustment type: %', p_type;
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Adjustment quantity must be greater than 0';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'reason is required for stock changes outside an order';
  end if;

  select r.role_name
    into v_actor_role
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_created_by
    and u.is_active = true
    and u.is_verified = true;

  if not found or v_actor_role not in ('data Vật tư', 'Tổ trưởng vật tư') then
    raise exception 'Actor is not allowed to adjust stock';
  end if;

  perform 1
  from public.supplies
  where id = p_supply_id
    and is_active = true
    and is_deleted = false;
  if not found then
    raise exception 'Supply not found or inactive';
  end if;

  perform 1
  from public.areas
  where id = p_area_id
    and is_active = true;
  if not found then
    raise exception 'Area not found or inactive';
  end if;

  perform 1
  from public.storage_locations
  where id = p_storage_location_id
    and area_id = p_area_id
    and is_active = true;
  if not found then
    raise exception 'Storage location not found, inactive, or outside area';
  end if;

  -- The unique key serializes concurrent creation of the same balance. The
  -- following SELECT FOR UPDATE serializes every subsequent quantity change.
  insert into public.stock_balances (
    supply_id,
    area_id,
    storage_location_id,
    quantity
  )
  values (
    p_supply_id,
    p_area_id,
    p_storage_location_id,
    0
  )
  on conflict (supply_id, area_id, storage_location_id) do nothing;

  select *
    into v_balance
  from public.stock_balances
  where supply_id = p_supply_id
    and area_id = p_area_id
    and storage_location_id = p_storage_location_id
  for update;

  if not found then
    raise exception 'Stock balance could not be initialized';
  end if;

  v_before_quantity := v_balance.quantity;
  if p_type in ('ADJUSTMENT_IN', 'IMPORT') then
    v_after_quantity := v_before_quantity + p_quantity;
  else
    if v_before_quantity < p_quantity then
      raise exception 'Insufficient stock: available %, requested %',
        v_before_quantity,
        p_quantity;
    end if;
    v_after_quantity := v_before_quantity - p_quantity;
  end if;

  update public.stock_balances
  set quantity = v_after_quantity
  where id = v_balance.id
  returning * into v_balance;

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
    p_supply_id,
    p_area_id,
    p_storage_location_id,
    null,
    null,
    p_type,
    p_quantity,
    v_before_quantity,
    v_after_quantity,
    btrim(p_reason),
    nullif(btrim(p_note), ''),
    p_created_by
  )
  returning * into v_transaction;

  return jsonb_build_object(
    'balance', to_jsonb(v_balance),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

revoke all on function public.apply_stock_adjustment(
  uuid, uuid, uuid, public.stock_transaction_type, numeric, text, text, uuid
)
from public, anon, authenticated;

grant execute on function public.apply_stock_adjustment(
  uuid, uuid, uuid, public.stock_transaction_type, numeric, text, text, uuid
)
to service_role;

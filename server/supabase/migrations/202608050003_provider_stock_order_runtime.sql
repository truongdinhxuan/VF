-- Provider-aware runtime functions for atomic Order and OrderItem writes.
-- Stock adjustment and issue_order are already provider-aware in
-- 202608050001_provider_foundation.sql and are intentionally not redefined.

begin;

-- Phase 2 used these compatibility triggers while runtime payloads did not
-- yet carry provider_id. Phase 5 requires an explicit Provider; the columns
-- are already NOT NULL, so missing values must now fail instead of silently
-- becoming UNKNOW.
drop trigger if exists stock_balances_assign_unknown_provider
  on public.stock_balances;
drop trigger if exists order_items_assign_unknown_provider
  on public.order_items;
drop trigger if exists stock_transactions_assign_unknown_provider
  on public.stock_transactions;

create or replace function public.create_order_with_items(
  p_code text,
  p_from_area_id uuid,
  p_to_area_id uuid,
  p_requested_by uuid,
  p_status_id uuid,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_supply_id uuid;
  v_provider_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'order_list must contain at least one item';
  end if;

  insert into public.orders (
    code,
    from_area_id,
    to_area_id,
    requested_by,
    status_id,
    note,
    is_active,
    is_deleted
  )
  values (
    p_code,
    p_from_area_id,
    p_to_area_id,
    p_requested_by,
    p_status_id,
    nullif(btrim(p_note), ''),
    true,
    false
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or nullif(v_item ->> 'supply_id', '') is null
       or nullif(v_item ->> 'provider_id', '') is null
       or nullif(v_item ->> 'unit_id', '') is null then
      raise exception 'supply_id, provider_id and unit_id are required for every OrderItem';
    end if;

    v_supply_id := (v_item ->> 'supply_id')::uuid;
    v_provider_id := (v_item ->> 'provider_id')::uuid;
    v_unit_id := (v_item ->> 'unit_id')::uuid;
    v_quantity := (v_item ->> 'quantity_requested')::numeric;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'quantity_requested must be greater than 0';
    end if;

    if not exists (
      select 1
      from public.supply_providers sp
      join public.supplies s on s.id = sp.supply_id
      join public.providers p on p.id = sp.provider_id
      join public.units u on u.id = v_unit_id
      where sp.supply_id = v_supply_id
        and sp.provider_id = v_provider_id
        and sp.is_active = true
        and sp.is_deleted = false
        and s.is_active = true
        and s.is_deleted = false
        and s.unit_id = v_unit_id
        and p.is_active = true
        and p.is_deleted = false
        and u.is_active = true
        and u.is_deleted = false
    ) then
      raise exception 'Provider is inactive or is not linked to the active Supply and Unit';
    end if;

    insert into public.order_items (
      order_id,
      supply_id,
      provider_id,
      unit_id,
      quantity_requested,
      quantity_approved,
      quantity_issued,
      note,
      is_active,
      is_deleted
    )
    values (
      v_order_id,
      v_supply_id,
      v_provider_id,
      v_unit_id,
      v_quantity,
      0,
      0,
      nullif(btrim(v_item ->> 'note'), ''),
      true,
      false
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_order_with_items(
  text, uuid, uuid, uuid, uuid, text, jsonb
)
from public, anon, authenticated;

grant execute on function public.create_order_with_items(
  text, uuid, uuid, uuid, uuid, text, jsonb
)
to service_role;

create or replace function public.replace_order_items_with_providers(
  p_order_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_supply_id uuid;
  v_provider_id uuid;
  v_unit_id uuid;
  v_quantity numeric;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'order_list must contain at least one item';
  end if;

  perform 1
  from public.orders
  where id = p_order_id
    and is_deleted = false
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- Validate the complete replacement set before changing current rows.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or nullif(v_item ->> 'supply_id', '') is null
       or nullif(v_item ->> 'provider_id', '') is null
       or nullif(v_item ->> 'unit_id', '') is null then
      raise exception 'supply_id, provider_id and unit_id are required for every OrderItem';
    end if;

    v_supply_id := (v_item ->> 'supply_id')::uuid;
    v_provider_id := (v_item ->> 'provider_id')::uuid;
    v_unit_id := (v_item ->> 'unit_id')::uuid;
    v_quantity := (v_item ->> 'quantity_requested')::numeric;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'quantity_requested must be greater than 0';
    end if;

    if not exists (
      select 1
      from public.supply_providers sp
      join public.supplies s on s.id = sp.supply_id
      join public.providers p on p.id = sp.provider_id
      join public.units u on u.id = v_unit_id
      where sp.supply_id = v_supply_id
        and sp.provider_id = v_provider_id
        and sp.is_active = true
        and sp.is_deleted = false
        and s.is_active = true
        and s.is_deleted = false
        and s.unit_id = v_unit_id
        and p.is_active = true
        and p.is_deleted = false
        and u.is_active = true
        and u.is_deleted = false
    ) then
      raise exception 'Provider is inactive or is not linked to the active Supply and Unit';
    end if;
  end loop;

  delete from public.order_items
  where order_id = p_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      supply_id,
      provider_id,
      unit_id,
      quantity_requested,
      quantity_approved,
      quantity_issued,
      note,
      is_active,
      is_deleted
    )
    values (
      p_order_id,
      (v_item ->> 'supply_id')::uuid,
      (v_item ->> 'provider_id')::uuid,
      (v_item ->> 'unit_id')::uuid,
      (v_item ->> 'quantity_requested')::numeric,
      0,
      0,
      nullif(btrim(v_item ->> 'note'), ''),
      true,
      false
    );
  end loop;

  return p_order_id;
end;
$$;

revoke all on function public.replace_order_items_with_providers(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.replace_order_items_with_providers(uuid, jsonb)
to service_role;

commit;

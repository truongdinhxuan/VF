begin;

-- Supply Stack-Based Inventory, Phase 3: Create Order Stack Mode.
-- Depends on the Phase 1 order_items stack columns and Phase 2 stack balances.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'requested_stack_quantity'
  ) then
    raise exception 'Supply stack Phase 1 migration must be applied before Phase 3';
  end if;
end
$$;

create or replace function public.get_supply_stack_options(
  p_supply_id uuid,
  p_provider_id uuid,
  p_area_id uuid
)
returns table (
  set_per_qty numeric,
  available_stack_quantity numeric,
  available_total_set_quantity numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_code text;
begin
  select sc.code
  into v_category_code
  from public.supplies s
  join public.supply_categories sc on sc.id = s.category_id
  where s.id = p_supply_id
    and s.is_active = true
    and s.is_deleted = false
    and sc.is_active = true
    and sc.is_deleted = false;

  if not found then
    raise exception 'Supply not found or inactive';
  end if;

  if v_category_code <> 'KIEN_SAT_TC' then
    raise exception 'Stack options are only available for KIEN_SAT_TC';
  end if;

  if not exists (
    select 1
    from public.supply_providers sp
    join public.providers p on p.id = sp.provider_id
    where sp.supply_id = p_supply_id
      and sp.provider_id = p_provider_id
      and sp.is_active = true
      and sp.is_deleted = false
      and p.is_active = true
      and p.is_deleted = false
  ) then
    raise exception 'Provider is inactive or is not linked to Supply';
  end if;

  if not exists (
    select 1
    from public.areas a
    where a.id = p_area_id
      and a.is_active = true
      and a.is_deleted = false
  ) then
    raise exception 'Area not found or inactive';
  end if;

  return query
  select
    sb.set_per_qty,
    sum(sb.stack_quantity) as available_stack_quantity,
    sum(sb.stack_quantity) * sb.set_per_qty as available_total_set_quantity
  from public.stock_balances sb
  join public.storage_locations sl
    on sl.id = sb.storage_location_id
   and sl.area_id = sb.area_id
   and sl.is_active = true
   and sl.is_deleted = false
  where sb.supply_id = p_supply_id
    and sb.provider_id = p_provider_id
    and sb.area_id = p_area_id
    and sb.is_active = true
    and sb.is_deleted = false
    and sb.set_per_qty is not null
    and sb.stack_quantity > 0
  group by sb.set_per_qty
  order by sb.set_per_qty desc;
end;
$$;

revoke all on function public.get_supply_stack_options(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.get_supply_stack_options(uuid, uuid, uuid)
to service_role;

-- Shared authoritative validator/normalizer used by both create and replace.
-- It branches by the SupplyCategory code, never by a Supply code or UUID.
create or replace function public.normalize_order_item_request(
  p_item jsonb,
  p_from_area_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supply_id uuid;
  v_provider_id uuid;
  v_unit_id uuid;
  v_supply_unit_id uuid;
  v_category_code text;
  v_quantity numeric;
  v_set_per_qty numeric;
  v_requested_stack_quantity numeric;
  v_requested_total_set_quantity numeric;
  v_calculated_total numeric;
begin
  if jsonb_typeof(p_item) <> 'object'
     or nullif(p_item ->> 'supply_id', '') is null
     or nullif(p_item ->> 'provider_id', '') is null then
    raise exception 'supply_id and provider_id are required for every OrderItem';
  end if;

  v_supply_id := (p_item ->> 'supply_id')::uuid;
  v_provider_id := (p_item ->> 'provider_id')::uuid;
  v_unit_id := nullif(p_item ->> 'unit_id', '')::uuid;

  select s.unit_id, sc.code
  into v_supply_unit_id, v_category_code
  from public.supplies s
  join public.supply_categories sc on sc.id = s.category_id
  where s.id = v_supply_id
    and s.is_active = true
    and s.is_deleted = false
    and sc.is_active = true
    and sc.is_deleted = false;

  if not found then
    raise exception 'Supply not found or inactive';
  end if;

  if v_unit_id is null then
    v_unit_id := v_supply_unit_id;
  end if;

  if v_unit_id <> v_supply_unit_id or not exists (
    select 1
    from public.units u
    where u.id = v_unit_id
      and u.is_active = true
      and u.is_deleted = false
  ) then
    raise exception 'Unit is inactive or does not belong to Supply';
  end if;

  if not exists (
    select 1
    from public.supply_providers sp
    join public.providers p on p.id = sp.provider_id
    where sp.supply_id = v_supply_id
      and sp.provider_id = v_provider_id
      and sp.is_active = true
      and sp.is_deleted = false
      and p.is_active = true
      and p.is_deleted = false
  ) then
    raise exception 'Provider is inactive or is not linked to Supply';
  end if;

  if v_category_code = 'KIEN_SAT_TC' then
    v_set_per_qty := nullif(p_item ->> 'set_per_qty', '')::numeric;
    v_requested_stack_quantity :=
      nullif(p_item ->> 'requested_stack_quantity', '')::numeric;

    if v_set_per_qty is null or v_set_per_qty <= 0 then
      raise exception 'set_per_qty must be greater than 0 for KIEN_SAT_TC';
    end if;
    if v_requested_stack_quantity is null or v_requested_stack_quantity <= 0 then
      raise exception 'requested_stack_quantity must be greater than 0 for KIEN_SAT_TC';
    end if;

    v_calculated_total := v_set_per_qty * v_requested_stack_quantity;
    v_quantity := nullif(p_item ->> 'quantity_requested', '')::numeric;
    v_requested_total_set_quantity :=
      nullif(p_item ->> 'requested_total_set_quantity', '')::numeric;

    if v_quantity is not null and v_quantity <> v_calculated_total then
      raise exception 'quantity_requested mismatch: expected %', v_calculated_total;
    end if;
    if v_requested_total_set_quantity is not null
       and v_requested_total_set_quantity <> v_calculated_total then
      raise exception 'requested_total_set_quantity mismatch: expected %', v_calculated_total;
    end if;

    if not exists (
      select 1
      from public.stock_balances sb
      join public.storage_locations sl
        on sl.id = sb.storage_location_id
       and sl.area_id = sb.area_id
       and sl.is_active = true
       and sl.is_deleted = false
      where sb.supply_id = v_supply_id
        and sb.provider_id = v_provider_id
        and sb.area_id = p_from_area_id
        and sb.set_per_qty = v_set_per_qty
        and sb.stack_quantity > 0
        and sb.is_active = true
        and sb.is_deleted = false
    ) then
      raise exception 'Selected set_per_qty is not available for Supply, Provider and source Area';
    end if;

    v_quantity := v_calculated_total;
    v_requested_total_set_quantity := v_calculated_total;
  else
    if (p_item ? 'set_per_qty' and p_item -> 'set_per_qty' <> 'null'::jsonb)
       or (p_item ? 'requested_stack_quantity'
           and p_item -> 'requested_stack_quantity' <> 'null'::jsonb)
       or (p_item ? 'requested_total_set_quantity'
           and p_item -> 'requested_total_set_quantity' <> 'null'::jsonb) then
      raise exception 'Stack fields are only allowed for KIEN_SAT_TC';
    end if;

    v_quantity := nullif(p_item ->> 'quantity_requested', '')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'quantity_requested must be greater than 0';
    end if;
    v_set_per_qty := null;
    v_requested_stack_quantity := null;
    v_requested_total_set_quantity := null;
  end if;

  return jsonb_build_object(
    'supply_id', v_supply_id,
    'provider_id', v_provider_id,
    'unit_id', v_unit_id,
    'quantity_requested', v_quantity,
    'set_per_qty', v_set_per_qty,
    'requested_stack_quantity', v_requested_stack_quantity,
    'requested_total_set_quantity', v_requested_total_set_quantity,
    'note', nullif(btrim(p_item ->> 'note'), '')
  );
end;
$$;

revoke all on function public.normalize_order_item_request(jsonb, uuid)
from public, anon, authenticated;

grant execute on function public.normalize_order_item_request(jsonb, uuid)
to service_role;

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
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_normalized_item jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'order_list must contain at least one item';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_normalized_item := public.normalize_order_item_request(v_item, p_from_area_id);
    v_normalized_items := v_normalized_items || jsonb_build_array(v_normalized_item);
  end loop;

  insert into public.orders (
    code, from_area_id, to_area_id, requested_by, status_id, note,
    is_active, is_deleted
  )
  values (
    p_code, p_from_area_id, p_to_area_id, p_requested_by, p_status_id,
    nullif(btrim(p_note), ''), true, false
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(v_normalized_items)
  loop
    insert into public.order_items (
      order_id, supply_id, provider_id, unit_id,
      quantity_requested, set_per_qty, requested_stack_quantity,
      requested_total_set_quantity, quantity_approved, quantity_issued,
      note, is_active, is_deleted
    )
    values (
      v_order_id,
      (v_item ->> 'supply_id')::uuid,
      (v_item ->> 'provider_id')::uuid,
      (v_item ->> 'unit_id')::uuid,
      (v_item ->> 'quantity_requested')::numeric,
      nullif(v_item ->> 'set_per_qty', '')::numeric,
      nullif(v_item ->> 'requested_stack_quantity', '')::numeric,
      nullif(v_item ->> 'requested_total_set_quantity', '')::numeric,
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
set search_path = ''
as $$
declare
  v_from_area_id uuid;
  v_item jsonb;
  v_normalized_item jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'order_list must contain at least one item';
  end if;

  select o.from_area_id
  into v_from_area_id
  from public.orders o
  where o.id = p_order_id
    and o.is_deleted = false
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_normalized_item := public.normalize_order_item_request(v_item, v_from_area_id);
    v_normalized_items := v_normalized_items || jsonb_build_array(v_normalized_item);
  end loop;

  delete from public.order_items
  where order_id = p_order_id;

  for v_item in select value from jsonb_array_elements(v_normalized_items)
  loop
    insert into public.order_items (
      order_id, supply_id, provider_id, unit_id,
      quantity_requested, set_per_qty, requested_stack_quantity,
      requested_total_set_quantity, quantity_approved, quantity_issued,
      note, is_active, is_deleted
    )
    values (
      p_order_id,
      (v_item ->> 'supply_id')::uuid,
      (v_item ->> 'provider_id')::uuid,
      (v_item ->> 'unit_id')::uuid,
      (v_item ->> 'quantity_requested')::numeric,
      nullif(v_item ->> 'set_per_qty', '')::numeric,
      nullif(v_item ->> 'requested_stack_quantity', '')::numeric,
      nullif(v_item ->> 'requested_total_set_quantity', '')::numeric,
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

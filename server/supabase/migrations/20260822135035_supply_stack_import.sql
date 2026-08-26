begin;

-- Supply Stack-Based Inventory, Phase 2: KIEN_SAT_TC IMPORT only.
-- This migration depends on 20260822131844_supply_stack_foundation.sql.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_balances'
      and column_name = 'set_per_qty'
  ) then
    raise exception 'Supply stack Phase 1 migration must be applied before Phase 2';
  end if;
end
$$;

alter table public.stock_transactions
  add column set_per_qty numeric,
  add column stack_quantity numeric,
  add column before_stack_quantity numeric,
  add column after_stack_quantity numeric;

alter table public.stock_transactions
  add constraint stock_transactions_stack_metadata_consistent check (
    (
      set_per_qty is null
      and stack_quantity is null
      and before_stack_quantity is null
      and after_stack_quantity is null
    )
    or
    (
      set_per_qty is not null
      and stack_quantity is not null
      and before_stack_quantity is not null
      and after_stack_quantity is not null
      and set_per_qty > 0
      and stack_quantity > 0
      and before_stack_quantity >= 0
      and after_stack_quantity >= 0
      and quantity = stack_quantity * set_per_qty
    )
  );

create index stock_transactions_stack_lookup_idx
  on public.stock_transactions (
    supply_id,
    provider_id,
    area_id,
    storage_location_id,
    set_per_qty,
    created_at desc
  )
  where set_per_qty is not null;

comment on column public.stock_transactions.set_per_qty is
  'Dynamic SET count per stack for stack-mode transactions; NULL for normal and historical rows.';
comment on column public.stock_transactions.stack_quantity is
  'Positive stack-count delta for this transaction; transaction.quantity stores the total SET delta.';
comment on column public.stock_transactions.before_stack_quantity is
  'Stack count before this transaction; NULL for normal and historical rows.';
comment on column public.stock_transactions.after_stack_quantity is
  'Stack count after this transaction; NULL for normal and historical rows.';

create or replace function public.apply_stock_adjustment_v4(
  p_supply_id uuid,
  p_provider_id uuid,
  p_area_id uuid,
  p_storage_location_id uuid,
  p_transaction_type_id uuid,
  p_quantity numeric,
  p_stack_quantity numeric,
  p_set_per_qty numeric,
  p_adjustment_reason_id uuid,
  p_reason_note text,
  p_note text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.stock_transaction_types%rowtype;
  v_reason public.adjustment_reasons%rowtype;
  v_balance public.stock_balances%rowtype;
  v_transaction public.stock_transactions%rowtype;
  v_category_code text;
  v_is_stack_supply boolean;
  v_delta_quantity numeric;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_stack_quantity numeric;
  v_after_stack_quantity numeric;
begin
  if not public.has_permission(p_created_by, 'supply.stock.adjust') then
    raise exception 'Actor does not have supply.stock.adjust';
  end if;

  select stt.*
  into v_type
  from public.stock_transaction_types stt
  where stt.id = p_transaction_type_id
    and stt.code in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'IMPORT', 'EXPORT')
    and stt.is_active = true
    and stt.is_deleted = false;

  if not found then
    raise exception 'Transaction type invalid';
  end if;

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
    raise exception 'Supply not found';
  end if;

  v_is_stack_supply := v_category_code = 'KIEN_SAT_TC';

  if v_is_stack_supply then
    if v_type.code <> 'IMPORT' then
      raise exception 'Stack operation not supported for this transaction type';
    end if;
    if v_type.effect <> 'INCREASE' then
      raise exception 'Transaction type invalid for Stack IMPORT';
    end if;
    if p_stack_quantity is null or p_stack_quantity <= 0 then
      raise exception 'Invalid stack_quantity';
    end if;
    if p_set_per_qty is null or p_set_per_qty <= 0 then
      raise exception 'Invalid set_per_qty';
    end if;

    v_delta_quantity := p_stack_quantity * p_set_per_qty;
    if p_quantity is not null and p_quantity <> v_delta_quantity then
      raise exception 'Quantity mismatch: expected %', v_delta_quantity;
    end if;
  else
    if p_stack_quantity is not null or p_set_per_qty is not null then
      raise exception 'Stack fields are only supported for KIEN_SAT_TC IMPORT';
    end if;
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'quantity must be greater than 0';
    end if;
    v_delta_quantity := p_quantity;
  end if;

  if p_provider_id is null or not exists (
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
    raise exception 'Provider not valid for Supply';
  end if;

  if not exists (
    select 1
    from public.storage_locations l
    join public.areas a on a.id = l.area_id
    where l.id = p_storage_location_id
      and l.area_id = p_area_id
      and l.is_active = true
      and l.is_deleted = false
      and a.is_active = true
      and a.is_deleted = false
  ) then
    raise exception 'StorageLocation not in Area';
  end if;

  if p_adjustment_reason_id is not null then
    select ar.*
    into v_reason
    from public.adjustment_reasons ar
    where ar.id = p_adjustment_reason_id
      and ar.is_active = true
      and ar.is_deleted = false;

    if not found then
      raise exception 'adjustment_reason_id does not exist or is inactive';
    end if;

    if v_reason.requires_note and nullif(btrim(p_reason_note), '') is null then
      raise exception 'reason_note is required for this reason';
    end if;
  elsif nullif(btrim(p_reason_note), '') is null then
    raise exception 'adjustment_reason_id or reason_note is required';
  end if;

  if v_is_stack_supply then
    -- Concurrent inserts of the same stack dimension serialize on the Phase 1
    -- partial unique index. The subsequent SELECT locks the authoritative row.
    insert into public.stock_balances (
      supply_id,
      provider_id,
      area_id,
      storage_location_id,
      quantity,
      set_per_qty,
      stack_quantity,
      total_set_quantity,
      is_active,
      is_deleted
    )
    values (
      p_supply_id,
      p_provider_id,
      p_area_id,
      p_storage_location_id,
      0,
      p_set_per_qty,
      0,
      0,
      true,
      false
    )
    on conflict (
      supply_id,
      provider_id,
      area_id,
      storage_location_id,
      set_per_qty
    )
    where set_per_qty is not null and is_deleted = false
    do nothing;

    select sb.*
    into v_balance
    from public.stock_balances sb
    where sb.supply_id = p_supply_id
      and sb.provider_id = p_provider_id
      and sb.area_id = p_area_id
      and sb.storage_location_id = p_storage_location_id
      and sb.set_per_qty = p_set_per_qty
      and sb.is_deleted = false
    for update;

    if not found then
      raise exception 'Stack balance not found after upsert';
    end if;

    v_before_stack_quantity := v_balance.stack_quantity;
    v_after_stack_quantity := v_before_stack_quantity + p_stack_quantity;
    v_before_quantity := v_balance.quantity;
    v_after_quantity := v_after_stack_quantity * p_set_per_qty;

    update public.stock_balances
    set stack_quantity = v_after_stack_quantity,
        total_set_quantity = v_after_quantity,
        quantity = v_after_quantity,
        is_active = true
    where id = v_balance.id
    returning * into v_balance;
  else
    if v_type.effect = 'INCREASE' then
      insert into public.stock_balances (
        supply_id,
        provider_id,
        area_id,
        storage_location_id,
        quantity,
        is_active,
        is_deleted
      )
      values (
        p_supply_id,
        p_provider_id,
        p_area_id,
        p_storage_location_id,
        0,
        true,
        false
      )
      on conflict (supply_id, provider_id, area_id, storage_location_id)
      where set_per_qty is null and is_deleted = false
      do update set is_active = true, is_deleted = false;
    end if;

    select sb.*
    into v_balance
    from public.stock_balances sb
    where sb.supply_id = p_supply_id
      and sb.provider_id = p_provider_id
      and sb.area_id = p_area_id
      and sb.storage_location_id = p_storage_location_id
      and sb.set_per_qty is null
      and sb.is_deleted = false
    for update;

    if not found then
      raise exception 'Stock balance not found';
    end if;

    v_before_quantity := v_balance.quantity;
    if v_type.effect = 'INCREASE' then
      v_after_quantity := v_before_quantity + v_delta_quantity;
    elsif v_type.effect = 'DECREASE' then
      if v_before_quantity < v_delta_quantity then
        raise exception 'Insufficient stock';
      end if;
      v_after_quantity := v_before_quantity - v_delta_quantity;
    else
      raise exception 'Neutral transaction type cannot adjust a balance';
    end if;

    update public.stock_balances
    set quantity = v_after_quantity
    where id = v_balance.id
    returning * into v_balance;

    v_before_stack_quantity := null;
    v_after_stack_quantity := null;
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
    created_by
  )
  values (
    p_supply_id,
    p_provider_id,
    p_area_id,
    p_storage_location_id,
    null,
    null,
    p_transaction_type_id,
    v_delta_quantity,
    v_before_quantity,
    v_after_quantity,
    case when v_is_stack_supply then p_set_per_qty else null end,
    case when v_is_stack_supply then p_stack_quantity else null end,
    v_before_stack_quantity,
    v_after_stack_quantity,
    p_adjustment_reason_id,
    nullif(btrim(p_reason_note), ''),
    nullif(btrim(p_reason_note), ''),
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

revoke all on function public.apply_stock_adjustment_v4(
  uuid, uuid, uuid, uuid, uuid, numeric, numeric, numeric,
  uuid, text, text, uuid
)
from public, anon, authenticated;

grant execute on function public.apply_stock_adjustment_v4(
  uuid, uuid, uuid, uuid, uuid, numeric, numeric, numeric,
  uuid, text, text, uuid
)
to service_role;

commit;

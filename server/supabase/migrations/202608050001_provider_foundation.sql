-- Provider foundation and provider-scoped inventory relationships.
--
-- This is a forward-only migration. It keeps the current application working
-- while Phase 3 adds explicit provider selection by assigning the database
-- master record UNKNOW whenever legacy inserts omit provider_id.

begin;

create extension if not exists pgcrypto;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint providers_code_key unique (code)
);

create index if not exists providers_active_deleted_idx
  on public.providers(is_active, is_deleted);

drop trigger if exists providers_set_updated_at on public.providers;
create trigger providers_set_updated_at
before update on public.providers
for each row execute function public.set_updated_at();

insert into public.providers (
  code,
  name,
  description,
  is_active,
  is_deleted
)
values (
  'UNKNOW',
  'Chưa rõ',
  'Provider mặc định khi chưa xác định được nhà cung cấp.',
  true,
  false
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  is_deleted = false;

create table if not exists public.supply_providers (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null,
  provider_id uuid not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_providers_supply_id_fkey
    foreign key (supply_id) references public.supplies(id)
    on delete cascade on update cascade,
  constraint supply_providers_provider_id_fkey
    foreign key (provider_id) references public.providers(id)
    on delete restrict on update cascade,
  constraint supply_providers_supply_provider_key
    unique (supply_id, provider_id)
);

-- The unique constraint already indexes supply_id as its leading column.
create index if not exists supply_providers_provider_id_idx
  on public.supply_providers(provider_id);

drop trigger if exists supply_providers_set_updated_at
  on public.supply_providers;
create trigger supply_providers_set_updated_at
before update on public.supply_providers
for each row execute function public.set_updated_at();

-- Every existing supply receives the default relation without changing the
-- supply row or duplicating a relation that may already exist.
insert into public.supply_providers (
  supply_id,
  provider_id,
  is_active,
  is_deleted
)
select
  s.id,
  p.id,
  true,
  false
from public.supplies s
cross join public.providers p
where p.code = 'UNKNOW'
on conflict (supply_id, provider_id) do update
set is_active = true, is_deleted = false;

create or replace function public.unknown_provider_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.providers
  where code = 'UNKNOW'
  limit 1
$$;

revoke all on function public.unknown_provider_id()
from public, anon, authenticated;
grant execute on function public.unknown_provider_id()
to service_role;

create or replace function public.ensure_default_supply_provider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
begin
  v_provider_id := public.unknown_provider_id();
  if v_provider_id is null then
    raise exception 'Required provider UNKNOW is missing';
  end if;

  insert into public.supply_providers (
    supply_id,
    provider_id,
    is_active,
    is_deleted
  )
  values (new.id, v_provider_id, true, false)
  on conflict (supply_id, provider_id) do update
  set is_active = true, is_deleted = false;

  return new;
end;
$$;

revoke all on function public.ensure_default_supply_provider()
from public, anon, authenticated;
grant execute on function public.ensure_default_supply_provider()
to service_role;

drop trigger if exists supplies_ensure_default_provider on public.supplies;
create trigger supplies_ensure_default_provider
after insert on public.supplies
for each row execute function public.ensure_default_supply_provider();

alter table public.stock_balances
  add column if not exists provider_id uuid;
alter table public.order_items
  add column if not exists provider_id uuid;
alter table public.stock_transactions
  add column if not exists provider_id uuid;

-- Preserve the historical updated_at values during the one-time backfill.
drop trigger if exists stock_balances_set_updated_at
  on public.stock_balances;
drop trigger if exists order_items_set_updated_at
  on public.order_items;

update public.stock_balances
set provider_id = public.unknown_provider_id()
where provider_id is null;

update public.order_items
set provider_id = public.unknown_provider_id()
where provider_id is null;

-- StockTransactions is immutable at runtime. Temporarily remove only its
-- UPDATE guard for this one-time schema backfill, then restore it below.
drop trigger if exists stock_transactions_prevent_update
  on public.stock_transactions;

update public.stock_transactions
set provider_id = public.unknown_provider_id()
where provider_id is null;

do $$
begin
  if public.unknown_provider_id() is null then
    raise exception 'Provider UNKNOW was not seeded';
  end if;

  if exists (select 1 from public.stock_balances where provider_id is null) then
    raise exception 'stock_balances.provider_id backfill is incomplete';
  end if;
  if exists (select 1 from public.order_items where provider_id is null) then
    raise exception 'order_items.provider_id backfill is incomplete';
  end if;
  if exists (select 1 from public.stock_transactions where provider_id is null) then
    raise exception 'stock_transactions.provider_id backfill is incomplete';
  end if;
end
$$;

alter table public.stock_balances
  alter column provider_id set not null;
alter table public.order_items
  alter column provider_id set not null;
alter table public.stock_transactions
  alter column provider_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_balances'::regclass
      and conname = 'stock_balances_provider_id_fkey'
  ) then
    alter table public.stock_balances
      add constraint stock_balances_provider_id_fkey
      foreign key (provider_id) references public.providers(id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_provider_id_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_provider_id_fkey
      foreign key (provider_id) references public.providers(id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_transactions'::regclass
      and conname = 'stock_transactions_provider_id_fkey'
  ) then
    alter table public.stock_transactions
      add constraint stock_transactions_provider_id_fkey
      foreign key (provider_id) references public.providers(id)
      on delete restrict on update cascade;
  end if;
end
$$;

-- These composite foreign keys prevent an OrderItem, StockBalance, or
-- StockTransaction from naming a Provider that is unrelated to its Supply.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_balances'::regclass
      and conname = 'stock_balances_supply_provider_fkey'
  ) then
    alter table public.stock_balances
      add constraint stock_balances_supply_provider_fkey
      foreign key (supply_id, provider_id)
      references public.supply_providers(supply_id, provider_id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_supply_provider_fkey'
  ) then
    alter table public.order_items
      add constraint order_items_supply_provider_fkey
      foreign key (supply_id, provider_id)
      references public.supply_providers(supply_id, provider_id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_transactions'::regclass
      and conname = 'stock_transactions_supply_provider_fkey'
  ) then
    alter table public.stock_transactions
      add constraint stock_transactions_supply_provider_fkey
      foreign key (supply_id, provider_id)
      references public.supply_providers(supply_id, provider_id)
      on delete restrict on update cascade;
  end if;
end
$$;

alter table public.stock_balances
  drop constraint if exists stock_balances_supply_area_location_key;
drop index if exists public.stock_balances_supply_area_location_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_balances'::regclass
      and conname = 'stock_balances_supply_provider_area_location_key'
  ) then
    alter table public.stock_balances
      add constraint stock_balances_supply_provider_area_location_key
      unique (supply_id, provider_id, area_id, storage_location_id);
  end if;
end
$$;

create index if not exists stock_balances_provider_id_idx
  on public.stock_balances(provider_id);
create index if not exists order_items_provider_id_idx
  on public.order_items(provider_id);
create index if not exists stock_transactions_provider_id_idx
  on public.stock_transactions(provider_id);

create or replace function public.assign_unknown_provider_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.provider_id is null then
    new.provider_id := public.unknown_provider_id();
  end if;
  if new.provider_id is null then
    raise exception 'provider_id is required and Provider UNKNOW is missing';
  end if;
  return new;
end;
$$;

revoke all on function public.assign_unknown_provider_id()
from public, anon, authenticated;
grant execute on function public.assign_unknown_provider_id()
to service_role;

drop trigger if exists stock_balances_assign_unknown_provider
  on public.stock_balances;
create trigger stock_balances_assign_unknown_provider
before insert on public.stock_balances
for each row execute function public.assign_unknown_provider_id();

drop trigger if exists order_items_assign_unknown_provider
  on public.order_items;
create trigger order_items_assign_unknown_provider
before insert on public.order_items
for each row execute function public.assign_unknown_provider_id();

drop trigger if exists stock_transactions_assign_unknown_provider
  on public.stock_transactions;
create trigger stock_transactions_assign_unknown_provider
before insert on public.stock_transactions
for each row execute function public.assign_unknown_provider_id();

create trigger stock_transactions_prevent_update
before update on public.stock_transactions
for each row execute function public.prevent_stock_transaction_mutation();

create trigger stock_balances_set_updated_at
before update on public.stock_balances
for each row execute function public.set_updated_at();

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

-- Provider-aware stock adjustment function for Phase 3. The v2 compatibility
-- wrapper below keeps the current application operational by selecting UNKNOW.
create or replace function public.apply_stock_adjustment_v3(
  p_supply_id uuid,
  p_provider_id uuid,
  p_area_id uuid,
  p_storage_location_id uuid,
  p_transaction_type_id uuid,
  p_quantity numeric,
  p_adjustment_reason_id uuid,
  p_reason_note text,
  p_note text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role_code text;
  v_type public.stock_transaction_types%rowtype;
  v_reason public.adjustment_reasons%rowtype;
  v_balance public.stock_balances%rowtype;
  v_before numeric;
  v_after numeric;
  v_transaction public.stock_transactions%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than 0';
  end if;
  if p_provider_id is null then
    raise exception 'provider_id is required';
  end if;

  select r.code
  into v_actor_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_created_by
    and u.is_active = true
    and u.is_verified = true
    and u.is_deleted = false
    and r.is_active = true
    and r.is_deleted = false;

  if not found or v_actor_role_code not in (
    'ADMIN',
    'DATA_MATERIAL',
    'MATERIAL_LEADER',
    'MATERIAL_CONTROL'
  ) then
    raise exception 'Actor is not allowed to mutate stock';
  end if;

  select *
  into v_type
  from public.stock_transaction_types
  where id = p_transaction_type_id
    and code in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'IMPORT', 'EXPORT')
    and is_active = true
    and is_deleted = false;

  if not found then
    raise exception 'Invalid stock adjustment transaction type';
  end if;

  if p_adjustment_reason_id is not null then
    select *
    into v_reason
    from public.adjustment_reasons
    where id = p_adjustment_reason_id
      and is_active = true
      and is_deleted = false;

    if not found then
      raise exception 'Invalid adjustment reason';
    end if;

    if v_reason.requires_note and nullif(btrim(p_reason_note), '') is null then
      raise exception 'reason_note is required for this adjustment reason';
    end if;
  elsif nullif(btrim(p_reason_note), '') is null then
    raise exception 'adjustment_reason_id or reason_note is required';
  end if;

  if not exists (
    select 1
    from public.supply_providers sp
    join public.supplies s on s.id = sp.supply_id
    join public.providers p on p.id = sp.provider_id
    where sp.supply_id = p_supply_id
      and sp.provider_id = p_provider_id
      and sp.is_active = true
      and sp.is_deleted = false
      and s.is_active = true
      and s.is_deleted = false
      and p.is_active = true
      and p.is_deleted = false
  ) then
    raise exception 'Provider is not active or is not linked to the Supply';
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
    raise exception 'Storage location does not belong to the active area';
  end if;

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
    do update set is_active = true, is_deleted = false;
  end if;

  select *
  into v_balance
  from public.stock_balances
  where supply_id = p_supply_id
    and provider_id = p_provider_id
    and area_id = p_area_id
    and storage_location_id = p_storage_location_id
    and is_deleted = false
  for update;

  if not found then
    raise exception 'Stock balance not found';
  end if;

  v_before := v_balance.quantity;
  if v_type.effect = 'INCREASE' then
    v_after := v_before + p_quantity;
  elsif v_type.effect = 'DECREASE' then
    if v_before < p_quantity then
      raise exception 'Insufficient stock';
    end if;
    v_after := v_before - p_quantity;
  else
    raise exception 'Neutral transaction type cannot adjust a balance';
  end if;

  update public.stock_balances
  set quantity = v_after
  where id = v_balance.id;

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
    p_quantity,
    v_before,
    v_after,
    p_adjustment_reason_id,
    nullif(btrim(p_reason_note), ''),
    nullif(btrim(p_reason_note), ''),
    nullif(btrim(p_note), ''),
    p_created_by
  )
  returning * into v_transaction;

  select *
  into v_balance
  from public.stock_balances
  where id = v_balance.id;

  return jsonb_build_object(
    'balance', to_jsonb(v_balance),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

revoke all on function public.apply_stock_adjustment_v3(
  uuid, uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid
)
from public, anon, authenticated;

grant execute on function public.apply_stock_adjustment_v3(
  uuid, uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid
)
to service_role;

create or replace function public.apply_stock_adjustment_v2(
  p_supply_id uuid,
  p_area_id uuid,
  p_storage_location_id uuid,
  p_transaction_type_id uuid,
  p_quantity numeric,
  p_adjustment_reason_id uuid,
  p_reason_note text,
  p_note text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
begin
  v_provider_id := public.unknown_provider_id();
  if v_provider_id is null then
    raise exception 'Required provider UNKNOW is missing';
  end if;

  return public.apply_stock_adjustment_v3(
    p_supply_id,
    v_provider_id,
    p_area_id,
    p_storage_location_id,
    p_transaction_type_id,
    p_quantity,
    p_adjustment_reason_id,
    p_reason_note,
    p_note,
    p_created_by
  );
end;
$$;

revoke all on function public.apply_stock_adjustment_v2(
  uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid
)
from public, anon, authenticated;

grant execute on function public.apply_stock_adjustment_v2(
  uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid
)
to service_role;

-- The issue RPC derives provider_id from each OrderItem. It locks and mutates
-- only the matching provider-scoped StockBalance and writes the same Provider
-- to the immutable StockTransaction audit row.
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
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_order_item public.order_items%rowtype;
  v_location public.storage_locations%rowtype;
  v_balance public.stock_balances%rowtype;
  v_actor_role_code text;
  v_current_status_code text;
  v_new_status_code text;
  v_new_status_id uuid;
  v_issue_type_id uuid;
  v_issue_action_id uuid;
  v_item_payload jsonb;
  v_issue_payload jsonb;
  v_item_issue_total numeric;
  v_quantity numeric;
  v_before_quantity numeric;
  v_transaction_id uuid;
  v_transaction_ids uuid[] := array[]::uuid[];
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'items must contain at least one issue';
  end if;

  select r.code
  into v_actor_role_code
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = p_actor_id
    and u.is_active = true
    and u.is_verified = true
    and u.is_deleted = false
    and r.is_active = true
    and r.is_deleted = false;

  if not found or v_actor_role_code not in (
    'ADMIN',
    'DATA_MATERIAL',
    'MATERIAL_LEADER',
    'MATERIAL_CONTROL'
  ) then
    raise exception 'Actor is not allowed to issue stock';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
    and o.is_deleted = false
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select s.code
  into v_current_status_code
  from public.order_statuses s
  where s.id = v_order.status_id
    and s.is_active = true
    and s.is_deleted = false;

  if v_current_status_code not in ('APPROVED', 'PARTIAL_ISSUED') then
    raise exception 'Order status % cannot be issued', v_current_status_code;
  end if;

  select tt.id
  into v_issue_type_id
  from public.stock_transaction_types tt
  where tt.code = 'ISSUE'
    and tt.is_active = true
    and tt.is_deleted = false;

  select a.id
  into v_issue_action_id
  from public.order_revision_actions a
  where a.code = 'ISSUE'
    and a.is_active = true
    and a.is_deleted = false;

  if v_issue_type_id is null or v_issue_action_id is null then
    raise exception 'Required ISSUE lookup data is missing';
  end if;

  for v_item_payload in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item_payload) <> 'object'
       or nullif(v_item_payload ->> 'order_item_id', '') is null then
      raise exception 'order_item_id is required';
    end if;
    if jsonb_typeof(v_item_payload -> 'issues') <> 'array'
       or jsonb_array_length(v_item_payload -> 'issues') = 0 then
      raise exception 'Each order item must contain issues';
    end if;

    select oi.*
    into v_order_item
    from public.order_items oi
    where oi.id = (v_item_payload ->> 'order_item_id')::uuid
      and oi.order_id = p_order_id
      and oi.is_deleted = false
    for update;

    if not found then
      raise exception 'Order item not found in order';
    end if;

    if not exists (
      select 1
      from public.supply_providers sp
      join public.providers p on p.id = sp.provider_id
      where sp.supply_id = v_order_item.supply_id
        and sp.provider_id = v_order_item.provider_id
        and sp.is_active = true
        and sp.is_deleted = false
        and p.is_active = true
        and p.is_deleted = false
    ) then
      raise exception 'Order item Provider is inactive or is not linked to its Supply';
    end if;

    select coalesce(sum((issue ->> 'quantity')::numeric), 0)
    into v_item_issue_total
    from jsonb_array_elements(v_item_payload -> 'issues') issue;

    if v_item_issue_total <= 0 then
      raise exception 'Issue quantity must be greater than 0';
    end if;
    if coalesce(v_order_item.quantity_issued, 0) + v_item_issue_total
       > v_order_item.quantity_approved then
      raise exception
        'Cannot issue more than quantity_approved for order item %',
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

      select l.*
      into v_location
      from public.storage_locations l
      where l.id = (v_issue_payload ->> 'storage_location_id')::uuid
        and l.area_id = v_order.from_area_id
        and l.is_active = true
        and l.is_deleted = false;

      if not found then
        raise exception
          'Storage location is inactive, deleted, or outside the source area';
      end if;

      select sb.*
      into v_balance
      from public.stock_balances sb
      where sb.supply_id = v_order_item.supply_id
        and sb.provider_id = v_order_item.provider_id
        and sb.area_id = v_order.from_area_id
        and sb.storage_location_id = v_location.id
        and sb.is_active = true
        and sb.is_deleted = false
      for update;

      if not found then
        raise exception
          'Stock balance not found for Supply and Provider in source area';
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
        provider_id,
        area_id,
        storage_location_id,
        order_id,
        order_item_id,
        transaction_type_id,
        quantity,
        before_quantity,
        after_quantity,
        reason_id,
        reason_note,
        reason,
        note,
        created_by
      )
      values (
        v_order_item.supply_id,
        v_order_item.provider_id,
        v_order.from_area_id,
        v_location.id,
        p_order_id,
        v_order_item.id,
        v_issue_type_id,
        v_quantity,
        v_before_quantity,
        v_before_quantity - v_quantity,
        null,
        null,
        null,
        null,
        p_actor_id
      )
      returning id into v_transaction_id;

      v_transaction_ids := array_append(
        v_transaction_ids,
        v_transaction_id
      );
    end loop;

    update public.order_items
    set quantity_issued =
      coalesce(quantity_issued, 0) + v_item_issue_total
    where id = v_order_item.id;
  end loop;

  if exists (
    select 1
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.is_deleted = false
      and coalesce(oi.quantity_issued, 0) < oi.quantity_approved
  ) then
    v_new_status_code := 'PARTIAL_ISSUED';
  else
    v_new_status_code := 'ISSUED';
  end if;

  select s.id
  into v_new_status_id
  from public.order_statuses s
  where s.code = v_new_status_code
    and s.is_active = true
    and s.is_deleted = false;

  if v_new_status_id is null then
    raise exception 'Required issue target status is missing';
  end if;

  update public.orders
  set
    status_id = v_new_status_id,
    forklift_by = coalesce(p_forklift_by, forklift_by),
    taken_away_by = coalesce(p_taken_away_by, taken_away_by),
    issued_at = case
      when v_new_status_code = 'ISSUED' then now()
      else issued_at
    end
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
      'transaction_ids', to_jsonb(v_transaction_ids)
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

-- The application currently authenticates with a Fastify-issued JWT and all
-- database access is made with SUPABASE_SERVICE_ROLE_KEY. auth.uid() therefore
-- does not represent the application user, so role policies cannot safely be
-- expressed at PostgREST level in this phase. Keep direct client access closed;
-- Phase 3 continues to enforce role codes in Fastify middleware.
revoke all on table public.providers from anon, authenticated;
revoke all on table public.supply_providers from anon, authenticated;
grant all on table public.providers to service_role;
grant all on table public.supply_providers to service_role;

-- Fail the migration instead of committing a partial provider backfill.
do $$
declare
  v_unknown_count bigint;
begin
  select count(*) into v_unknown_count
  from public.providers
  where code = 'UNKNOW';

  if v_unknown_count <> 1 then
    raise exception 'Expected exactly one Provider UNKNOW, found %', v_unknown_count;
  end if;

  if exists (
    select 1
    from public.supplies s
    where not exists (
      select 1
      from public.supply_providers sp
      join public.providers p on p.id = sp.provider_id
      where sp.supply_id = s.id
        and p.code = 'UNKNOW'
    )
  ) then
    raise exception 'At least one existing Supply is missing Provider UNKNOW';
  end if;
end
$$;

commit;

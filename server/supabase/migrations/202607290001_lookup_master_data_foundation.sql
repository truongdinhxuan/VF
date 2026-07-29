-- app.xlsx lookup/master-data foundation.
--
-- This is a forward-only cut-over migration:
--   * Position is intentionally removed by product decision.
--   * Planning/PlanningItems/PlanningStatuses are intentionally not created.
--   * Legacy enum values are backfilled into lookup foreign keys and then the
--     enum columns/types are removed. Runtime code must compare lookup `code`.

begin;

create extension if not exists pgcrypto;

-- Position is no longer part of the application model.
drop index if exists public.users_position_id_idx;
alter table public.users drop constraint if exists users_position_id_fkey;
alter table public.users drop column if exists position_id;
drop table if exists public.positions;

-- Common fields required by app.xlsx. Defaults make the migration safe for
-- existing rows without deleting or rewriting business data.
alter table public.roles
  add column if not exists code text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists is_system boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.areas
  add column if not exists description text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.users
  add column if not exists is_deleted boolean not null default false;

alter table public.supply_categories
  add column if not exists name text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.units
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.supplies
  add column if not exists short_text text,
  add column if not exists translation_text text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Preserve data from the former spelling while making translation_text the
-- canonical app.xlsx column when that legacy column exists. Some linked
-- databases were already manually refactored and never had translator_text.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'supplies'
      and column_name = 'translator_text'
  ) then
    execute $sql$
      update public.supplies
      set translation_text = translator_text
      where translation_text is null
        and translator_text is not null
    $sql$;
  end if;
end
$$;

-- New required display fields are backfilled deterministically from existing
-- columns before the NOT NULL contract is enabled.
update public.supply_categories
set name = coalesce(nullif(btrim(name), ''), nullif(btrim(description), ''), code)
where name is null or btrim(name) = '';

update public.units
set name = coalesce(nullif(btrim(name), ''), nullif(btrim(symbol), ''), code)
where name is null or btrim(name) = '';

update public.supplies
set short_text = coalesce(
  nullif(btrim(short_text), ''),
  nullif(btrim(description), ''),
  code
)
where short_text is null or btrim(short_text) = '';

alter table public.supply_categories alter column name set not null;
alter table public.units alter column name set not null;
alter table public.supplies alter column short_text set not null;

alter table public.storage_locations
  add column if not exists description text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.stock_balances
  add column if not exists is_active boolean not null default true,
  add column if not exists is_deleted boolean not null default false;

alter table public.orders
  add column if not exists completed_at timestamptz,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_deleted boolean not null default false;

alter table public.order_items
  add column if not exists is_active boolean not null default true,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.order_items
  alter column quantity_approved set default 0,
  alter column quantity_issued set default 0;

alter table public.stock_transactions
  add column if not exists is_active boolean not null default true,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Stable role codes replace permission checks based on translated display
-- names. The legacy enum column is used only for this one-time backfill.
update public.roles
set
  code = case role_name::text
    when 'Admin' then 'ADMIN'
    when 'data Đóng gói' then 'DATA_PACKING'
    when 'data Vật tư' then 'DATA_MATERIAL'
    when 'Tổ trưởng vật tư' then 'MATERIAL_LEADER'
    when 'Material Control' then 'MATERIAL_CONTROL'
    else code
  end,
  name = coalesce(name, role_name::text),
  is_system = true,
  updated_at = now()
where role_name::text in (
  'Admin',
  'data Đóng gói',
  'data Vật tư',
  'Tổ trưởng vật tư',
  'Material Control'
);

insert into public.roles (
  role_name, code, name, is_system, is_active, is_deleted
)
select seed.role_name::public.role_name, seed.code, seed.name, true, true, false
from (
  values
    ('Admin', 'ADMIN', 'Admin'),
    ('data Đóng gói', 'DATA_PACKING', 'data Đóng gói'),
    ('data Vật tư', 'DATA_MATERIAL', 'data Vật tư'),
    ('Tổ trưởng vật tư', 'MATERIAL_LEADER', 'Tổ trưởng vật tư'),
    ('Material Control', 'MATERIAL_CONTROL', 'Material Control')
) as seed(role_name, code, name)
where not exists (
  select 1 from public.roles r where r.code = seed.code
);

alter table public.roles
  alter column code set not null,
  alter column name set not null,
  alter column is_system set default false;

create unique index if not exists roles_code_key on public.roles(code);

create table if not exists public.order_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_transaction_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  effect text not null,
  requires_reason boolean not null default false,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_transaction_types_effect_check
    check (effect in ('INCREASE', 'DECREASE', 'NEUTRAL'))
);

create table if not exists public.adjustment_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  requires_note boolean not null default false,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_revision_actions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.order_statuses (code, name, sort_order, is_system)
values
  ('DRAFT', 'Draft', 10, true),
  ('PENDING', 'Pending', 20, true),
  ('APPROVED', 'Approved', 30, true),
  ('REJECTED', 'Rejected', 40, true),
  ('PARTIAL_ISSUED', 'Partially issued', 50, true),
  ('ISSUED', 'Issued', 60, true),
  ('RECEIVED', 'Received', 70, true),
  ('COMPLETED', 'Completed', 80, true),
  ('CANCELLED', 'Cancelled', 90, true)
on conflict (code) do update
set is_system = true, is_deleted = false;

insert into public.stock_transaction_types (
  code, name, effect, requires_reason, is_system
)
values
  ('ISSUE', 'Issue', 'DECREASE', false, true),
  ('RECEIVE', 'Receive', 'INCREASE', false, true),
  ('ADJUSTMENT_IN', 'Adjustment in', 'INCREASE', true, true),
  ('ADJUSTMENT_OUT', 'Adjustment out', 'DECREASE', true, true),
  ('TRANSFER_IN', 'Transfer in', 'INCREASE', true, true),
  ('TRANSFER_OUT', 'Transfer out', 'DECREASE', true, true),
  ('IMPORT', 'Import', 'INCREASE', true, true),
  ('EXPORT', 'Export', 'DECREASE', true, true),
  ('REVERSAL_IN', 'Reversal in', 'INCREASE', true, true),
  ('REVERSAL_OUT', 'Reversal out', 'DECREASE', true, true)
on conflict (code) do update
set
  effect = excluded.effect,
  requires_reason = excluded.requires_reason,
  is_system = true,
  is_deleted = false;

insert into public.adjustment_reasons (
  code, name, requires_note, is_active, is_deleted
)
values
  ('STOCK_COUNT_DIFF', 'Stock count difference', false, true, false),
  ('DAMAGED', 'Damaged stock', false, true, false),
  ('MANUAL_CORRECTION', 'Manual correction', true, true, false),
  ('MOVE_LOCATION', 'Move storage location', false, true, false),
  ('OTHER', 'Other', true, true, false)
on conflict (code) do update
set requires_note = excluded.requires_note, is_deleted = false;

insert into public.order_revision_actions (
  code, name, is_system, is_active, is_deleted
)
values
  ('CREATE', 'Create', true, true, false),
  ('UPDATE', 'Update', true, true, false),
  ('APPROVE', 'Approve', true, true, false),
  ('REJECT', 'Reject', true, true, false),
  ('ISSUE', 'Issue', true, true, false),
  ('CANCEL', 'Cancel', true, true, false),
  ('REVERT_STATUS', 'Revert status', true, true, false),
  ('STOCK_REVERSAL', 'Stock reversal', true, true, false)
on conflict (code) do update
set is_system = true, is_deleted = false;

-- Backfill lookup foreign keys before enabling the NOT NULL contract.
alter table public.orders add column if not exists status_id uuid;

update public.orders o
set status_id = s.id
from public.order_statuses s
where o.status_id is null
  and s.code = o.status::text;

alter table public.orders
  alter column status_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_status_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_status_id_fkey
      foreign key (status_id) references public.order_statuses(id)
      on delete restrict on update cascade;
  end if;
end
$$;

create index if not exists orders_status_id_idx on public.orders(status_id);

-- Temporarily remove the immutable audit trigger solely for the one-time
-- legacy backfill, then restore it before commit.
drop trigger if exists stock_transactions_prevent_update
  on public.stock_transactions;

alter table public.stock_transactions
  add column if not exists transaction_type_id uuid,
  add column if not exists reason_id uuid,
  add column if not exists reason_note text;

update public.stock_transactions t
set
  transaction_type_id = tt.id,
  reason_note = coalesce(t.reason_note, t.reason)
from public.stock_transaction_types tt
where t.transaction_type_id is null
  and tt.code = t.type::text;

alter table public.stock_transactions
  alter column transaction_type_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_transactions'::regclass
      and conname = 'stock_transactions_transaction_type_id_fkey'
  ) then
    alter table public.stock_transactions
      add constraint stock_transactions_transaction_type_id_fkey
      foreign key (transaction_type_id)
      references public.stock_transaction_types(id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_transactions'::regclass
      and conname = 'stock_transactions_reason_id_fkey'
  ) then
    alter table public.stock_transactions
      add constraint stock_transactions_reason_id_fkey
      foreign key (reason_id) references public.adjustment_reasons(id)
      on delete restrict on update cascade;
  end if;
end
$$;

create index if not exists stock_transactions_transaction_type_id_idx
  on public.stock_transactions(transaction_type_id);
create index if not exists stock_transactions_reason_id_idx
  on public.stock_transactions(reason_id);

create trigger stock_transactions_prevent_update
before update on public.stock_transactions
for each row execute function public.prevent_stock_transaction_mutation();

-- Lookup-based stock adjustment boundary. Balance update and immutable audit
-- insertion either both commit or both roll back.
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
    select 1 from public.supplies s
    where s.id = p_supply_id
      and s.is_active = true
      and s.is_deleted = false
  ) then
    raise exception 'Supply does not exist or is inactive';
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
      area_id,
      storage_location_id,
      quantity,
      is_active,
      is_deleted
    )
    values (
      p_supply_id,
      p_area_id,
      p_storage_location_id,
      0,
      true,
      false
    )
    on conflict (supply_id, area_id, storage_location_id)
    do update set is_active = true, is_deleted = false;
  end if;

  select *
  into v_balance
  from public.stock_balances
  where supply_id = p_supply_id
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

revoke all on function public.apply_stock_adjustment_v2(
  uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid
)
from public, anon, authenticated;

grant execute on function public.apply_stock_adjustment_v2(
  uuid, uuid, uuid, uuid, numeric, uuid, text, text, uuid
)
to service_role;

create table if not exists public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id)
    on delete restrict on update cascade,
  action_id uuid not null references public.order_revision_actions(id)
    on delete restrict on update cascade,
  old_status_id uuid references public.order_statuses(id)
    on delete restrict on update cascade,
  new_status_id uuid references public.order_statuses(id)
    on delete restrict on update cascade,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_by uuid not null references public.users(id)
    on delete restrict on update cascade,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_revisions_order_id_idx
  on public.order_revisions(order_id);
create index if not exists order_revisions_action_id_idx
  on public.order_revisions(action_id);
create index if not exists order_revisions_created_by_idx
  on public.order_revisions(created_by);
create index if not exists order_revisions_created_at_idx
  on public.order_revisions(created_at desc);

-- Approval and rejection are kept in one PostgreSQL transaction so the status,
-- approved quantities and actor audit can never diverge.
create or replace function public.review_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_action_code text,
  p_items jsonb default null,
  p_reason text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_actor_role_code text;
  v_action_id uuid;
  v_target_status_id uuid;
  v_item_count integer;
  v_payload_count integer;
begin
  if p_action_code not in ('APPROVE', 'REJECT') then
    raise exception 'Unsupported review action';
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
    raise exception 'Actor is not allowed to approve or reject orders';
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

  if not exists (
    select 1
    from public.order_statuses s
    where s.id = v_order.status_id
      and s.code = 'PENDING'
      and s.is_active = true
      and s.is_deleted = false
  ) then
    raise exception 'Order must be PENDING';
  end if;

  select a.id
  into v_action_id
  from public.order_revision_actions a
  where a.code = p_action_code
    and a.is_active = true
    and a.is_deleted = false;

  select s.id
  into v_target_status_id
  from public.order_statuses s
  where s.code = case p_action_code
    when 'APPROVE' then 'APPROVED'
    else 'REJECTED'
  end
    and s.is_active = true
    and s.is_deleted = false;

  if v_action_id is null or v_target_status_id is null then
    raise exception 'Required review lookup data is missing';
  end if;

  if p_action_code = 'APPROVE' then
    if p_items is null or jsonb_typeof(p_items) <> 'array' then
      raise exception 'Approval items are required';
    end if;

    select count(*)
    into v_item_count
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.is_deleted = false;

    select count(*)
    into v_payload_count
    from jsonb_array_elements(p_items);

    if v_payload_count <> v_item_count
      or (
        select count(distinct item ->> 'order_item_id')
        from jsonb_array_elements(p_items) item
      ) <> v_item_count
    then
      raise exception 'Approval must include every order item exactly once';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_items) item
      left join public.order_items oi
        on oi.id = (item ->> 'order_item_id')::uuid
        and oi.order_id = p_order_id
        and oi.is_deleted = false
      where oi.id is null
        or (item ->> 'quantity_approved') is null
        or (item ->> 'quantity_approved')::numeric < 0
        or (item ->> 'quantity_approved')::numeric > oi.quantity_requested
    ) then
      raise exception 'Invalid approved quantity or order item';
    end if;

    update public.order_items oi
    set quantity_approved = (item.value ->> 'quantity_approved')::numeric
    from jsonb_array_elements(p_items) item(value)
    where oi.id = (item.value ->> 'order_item_id')::uuid
      and oi.order_id = p_order_id
      and oi.is_deleted = false;

    update public.orders
    set
      status_id = v_target_status_id,
      approved_by = p_actor_id,
      approved_at = now(),
      note = coalesce(p_note, note)
    where id = p_order_id;
  else
    if nullif(btrim(p_reason), '') is null then
      raise exception 'rejected_reason is required';
    end if;

    update public.orders
    set
      status_id = v_target_status_id,
      rejected_reason = btrim(p_reason)
    where id = p_order_id;
  end if;

  insert into public.order_revisions (
    order_id,
    action_id,
    old_status_id,
    new_status_id,
    old_data,
    new_data,
    reason,
    created_by
  )
  values (
    p_order_id,
    v_action_id,
    v_order.status_id,
    v_target_status_id,
    jsonb_build_object('status_id', v_order.status_id),
    jsonb_build_object('status_id', v_target_status_id),
    case when p_action_code = 'REJECT' then btrim(p_reason) else null end,
    p_actor_id
  );

  return p_order_id;
end;
$$;

revoke all on function public.review_order(
  uuid, uuid, text, jsonb, text, text
)
from public, anon, authenticated;

grant execute on function public.review_order(
  uuid, uuid, text, jsonb, text, text
)
to service_role;

-- Replace the legacy enum-based issue RPC. The lookup code drives every
-- transition and the stock mutation plus audit rows remain one transaction.
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
        and sb.area_id = v_order.from_area_id
        and sb.storage_location_id = v_location.id
        and sb.is_active = true
        and sb.is_deleted = false
      for update;

      if not found then
        raise exception 'Stock balance not found for supply in source area';
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

-- Contract cut-over: after all data and RPCs use lookup IDs, remove the
-- obsolete enum-backed APIs and columns. Historical migrations stay intact.
drop function if exists public.apply_stock_adjustment(
  uuid,
  uuid,
  uuid,
  public.stock_transaction_type,
  numeric,
  text,
  text,
  uuid
);

drop trigger if exists orders_sync_status_lookup on public.orders;
drop function if exists public.sync_order_status_lookup();
drop trigger if exists stock_transactions_sync_type_lookup
  on public.stock_transactions;
drop function if exists public.sync_stock_transaction_type_lookup();

alter table public.roles drop column if exists role_name;
alter table public.orders drop column if exists status;
alter table public.stock_transactions drop column if exists type;

drop type if exists public.role_name;
drop type if exists public.order_status;
drop type if exists public.stock_transaction_type;

-- Reuse the existing updated_at trigger function for mutable models.
drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at
before update on public.areas
for each row execute function public.set_updated_at();

drop trigger if exists supply_categories_set_updated_at
  on public.supply_categories;
create trigger supply_categories_set_updated_at
before update on public.supply_categories
for each row execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

drop trigger if exists order_statuses_set_updated_at
  on public.order_statuses;
create trigger order_statuses_set_updated_at
before update on public.order_statuses
for each row execute function public.set_updated_at();

drop trigger if exists stock_transaction_types_set_updated_at
  on public.stock_transaction_types;
create trigger stock_transaction_types_set_updated_at
before update on public.stock_transaction_types
for each row execute function public.set_updated_at();

drop trigger if exists adjustment_reasons_set_updated_at
  on public.adjustment_reasons;
create trigger adjustment_reasons_set_updated_at
before update on public.adjustment_reasons
for each row execute function public.set_updated_at();

drop trigger if exists order_revision_actions_set_updated_at
  on public.order_revision_actions;
create trigger order_revision_actions_set_updated_at
before update on public.order_revision_actions
for each row execute function public.set_updated_at();

drop trigger if exists order_revisions_set_updated_at
  on public.order_revisions;
create trigger order_revisions_set_updated_at
before update on public.order_revisions
for each row execute function public.set_updated_at();

commit;

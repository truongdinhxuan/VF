-- Application.xlsx Phase 1 baseline for Supabase/PostgreSQL.
-- This migration is intentionally non-destructive and does not drop legacy tables/columns.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'role_name'
  ) then
    create type public.role_name as enum (
      'data Đóng gói',
      'data Vật tư',
      'Tổ trưởng vật tư',
      'Material Control'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'order_status'
  ) then
    create type public.order_status as enum (
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'PARTIAL_ISSUED',
      'ISSUED',
      'RECEIVED',
      'COMPLETED',
      'CANCELLED'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'stock_transaction_type'
  ) then
    create type public.stock_transaction_type as enum (
      'ISSUE',
      'RECEIVE',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'IMPORT',
      'EXPORT'
    );
  end if;
end
$$;

do $$
declare
  actual_values text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
    into actual_values
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'role_name';

  if actual_values <> array[
    'data Đóng gói',
    'data Vật tư',
    'Tổ trưởng vật tư',
    'Material Control'
  ]::text[] then
    raise exception 'public.role_name does not match Application.xlsx';
  end if;

  select array_agg(e.enumlabel order by e.enumsortorder)
    into actual_values
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'order_status';

  if actual_values <> array[
    'DRAFT',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PARTIAL_ISSUED',
    'ISSUED',
    'RECEIVED',
    'COMPLETED',
    'CANCELLED'
  ]::text[] then
    raise exception 'public.order_status does not match Application.xlsx';
  end if;

  select array_agg(e.enumlabel order by e.enumsortorder)
    into actual_values
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'stock_transaction_type';

  if actual_values <> array[
    'ISSUE',
    'RECEIVE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'IMPORT',
    'EXPORT'
  ]::text[] then
    raise exception 'public.stock_transaction_type does not match Application.xlsx';
  end if;
end
$$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  role_name public.role_name not null unique
);

insert into public.roles (role_name)
values
  ('data Đóng gói'),
  ('data Vật tư'),
  ('Tổ trưởng vật tư'),
  ('Material Control')
on conflict (role_name) do nothing;

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  position_name text not null unique
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  vinfast_id integer not null unique,
  email text not null unique,
  full_name text not null,
  phone_number text,
  avatar_url text,
  role_id uuid not null references public.roles(id) on delete restrict on update cascade,
  position_id uuid references public.positions(id) on delete set null on update cascade,
  area_id uuid not null references public.areas(id) on delete restrict on update cascade,
  managed_by_user_id uuid references public.users(id) on delete set null on update cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade the legacy public.users table in place. Existing fields are retained
-- so the current API keeps working until its Phase 2 migration.
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists role_id uuid;
alter table public.users add column if not exists position_id uuid;
alter table public.users add column if not exists area_id uuid;
alter table public.users add column if not exists managed_by_user_id uuid;
alter table public.users add column if not exists is_active boolean default true;

-- to_jsonb allows this statement to work whether the legacy split-name and
-- role columns exist or not.
update public.users as u
set full_name = nullif(
  btrim(concat_ws(
    ' ',
    nullif(btrim(to_jsonb(u) ->> 'first_name'), ''),
    nullif(btrim(to_jsonb(u) ->> 'middle_name'), ''),
    nullif(btrim(to_jsonb(u) ->> 'last_name'), '')
  )),
  ''
)
where u.full_name is null;

update public.users as u
set role_id = r.id
from public.roles as r
where u.role_id is null
  and r.role_name::text = to_jsonb(u) ->> 'role';

update public.users set is_active = true where is_active is null;
alter table public.users alter column is_active set default true;
alter table public.users alter column is_active set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_role_id_fkey'
  ) then
    alter table public.users
      add constraint users_role_id_fkey
      foreign key (role_id) references public.roles(id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_position_id_fkey'
  ) then
    alter table public.users
      add constraint users_position_id_fkey
      foreign key (position_id) references public.positions(id)
      on delete set null on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_area_id_fkey'
  ) then
    alter table public.users
      add constraint users_area_id_fkey
      foreign key (area_id) references public.areas(id)
      on delete restrict on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_managed_by_user_id_fkey'
  ) then
    alter table public.users
      add constraint users_managed_by_user_id_fkey
      foreign key (managed_by_user_id) references public.users(id)
      on delete set null on update cascade;
  end if;

  if exists (select 1 from public.users where full_name is null) then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.users'::regclass and conname = 'users_full_name_required'
    ) then
      alter table public.users
        add constraint users_full_name_required check (full_name is not null) not valid;
    end if;
  else
    alter table public.users alter column full_name set not null;
  end if;

  if exists (select 1 from public.users where role_id is null) then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.users'::regclass and conname = 'users_role_id_required'
    ) then
      alter table public.users
        add constraint users_role_id_required check (role_id is not null) not valid;
    end if;
  else
    alter table public.users alter column role_id set not null;
  end if;

  if exists (select 1 from public.users where area_id is null) then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.users'::regclass and conname = 'users_area_id_required'
    ) then
      alter table public.users
        add constraint users_area_id_required check (area_id is not null) not valid;
    end if;
  else
    alter table public.users alter column area_id set not null;
  end if;
end
$$;

create unique index if not exists users_vinfast_id_key on public.users(vinfast_id);
create unique index if not exists users_email_key on public.users(email);

create index if not exists users_role_id_idx on public.users(role_id);
create index if not exists users_position_id_idx on public.users(position_id);
create index if not exists users_area_id_idx on public.users(area_id);
create index if not exists users_managed_by_user_id_idx on public.users(managed_by_user_id);

create table if not exists public.supply_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  symbol text not null,
  name text,
  is_active boolean not null default true
);

create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  short_text text not null,
  translator_text text,
  description text,
  category_id uuid not null references public.supply_categories(id) on delete restrict on update cascade,
  unit_id uuid not null references public.units(id) on delete restrict on update cascade,
  min_stock numeric default 0,
  max_stock numeric,
  safety_stock numeric,
  image_url text,
  is_active boolean not null default true,
  is_deleted boolean not null default false
);

create index if not exists supplies_category_id_idx on public.supplies(category_id);
create index if not exists supplies_unit_id_idx on public.supplies(unit_id);

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  area_id uuid not null references public.areas(id) on delete restrict on update cascade,
  name text,
  is_active boolean not null default true,
  constraint storage_locations_area_code_key unique (area_id, code)
);

create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supplies(id) on delete restrict on update cascade,
  area_id uuid not null references public.areas(id) on delete restrict on update cascade,
  storage_location_id uuid not null references public.storage_locations(id) on delete restrict on update cascade,
  quantity numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_balances_supply_area_location_key
    unique (supply_id, area_id, storage_location_id),
  constraint stock_balances_quantity_nonnegative check (quantity >= 0)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  -- Application.xlsx names Planning.id but does not define the Planning model.
  -- Keep the field from ModelFields; add its FK only after Planning is specified.
  planning_id uuid,
  from_area_id uuid not null references public.areas(id) on delete restrict on update cascade,
  to_area_id uuid not null references public.areas(id) on delete restrict on update cascade,
  requested_by uuid not null references public.users(id) on delete restrict on update cascade,
  approved_by uuid references public.users(id) on delete set null on update cascade,
  forklift_by uuid references public.users(id) on delete set null on update cascade,
  taken_away_by uuid references public.users(id) on delete set null on update cascade,
  status public.order_status not null default 'DRAFT',
  note text,
  rejected_reason text,
  cancel_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  issued_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_rejected_reason_required check (
    status <> 'REJECTED'
    or nullif(btrim(rejected_reason), '') is not null
  )
);

create index if not exists orders_from_area_id_idx on public.orders(from_area_id);
create index if not exists orders_to_area_id_idx on public.orders(to_area_id);
create index if not exists orders_requested_by_idx on public.orders(requested_by);
create index if not exists orders_approved_by_idx on public.orders(approved_by);
create index if not exists orders_forklift_by_idx on public.orders(forklift_by);
create index if not exists orders_taken_away_by_idx on public.orders(taken_away_by);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade on update cascade,
  -- Application.xlsx names PlanningItems.id but does not define that model.
  -- Keep the field from ModelFields; add its FK only after PlanningItems is specified.
  planning_item_id uuid,
  supply_id uuid not null references public.supplies(id) on delete restrict on update cascade,
  unit_id uuid not null references public.units(id) on delete restrict on update cascade,
  quantity_requested numeric not null,
  quantity_approved numeric,
  quantity_issued numeric,
  note text,
  constraint order_items_quantity_requested_positive check (quantity_requested > 0),
  constraint order_items_quantity_approved_valid check (
    quantity_approved is null
    or (quantity_approved >= 0 and quantity_approved <= quantity_requested)
  ),
  constraint order_items_quantity_issued_valid check (
    quantity_issued is null
    or (
      quantity_approved is not null
      and quantity_issued >= 0
      and quantity_issued <= quantity_approved
    )
  )
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_supply_id_idx on public.order_items(supply_id);
create index if not exists order_items_unit_id_idx on public.order_items(unit_id);

-- The workbook marks unique(order_id, supply_id) as optional. It is deliberately
-- not enforced until duplicate-line behavior is explicitly decided.

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supplies(id) on delete restrict on update cascade,
  area_id uuid not null references public.areas(id) on delete restrict on update cascade,
  storage_location_id uuid not null references public.storage_locations(id) on delete restrict on update cascade,
  order_id uuid references public.orders(id) on delete restrict on update cascade,
  order_item_id uuid references public.order_items(id) on delete restrict on update cascade,
  type public.stock_transaction_type not null,
  quantity numeric not null,
  before_quantity numeric not null,
  after_quantity numeric not null,
  reason text,
  note text,
  created_by uuid not null references public.users(id) on delete restrict on update cascade,
  created_at timestamptz not null default now(),
  constraint stock_transactions_quantity_positive check (quantity > 0),
  constraint stock_transactions_balances_nonnegative check (
    before_quantity >= 0 and after_quantity >= 0
  ),
  constraint stock_transactions_external_reason_required check (
    order_id is not null
    or nullif(btrim(reason), '') is not null
  )
);

create index if not exists stock_transactions_supply_id_idx on public.stock_transactions(supply_id);
create index if not exists stock_transactions_area_id_idx on public.stock_transactions(area_id);
create index if not exists stock_transactions_storage_location_id_idx on public.stock_transactions(storage_location_id);
create index if not exists stock_transactions_order_id_idx on public.stock_transactions(order_id);
create index if not exists stock_transactions_order_item_id_idx on public.stock_transactions(order_item_id);
create index if not exists stock_transactions_created_by_idx on public.stock_transactions(created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists stock_balances_set_updated_at on public.stock_balances;
create trigger stock_balances_set_updated_at
before update on public.stock_balances
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.allow_only_draft_order_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'DRAFT' then
    raise exception 'Only DRAFT orders can be deleted';
  end if;

  return old;
end;
$$;

drop trigger if exists orders_allow_only_draft_delete on public.orders;
create trigger orders_allow_only_draft_delete
before delete on public.orders
for each row execute function public.allow_only_draft_order_delete();

create or replace function public.prevent_stock_transaction_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'StockTransactions are immutable; create a correcting transaction instead';
end;
$$;

drop trigger if exists stock_transactions_prevent_update on public.stock_transactions;
create trigger stock_transactions_prevent_update
before update on public.stock_transactions
for each row execute function public.prevent_stock_transaction_mutation();

drop trigger if exists stock_transactions_prevent_delete on public.stock_transactions;
create trigger stock_transactions_prevent_delete
before delete on public.stock_transactions
for each row execute function public.prevent_stock_transaction_mutation();

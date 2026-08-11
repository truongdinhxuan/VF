-- Phase 6: Milkrun master data.
-- Business values remain rows in CRUD lookup tables; no PostgreSQL enum is used.

begin;

create schema if not exists milkrun;

revoke all on schema milkrun from public, anon, authenticated;
grant usage on schema milkrun to service_role;

create table milkrun.racks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  image_url text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint racks_code_key unique (code)
);

create table milkrun.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_code_key unique (code)
);

create table milkrun.trip_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_types_code_key unique (code)
);

create table milkrun.trip_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  sort_order integer not null,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_statuses_code_key unique (code)
);

create table milkrun.vehicles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  plate_number text not null,
  driver_id uuid,
  name text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_code_key unique (code),
  constraint vehicles_plate_number_key unique (plate_number),
  constraint vehicles_driver_id_key unique (driver_id),
  constraint vehicles_driver_id_fkey
    foreign key (driver_id) references public.users(id)
    on delete restrict on update cascade
);

create table milkrun.stock_transaction_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  effect text not null,
  requires_reason boolean not null default false,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_transaction_types_code_key unique (code),
  constraint stock_transaction_types_effect_check
    check (effect in ('INCREASE', 'DECREASE', 'NEUTRAL'))
);

create table milkrun.adjustment_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adjustment_reasons_code_key unique (code)
);

create index racks_active_idx
  on milkrun.racks (is_active, is_deleted, code);
create index shops_active_idx
  on milkrun.shops (is_active, is_deleted, code);
create index trip_types_active_idx
  on milkrun.trip_types (is_active, is_deleted, code);
create index trip_statuses_active_idx
  on milkrun.trip_statuses (is_active, is_deleted, sort_order, code);
create index vehicles_active_idx
  on milkrun.vehicles (is_active, is_deleted, code);
create index stock_transaction_types_active_idx
  on milkrun.stock_transaction_types (is_active, is_deleted, code);
create index adjustment_reasons_active_idx
  on milkrun.adjustment_reasons (is_active, is_deleted, code);

drop trigger if exists racks_set_updated_at on milkrun.racks;
create trigger racks_set_updated_at
before update on milkrun.racks
for each row execute function public.set_updated_at();

drop trigger if exists shops_set_updated_at on milkrun.shops;
create trigger shops_set_updated_at
before update on milkrun.shops
for each row execute function public.set_updated_at();

drop trigger if exists trip_types_set_updated_at on milkrun.trip_types;
create trigger trip_types_set_updated_at
before update on milkrun.trip_types
for each row execute function public.set_updated_at();

drop trigger if exists trip_statuses_set_updated_at on milkrun.trip_statuses;
create trigger trip_statuses_set_updated_at
before update on milkrun.trip_statuses
for each row execute function public.set_updated_at();

drop trigger if exists vehicles_set_updated_at on milkrun.vehicles;
create trigger vehicles_set_updated_at
before update on milkrun.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists stock_transaction_types_set_updated_at
  on milkrun.stock_transaction_types;
create trigger stock_transaction_types_set_updated_at
before update on milkrun.stock_transaction_types
for each row execute function public.set_updated_at();

drop trigger if exists adjustment_reasons_set_updated_at
  on milkrun.adjustment_reasons;
create trigger adjustment_reasons_set_updated_at
before update on milkrun.adjustment_reasons
for each row execute function public.set_updated_at();

create or replace function milkrun.protect_system_lookup()
returns trigger
language plpgsql
set search_path = milkrun, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'System lookup rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.is_system and (
    new.code is distinct from old.code
    or new.is_system is distinct from true
    or new.is_active is distinct from true
    or new.is_deleted is distinct from false
  ) then
    raise exception 'System lookup code and active state are protected';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_types_protect_system on milkrun.trip_types;
create trigger trip_types_protect_system
before update or delete on milkrun.trip_types
for each row execute function milkrun.protect_system_lookup();

drop trigger if exists trip_statuses_protect_system on milkrun.trip_statuses;
create trigger trip_statuses_protect_system
before update or delete on milkrun.trip_statuses
for each row execute function milkrun.protect_system_lookup();

drop trigger if exists stock_transaction_types_protect_system
  on milkrun.stock_transaction_types;
create trigger stock_transaction_types_protect_system
before update or delete on milkrun.stock_transaction_types
for each row execute function milkrun.protect_system_lookup();

insert into milkrun.trip_types (
  code, name, description, is_system, is_active, is_deleted
)
values
  ('RECEIVE_RACK', 'Nhận rack', 'Chuyến nhận rack', true, true, false),
  ('RETURN_RACK', 'Trả rack', 'Chuyến trả rack', true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

insert into milkrun.trip_statuses (
  code, name, description, sort_order,
  is_system, is_active, is_deleted
)
values
  ('REGISTERED', 'Đã đăng ký', 'Chuyến đã được đăng ký', 10, true, true, false),
  ('STARTED', 'Đã bắt đầu', 'Chuyến đã bắt đầu', 20, true, true, false),
  ('ARRIVED', 'Đã tới Shop', 'Xe đã tới Shop', 30, true, true, false),
  ('COMPLETED', 'Hoàn thành', 'Chuyến đã hoàn thành', 40, true, true, false),
  ('CANCELLED', 'Đã hủy', 'Chuyến đã hủy', 50, true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

insert into milkrun.stock_transaction_types (
  code, name, effect, requires_reason,
  is_system, is_active, is_deleted
)
values
  ('IN', 'Nhập rack', 'INCREASE', false, true, true, false),
  ('OUT', 'Xuất rack', 'DECREASE', false, true, true, false),
  ('ADJUSTMENT_IN', 'Điều chỉnh tăng', 'INCREASE', true, true, true, false),
  ('ADJUSTMENT_OUT', 'Điều chỉnh giảm', 'DECREASE', true, true, true, false),
  ('REVERSAL_IN', 'Hoàn tác tăng', 'INCREASE', true, true, true, false),
  ('REVERSAL_OUT', 'Hoàn tác giảm', 'DECREASE', true, true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  effect = excluded.effect,
  requires_reason = excluded.requires_reason,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

alter table milkrun.racks enable row level security;
alter table milkrun.shops enable row level security;
alter table milkrun.trip_types enable row level security;
alter table milkrun.trip_statuses enable row level security;
alter table milkrun.vehicles enable row level security;
alter table milkrun.stock_transaction_types enable row level security;
alter table milkrun.adjustment_reasons enable row level security;

revoke all on all tables in schema milkrun
  from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema milkrun
  to service_role;

do $$
begin
  if (select count(*) from milkrun.trip_types
      where code in ('RECEIVE_RACK', 'RETURN_RACK')
        and is_system and is_active and not is_deleted) <> 2 then
    raise exception 'Milkrun TripType seed verification failed';
  end if;

  if (select count(*) from milkrun.trip_statuses
      where code in ('REGISTERED', 'STARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED')
        and is_system and is_active and not is_deleted) <> 5 then
    raise exception 'Milkrun TripStatus seed verification failed';
  end if;

  if (select count(*) from milkrun.stock_transaction_types
      where code in (
        'IN', 'OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
        'REVERSAL_IN', 'REVERSAL_OUT'
      ) and is_system and is_active and not is_deleted) <> 6 then
    raise exception 'Milkrun StockTransactionType seed verification failed';
  end if;
end;
$$;

commit;

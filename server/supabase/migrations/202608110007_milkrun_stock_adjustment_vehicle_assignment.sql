-- Phase 9: atomic Milkrun manual stock adjustment and safe vehicle assignment.
-- Business values remain lookup rows; this migration creates no PostgreSQL enum.

begin;

create table milkrun.stock_balances (
  id uuid primary key default gen_random_uuid(),
  rack_id uuid not null,
  area_id uuid not null,
  quantity numeric not null default 0,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_balances_rack_id_fkey
    foreign key (rack_id) references milkrun.racks(id)
    on delete restrict on update cascade,
  constraint stock_balances_area_id_fkey
    foreign key (area_id) references public.areas(id)
    on delete restrict on update cascade,
  constraint stock_balances_rack_area_key unique (rack_id, area_id),
  constraint stock_balances_quantity_check check (quantity >= 0)
);

create table milkrun.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  rack_id uuid not null,
  area_id uuid not null,
  trip_id uuid,
  trip_item_id uuid,
  transaction_type_id uuid not null,
  adjustment_reason_id uuid,
  quantity numeric not null,
  before_quantity numeric not null,
  after_quantity numeric not null,
  reason_note text,
  created_by uuid not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_transactions_rack_id_fkey
    foreign key (rack_id) references milkrun.racks(id)
    on delete restrict on update cascade,
  constraint stock_transactions_area_id_fkey
    foreign key (area_id) references public.areas(id)
    on delete restrict on update cascade,
  constraint stock_transactions_trip_id_fkey
    foreign key (trip_id) references milkrun.trips(id)
    on delete restrict on update cascade,
  constraint stock_transactions_trip_item_id_fkey
    foreign key (trip_item_id) references milkrun.trip_items(id)
    on delete restrict on update cascade,
  constraint stock_transactions_transaction_type_id_fkey
    foreign key (transaction_type_id) references milkrun.stock_transaction_types(id)
    on delete restrict on update cascade,
  constraint stock_transactions_adjustment_reason_id_fkey
    foreign key (adjustment_reason_id) references milkrun.adjustment_reasons(id)
    on delete restrict on update cascade,
  constraint stock_transactions_created_by_fkey
    foreign key (created_by) references public.users(id)
    on delete restrict on update cascade,
  constraint stock_transactions_quantity_check check (quantity > 0),
  constraint stock_transactions_balances_check check (
    before_quantity >= 0 and after_quantity >= 0
  ),
  constraint stock_transactions_trip_pair_check check (
    (trip_id is null and trip_item_id is null)
    or (trip_id is not null and trip_item_id is not null)
  ),
  constraint stock_transactions_external_reason_check check (
    trip_id is not null or adjustment_reason_id is not null
  )
);

create index stock_balances_area_updated_idx
  on milkrun.stock_balances (area_id, updated_at desc, id);
create index stock_balances_rack_updated_idx
  on milkrun.stock_balances (rack_id, updated_at desc, id);
create index stock_transactions_rack_created_idx
  on milkrun.stock_transactions (rack_id, created_at desc, id);
create index stock_transactions_area_created_idx
  on milkrun.stock_transactions (area_id, created_at desc, id);
create index stock_transactions_type_created_idx
  on milkrun.stock_transactions (transaction_type_id, created_at desc, id);
create index stock_transactions_reason_created_idx
  on milkrun.stock_transactions (adjustment_reason_id, created_at desc, id);
create index stock_transactions_trip_created_idx
  on milkrun.stock_transactions (trip_id, created_at desc, id);
create index stock_transactions_created_by_idx
  on milkrun.stock_transactions (created_by, created_at desc, id);

drop trigger if exists stock_balances_set_updated_at on milkrun.stock_balances;
create trigger stock_balances_set_updated_at
before update on milkrun.stock_balances
for each row execute function public.set_updated_at();

create or replace function milkrun.prevent_stock_transaction_mutation()
returns trigger
language plpgsql
set search_path = milkrun, pg_temp
as $$
begin
  raise exception 'Milkrun StockTransactions are immutable; create a REVERSAL transaction';
end;
$$;

drop trigger if exists stock_transactions_prevent_update
  on milkrun.stock_transactions;
create trigger stock_transactions_prevent_update
before update on milkrun.stock_transactions
for each row execute function milkrun.prevent_stock_transaction_mutation();

drop trigger if exists stock_transactions_prevent_delete
  on milkrun.stock_transactions;
create trigger stock_transactions_prevent_delete
before delete on milkrun.stock_transactions
for each row execute function milkrun.prevent_stock_transaction_mutation();

create or replace function milkrun.apply_stock_adjustment(
  p_actor_id uuid,
  p_rack_id uuid,
  p_area_id uuid,
  p_transaction_type_id uuid,
  p_adjustment_reason_id uuid,
  p_quantity numeric,
  p_reason_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = milkrun, public, pg_temp
as $$
declare
  v_balance milkrun.stock_balances%rowtype;
  v_transaction_id uuid := gen_random_uuid();
  v_type_code text;
  v_effect text;
  v_before numeric;
  v_after numeric;
begin
  if not public.has_permission(p_actor_id, 'milkrun.stock.adjust') then
    raise exception 'Permission denied: milkrun.stock.adjust';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Adjustment quantity must be greater than zero';
  end if;

  if p_adjustment_reason_id is null or not exists (
    select 1
    from milkrun.adjustment_reasons
    where id = p_adjustment_reason_id
      and is_active and not is_deleted
  ) then
    raise exception 'Active adjustment_reason_id is required';
  end if;

  if not exists (
    select 1 from milkrun.racks
    where id = p_rack_id and is_active and not is_deleted
  ) then
    raise exception 'Rack is unavailable';
  end if;

  if not exists (
    select 1 from public.areas
    where id = p_area_id
      and code = 'EDC_LOGISTICS'
      and is_active and not is_deleted
  ) then
    raise exception 'Milkrun stock is restricted to active EDC Logistics Area';
  end if;

  select code, effect
  into v_type_code, v_effect
  from milkrun.stock_transaction_types
  where id = p_transaction_type_id
    and is_active and not is_deleted;

  if v_type_code not in (
    'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL_IN', 'REVERSAL_OUT'
  ) then
    raise exception 'Manual stock changes require an ADJUSTMENT or REVERSAL transaction type';
  end if;

  insert into milkrun.stock_balances (rack_id, area_id, quantity)
  values (p_rack_id, p_area_id, 0)
  on conflict (rack_id, area_id) do nothing;

  select * into v_balance
  from milkrun.stock_balances
  where rack_id = p_rack_id and area_id = p_area_id
  for update;

  v_before := v_balance.quantity;
  v_after := case v_effect
    when 'INCREASE' then v_before + p_quantity
    when 'DECREASE' then v_before - p_quantity
    else null
  end;

  if v_after is null then
    raise exception 'Transaction type effect must be INCREASE or DECREASE';
  end if;
  if v_after < 0 then
    raise exception 'Insufficient Milkrun stock';
  end if;

  update milkrun.stock_balances
  set quantity = v_after, is_active = true, is_deleted = false
  where id = v_balance.id;

  insert into milkrun.stock_transactions (
    id, rack_id, area_id, trip_id, trip_item_id,
    transaction_type_id, adjustment_reason_id,
    quantity, before_quantity, after_quantity, reason_note, created_by
  ) values (
    v_transaction_id, p_rack_id, p_area_id, null, null,
    p_transaction_type_id, p_adjustment_reason_id,
    p_quantity, v_before, v_after, nullif(btrim(p_reason_note), ''), p_actor_id
  );

  return v_transaction_id;
end;
$$;

create or replace function milkrun.assign_vehicle_driver(
  p_actor_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = milkrun, public, pg_temp
as $$
declare
  v_vehicle milkrun.vehicles%rowtype;
begin
  if not public.has_permission(p_actor_id, 'milkrun.vehicle.assign') then
    raise exception 'Permission denied: milkrun.vehicle.assign';
  end if;

  select * into v_vehicle
  from milkrun.vehicles
  where id = p_vehicle_id and is_active and not is_deleted
  for update;
  if not found then
    raise exception 'Vehicle is unavailable';
  end if;

  if p_driver_id is not null and not exists (
    select 1 from public.users
    where id = p_driver_id
      and is_active and is_verified and not is_deleted
  ) then
    raise exception 'Driver is unavailable';
  end if;

  if p_driver_id is not null then
    perform 1
    from milkrun.vehicles
    where driver_id = p_driver_id
    for update;

    update milkrun.vehicles
    set driver_id = null
    where driver_id = p_driver_id and id <> p_vehicle_id;
  end if;

  update milkrun.vehicles
  set driver_id = p_driver_id
  where id = p_vehicle_id;

  return p_vehicle_id;
end;
$$;

alter table milkrun.stock_balances enable row level security;
alter table milkrun.stock_transactions enable row level security;

revoke all on milkrun.stock_balances, milkrun.stock_transactions
  from public, anon, authenticated;
grant select, insert, update, delete
  on milkrun.stock_balances, milkrun.stock_transactions
  to service_role;

revoke all on function milkrun.apply_stock_adjustment(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated;
grant execute on function milkrun.apply_stock_adjustment(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) to service_role;

revoke all on function milkrun.assign_vehicle_driver(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function milkrun.assign_vehicle_driver(uuid, uuid, uuid)
  to service_role;

commit;

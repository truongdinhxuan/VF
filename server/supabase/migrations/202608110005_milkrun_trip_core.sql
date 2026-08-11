-- Phase 7: Milkrun Trip core.
-- Trips are created directly by authenticated drivers. There is no Order or
-- OrderItem dependency and no stock mutation in this migration.

begin;

create table milkrun.trips (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  driver_id uuid not null,
  area_id uuid not null,
  shop_id uuid not null,
  trip_type_id uuid not null,
  status_id uuid not null,
  time_start timestamptz,
  time_arrived timestamptz,
  time_lift_up timestamptz,
  time_lift_down timestamptz,
  attachment_url text,
  note text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_code_key unique (code),
  constraint trips_driver_id_fkey
    foreign key (driver_id) references public.users(id)
    on delete restrict on update cascade,
  constraint trips_area_id_fkey
    foreign key (area_id) references public.areas(id)
    on delete restrict on update cascade,
  constraint trips_shop_id_fkey
    foreign key (shop_id) references milkrun.shops(id)
    on delete restrict on update cascade,
  constraint trips_trip_type_id_fkey
    foreign key (trip_type_id) references milkrun.trip_types(id)
    on delete restrict on update cascade,
  constraint trips_status_id_fkey
    foreign key (status_id) references milkrun.trip_statuses(id)
    on delete restrict on update cascade
);

create table milkrun.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  rack_id uuid not null,
  quantity numeric not null,
  note text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_items_trip_id_fkey
    foreign key (trip_id) references milkrun.trips(id)
    on delete restrict on update cascade,
  constraint trip_items_rack_id_fkey
    foreign key (rack_id) references milkrun.racks(id)
    on delete restrict on update cascade,
  constraint trip_items_quantity_check check (quantity > 0)
);

create index trips_driver_created_idx
  on milkrun.trips (driver_id, created_at desc, id);
create index trips_status_created_idx
  on milkrun.trips (status_id, created_at desc, id);
create index trips_shop_created_idx
  on milkrun.trips (shop_id, created_at desc, id);
create index trips_type_created_idx
  on milkrun.trips (trip_type_id, created_at desc, id);
create index trips_active_idx
  on milkrun.trips (is_active, is_deleted, created_at desc, id);
create index trip_items_trip_idx
  on milkrun.trip_items (trip_id, created_at, id);
create index trip_items_rack_idx
  on milkrun.trip_items (rack_id, trip_id);

drop trigger if exists trips_set_updated_at on milkrun.trips;
create trigger trips_set_updated_at
before update on milkrun.trips
for each row execute function public.set_updated_at();

drop trigger if exists trip_items_set_updated_at on milkrun.trip_items;
create trigger trip_items_set_updated_at
before update on milkrun.trip_items
for each row execute function public.set_updated_at();

create or replace function milkrun.validate_trip_status_transition()
returns trigger
language plpgsql
security definer
set search_path = milkrun, public, pg_temp
as $$
declare
  v_old_code text;
  v_new_code text;
begin
  if new.status_id is not distinct from old.status_id then
    return new;
  end if;

  select code into v_old_code
  from milkrun.trip_statuses
  where id = old.status_id;

  select code into v_new_code
  from milkrun.trip_statuses
  where id = new.status_id and is_active and not is_deleted;

  if v_new_code is null or not (
    (v_old_code = 'REGISTERED' and v_new_code in ('STARTED', 'CANCELLED'))
    or (v_old_code = 'STARTED' and v_new_code in ('ARRIVED', 'CANCELLED'))
  ) then
    raise exception 'Invalid Milkrun Trip status transition: % -> %',
      coalesce(v_old_code, '<unknown>'), coalesce(v_new_code, '<unknown>');
  end if;

  return new;
end;
$$;

drop trigger if exists trips_validate_status_transition on milkrun.trips;
create trigger trips_validate_status_transition
before update of status_id on milkrun.trips
for each row execute function milkrun.validate_trip_status_transition();

create or replace function milkrun.create_trip(
  p_actor_id uuid,
  p_shop_id uuid,
  p_trip_type_id uuid,
  p_attachment_url text,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = milkrun, public, pg_temp
as $$
declare
  v_trip_id uuid := gen_random_uuid();
  v_area_id uuid;
  v_status_id uuid;
  v_item_count integer;
begin
  if not public.has_permission(p_actor_id, 'milkrun.trip.create') then
    raise exception 'Permission denied: milkrun.trip.create';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_actor_id
      and is_active and is_verified and not is_deleted
  ) then
    raise exception 'Authenticated driver is unavailable';
  end if;

  select id into v_area_id
  from public.areas
  where code = 'EDC_LOGISTICS' and is_active and not is_deleted;
  if v_area_id is null then
    raise exception 'Active EDC Logistics Area was not found';
  end if;

  if not exists (
    select 1 from milkrun.shops
    where id = p_shop_id and is_active and not is_deleted
  ) then
    raise exception 'Shop is unavailable';
  end if;

  if not exists (
    select 1 from milkrun.trip_types
    where id = p_trip_type_id and is_active and not is_deleted
  ) then
    raise exception 'Trip type is unavailable';
  end if;

  select id into v_status_id
  from milkrun.trip_statuses
  where code = 'REGISTERED' and is_active and not is_deleted;
  if v_status_id is null then
    raise exception 'REGISTERED Trip status was not found';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Trip must contain at least one item';
  end if;

  select count(*) into v_item_count
  from jsonb_array_elements(p_items) item
  where nullif(item ->> 'rack_id', '') is null
     or coalesce((item ->> 'quantity')::numeric, 0) <= 0;
  if v_item_count > 0 then
    raise exception 'Every Trip item requires rack_id and quantity greater than zero';
  end if;

  select count(*) into v_item_count
  from jsonb_array_elements(p_items) item
  left join milkrun.racks rack
    on rack.id = (item ->> 'rack_id')::uuid
   and rack.is_active and not rack.is_deleted
  where rack.id is null;
  if v_item_count > 0 then
    raise exception 'One or more racks are unavailable';
  end if;

  insert into milkrun.trips (
    id, code, driver_id, area_id, shop_id, trip_type_id, status_id,
    attachment_url, note
  ) values (
    v_trip_id,
    'TRIP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-'
      || upper(substr(replace(v_trip_id::text, '-', ''), 1, 8)),
    p_actor_id, v_area_id, p_shop_id, p_trip_type_id, v_status_id,
    nullif(btrim(p_attachment_url), ''), nullif(btrim(p_note), '')
  );

  insert into milkrun.trip_items (trip_id, rack_id, quantity, note)
  select
    v_trip_id,
    (item ->> 'rack_id')::uuid,
    (item ->> 'quantity')::numeric,
    nullif(btrim(item ->> 'note'), '')
  from jsonb_array_elements(p_items) item;

  return v_trip_id;
end;
$$;

create or replace function milkrun.transition_trip(
  p_actor_id uuid,
  p_trip_id uuid,
  p_action text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = milkrun, public, pg_temp
as $$
declare
  v_trip milkrun.trips%rowtype;
  v_current_code text;
  v_target_code text;
  v_permission_code text;
  v_target_status_id uuid;
begin
  select * into v_trip
  from milkrun.trips
  where id = p_trip_id and is_active and not is_deleted
  for update;
  if not found then
    raise exception 'Trip was not found';
  end if;

  if v_trip.driver_id <> p_actor_id
     and not public.has_permission(p_actor_id, 'milkrun.trip.read_all') then
    raise exception 'Trip ownership denied';
  end if;

  case lower(btrim(p_action))
    when 'start' then
      v_permission_code := 'milkrun.trip.start';
      v_target_code := 'STARTED';
    when 'arrive' then
      v_permission_code := 'milkrun.trip.arrive';
      v_target_code := 'ARRIVED';
    when 'cancel' then
      v_permission_code := 'milkrun.trip.create';
      v_target_code := 'CANCELLED';
    else
      raise exception 'Unsupported Trip action';
  end case;

  if not public.has_permission(p_actor_id, v_permission_code) then
    raise exception 'Permission denied: %', v_permission_code;
  end if;

  select code into v_current_code
  from milkrun.trip_statuses
  where id = v_trip.status_id;

  if (v_target_code = 'STARTED' and v_current_code <> 'REGISTERED')
     or (v_target_code = 'ARRIVED' and v_current_code <> 'STARTED')
     or (v_target_code = 'CANCELLED' and v_current_code not in ('REGISTERED', 'STARTED')) then
    raise exception 'Invalid Milkrun Trip action % from status %',
      p_action, coalesce(v_current_code, '<unknown>');
  end if;

  select id into v_target_status_id
  from milkrun.trip_statuses
  where code = v_target_code and is_active and not is_deleted;
  if v_target_status_id is null then
    raise exception 'Target Trip status % is unavailable', v_target_code;
  end if;

  update milkrun.trips
  set
    status_id = v_target_status_id,
    time_start = case when v_target_code = 'STARTED' then now() else time_start end,
    time_arrived = case when v_target_code = 'ARRIVED' then now() else time_arrived end,
    note = case
      when v_target_code = 'CANCELLED' and nullif(btrim(p_reason), '') is not null
        then concat_ws(E'\n', note, '[CANCELLED] ' || btrim(p_reason))
      else note
    end
  where id = p_trip_id;

  return p_trip_id;
end;
$$;

alter table milkrun.trips enable row level security;
alter table milkrun.trip_items enable row level security;

revoke all on milkrun.trips, milkrun.trip_items
  from public, anon, authenticated;
grant select, insert, update, delete on milkrun.trips, milkrun.trip_items
  to service_role;

revoke all on function milkrun.create_trip(uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function milkrun.create_trip(uuid, uuid, uuid, text, text, jsonb)
  to service_role;

revoke all on function milkrun.transition_trip(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function milkrun.transition_trip(uuid, uuid, text, text)
  to service_role;

commit;

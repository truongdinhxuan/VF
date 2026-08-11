-- Phase 5: shared Milkrun foundation only.
-- Milkrun reuses public identity/RBAC/Area data. This migration intentionally
-- does not create a milkrun schema, Trip, TripItems, Order, or Supply objects.

begin;

-- PermissionsCatalog is developer-owned. Re-seeding is replay-safe and makes
-- this migration safe for environments where the Phase 1 catalog was partial.
insert into public.permissions (
  code,
  name,
  module,
  description,
  is_system,
  is_active,
  is_deleted
)
values
  ('milkrun.trip.read_own', 'Xem chuyến của tôi', 'Milkrun', 'Filter driver_id by current user', true, true, false),
  ('milkrun.trip.read_all', 'Xem tất cả chuyến', 'Milkrun', 'Allow all trip list', true, true, false),
  ('milkrun.trip.create', 'Tạo chuyến', 'Milkrun', 'Guard POST trip', true, true, false),
  ('milkrun.trip.start', 'Bắt đầu chuyến', 'Milkrun', 'Guard trip start transition', true, true, false),
  ('milkrun.trip.arrive', 'Xác nhận tới Shop', 'Milkrun', 'Guard trip arrive transition', true, true, false),
  ('milkrun.trip.complete', 'Hoàn thành chuyến', 'Milkrun', 'Guard trip complete transition', true, true, false),
  ('milkrun.rack.read', 'Xem rack', 'Milkrun', 'Guard GET racks', true, true, false),
  ('milkrun.rack.create', 'Tạo rack', 'Milkrun', 'Guard POST rack', true, true, false),
  ('milkrun.rack.update', 'Sửa rack', 'Milkrun', 'Guard update rack', true, true, false),
  ('milkrun.stock.read', 'Xem tồn rack', 'Milkrun', 'Guard Milkrun stock read', true, true, false),
  ('milkrun.stock.adjust', 'Cân tồn rack', 'Milkrun', 'Guard Milkrun stock adjustment', true, true, false),
  ('milkrun.vehicle.read', 'Xem xe', 'Milkrun', 'Guard GET vehicles', true, true, false),
  ('milkrun.vehicle.assign', 'Gán/đổi xe', 'Milkrun', 'Guard vehicle assignment', true, true, false),
  ('milkrun.dashboard.read', 'Xem dashboard Milkrun', 'Milkrun', 'Guard Milkrun dashboard', true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

-- A same-name row with another code is ambiguous. Stop instead of silently
-- creating two business Areas or rewriting an existing Area code.
do $$
begin
  if exists (
    select 1
    from public.areas
    where lower(btrim(name)) = lower('EDC Logistics')
      and code <> 'EDC_LOGISTICS'
  ) then
    raise exception
      'Area named EDC Logistics already exists with another code; map it explicitly before Phase 5';
  end if;
end;
$$;

insert into public.areas (
  code,
  name,
  description,
  is_active,
  is_deleted
)
values (
  'EDC_LOGISTICS',
  'EDC Logistics',
  'Shared Area used by Milkrun',
  true,
  false
)
on conflict (code) do update
set
  name = excluded.name,
  description = coalesce(public.areas.description, excluded.description),
  is_active = true,
  is_deleted = false,
  updated_at = now();

do $$
declare
  v_permission_count integer;
  v_area_count integer;
begin
  select count(*)
  into v_permission_count
  from public.permissions
  where module = 'Milkrun'
    and is_system = true
    and is_active = true
    and is_deleted = false;

  if v_permission_count <> 14 then
    raise exception 'Expected 14 active Milkrun permissions, found %', v_permission_count;
  end if;

  select count(*)
  into v_area_count
  from public.areas
  where code = 'EDC_LOGISTICS'
    and name = 'EDC Logistics'
    and is_active = true
    and is_deleted = false;

  if v_area_count <> 1 then
    raise exception 'Expected one active EDC Logistics Area, found %', v_area_count;
  end if;
end;
$$;

commit;

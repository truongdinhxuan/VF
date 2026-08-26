begin;

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
  ('milkrun.trip_type.read', 'Xem loại chuyến', 'Milkrun', 'Cho phép xem danh mục loại chuyến', true, true, false),
  ('milkrun.trip_type.create', 'Tạo loại chuyến', 'Milkrun', 'Cho phép tạo loại chuyến', true, true, false),
  ('milkrun.trip_type.update', 'Cập nhật loại chuyến', 'Milkrun', 'Cho phép cập nhật loại chuyến', true, true, false),
  ('milkrun.trip_type.deactivate', 'Ngừng sử dụng loại chuyến', 'Milkrun', 'Cho phép deactivate loại chuyến', true, true, false),
  ('milkrun.trip_status.read', 'Xem trạng thái chuyến', 'Milkrun', 'Cho phép xem danh mục trạng thái chuyến', true, true, false),
  ('milkrun.trip_status.create', 'Tạo trạng thái chuyến', 'Milkrun', 'Cho phép tạo trạng thái chuyến', true, true, false),
  ('milkrun.trip_status.update', 'Cập nhật trạng thái chuyến', 'Milkrun', 'Cho phép cập nhật trạng thái chuyến', true, true, false),
  ('milkrun.trip_status.deactivate', 'Ngừng sử dụng trạng thái chuyến', 'Milkrun', 'Cho phép deactivate trạng thái chuyến', true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.permissions
  where code in (
    'milkrun.trip_type.read',
    'milkrun.trip_type.create',
    'milkrun.trip_type.update',
    'milkrun.trip_type.deactivate',
    'milkrun.trip_status.read',
    'milkrun.trip_status.create',
    'milkrun.trip_status.update',
    'milkrun.trip_status.deactivate'
  )
    and module = 'Milkrun'
    and is_system = true
    and is_active = true
    and is_deleted = false;

  if v_count <> 8 then
    raise exception 'Expected 8 active Trip Type/Status permissions, found %', v_count;
  end if;
end;
$$;

commit;

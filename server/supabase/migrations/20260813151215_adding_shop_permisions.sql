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
  (
    'milkrun.shop.read',
    'Xem Shop',
    'Milkrun',
    'Cho phép xem danh mục Shop',
    true,
    true,
    false
  ),
  (
    'milkrun.shop.create',
    'Tạo Shop',
    'Milkrun',
    'Cho phép tạo Shop',
    true,
    true,
    false
  ),
  (
    'milkrun.shop.update',
    'Cập nhật Shop',
    'Milkrun',
    'Cho phép cập nhật Shop',
    true,
    true,
    false
  ),
  (
    'milkrun.shop.deactivate',
    'Ngừng sử dụng Shop',
    'Milkrun',
    'Cho phép deactivate Shop',
    true,
    true,
    false
  )
on conflict (code) do update
set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();
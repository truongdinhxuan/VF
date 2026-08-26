# Hướng dẫn thêm Permission

Tài liệu này mô tả cách thêm một permission mới vào hệ thống RBAC của dự án VF.

> Lưu ý: tên file được giữ theo yêu cầu. Trong code và database, thuật ngữ đúng là `permission` hoặc `permissions`.

## 1. Kiến trúc RBAC hiện tại

Các bảng authorization dùng chung được giữ trong schema `public`:

```text
public.users
  -> public.user_roles
  -> public.roles
  -> public.role_permissions
  -> public.permissions
```

Permission không chuyển sang schema `supply` hoặc `milkrun`. Permission trong `public` có thể bảo vệ API của mọi business domain.

Backend xác thực quyền theo `permission.code`, không theo tên Role:

```ts
requirePermission(PERMISSION_CODE.MILKRUN_SHOP_CREATE)
```

Không viết authorization theo Role name:

```ts
// Không sử dụng
if (role === 'ADMIN') {}
if (role === 'DATA_MILKRUN') {}
```

System ADMIN được backend nhận diện chính xác bằng:

```text
roles.code = ADMIN
roles.is_system = true
```

Custom Role có tên hoặc code gần giống `ADMIN` không được system-admin bypass.

## 2. Quy tắc đặt permission code

Định dạng khuyến nghị:

```text
<domain>.<resource>.<action>
```

Ví dụ:

```text
milkrun.shop.read
milkrun.shop.create
milkrun.shop.update
milkrun.shop.deactivate

supply.catalog.read
supply.stock.adjust

admin.user.create
admin.role.assign_permission
```

Quy tắc:

- Dùng chữ thường.
- Dùng dấu chấm để phân tách domain, resource và action.
- Không dùng label hiển thị làm business authorization.
- Không hard-code UUID của permission.
- Không tạo hai code khác nhau cho cùng một hành động.
- Ưu tiên `deactivate` thay cho `delete` nếu dữ liệu dùng soft delete.

## 3. Thêm permission bằng migration

Permission hệ thống phải được thêm bằng migration mới. Không sửa migration đã deploy.

Tạo file trong:

```text
server/supabase/migrations/<timestamp>_add_<feature>_permissions.sql
```

Ví dụ:

```sql
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
```

Migration phải replay-safe bằng `on conflict (code)`.

## 4. Gán permission hệ thống cho ADMIN

Nên map permission mới cho system ADMIN ngay trong migration:

```sql
insert into public.role_permissions (
  role_id,
  permission_id,
  is_active,
  is_deleted
)
select
  role_record.id,
  permission_record.id,
  true,
  false
from public.roles as role_record
join public.permissions as permission_record
  on permission_record.code in (
    'milkrun.shop.read',
    'milkrun.shop.create',
    'milkrun.shop.update',
    'milkrun.shop.deactivate'
  )
where role_record.code = 'ADMIN'
  and role_record.is_system = true
  and role_record.is_active = true
  and role_record.is_deleted = false
on conflict (role_id, permission_id) do update
set
  is_active = true,
  is_deleted = false,
  updated_at = now();
```

ADMIN hiện có system bypass, nhưng vẫn nên tạo mapping để:

- Permission matrix hiển thị đầy đủ.
- Database audit rõ ràng.
- Dữ liệu nhất quán nếu cơ chế bypass thay đổi sau này.

## 5. Khai báo permission trong backend

Cập nhật:

```text
server/src/domain/permission-codes.ts
```

Ví dụ:

```ts
export const PERMISSION_CODE = {
  // Permission hiện có...
  MILKRUN_SHOP_READ: 'milkrun.shop.read',
  MILKRUN_SHOP_CREATE: 'milkrun.shop.create',
  MILKRUN_SHOP_UPDATE: 'milkrun.shop.update',
  MILKRUN_SHOP_DEACTIVATE: 'milkrun.shop.deactivate',
} as const;
```

Bước này bắt buộc. Authorization service đang whitelist permission qua `isPermissionCode()`. Permission chỉ có trong database nhưng thiếu constant backend có thể không xuất hiện trong effective permissions.

## 6. Bảo vệ backend route

Mỗi endpoint dùng permission đúng trách nhiệm:

```ts
fastify.get('/', {
  preHandler: [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_SHOP_READ),
  ],
}, handlers.list);

fastify.post('/', {
  preHandler: [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_SHOP_CREATE),
  ],
}, handlers.create);

fastify.patch('/:id', {
  preHandler: [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_SHOP_UPDATE),
  ],
}, handlers.update);

fastify.patch('/:id/deactivate', {
  preHandler: [
    verifyToken,
    requirePermission(PERMISSION_CODE.MILKRUN_SHOP_DEACTIVATE),
  ],
}, handlers.deactivate);
```

Không dùng permission của feature khác để thay thế:

```ts
// Sai: quyền tạo Trip không phải quyền quản lý Shop
requirePermission(PERMISSION_CODE.MILKRUN_TRIP_CREATE)
```

Không dùng `requireSystemAdmin` nếu custom Role cũng được phép thực hiện chức năng đó. Chỉ sử dụng system-admin guard cho nghiệp vụ thật sự dành riêng cho system ADMIN và chưa có permission phù hợp.

## 7. Khai báo permission trong frontend

Cập nhật:

```text
client/src/constants/permissions.ts
```

Permission code phải giống tuyệt đối backend và database:

```ts
export const PERMISSION_CODE = {
  // Permission hiện có...
  MILKRUN_SHOP_READ: 'milkrun.shop.read',
  MILKRUN_SHOP_CREATE: 'milkrun.shop.create',
  MILKRUN_SHOP_UPDATE: 'milkrun.shop.update',
  MILKRUN_SHOP_DEACTIVATE: 'milkrun.shop.deactivate',
} as const;
```

Ẩn/hiện action bằng `hasPermission`:

```ts
const { hasPermission } = useAuth();

const canCreate = hasPermission(PERMISSION_CODE.MILKRUN_SHOP_CREATE);
const canUpdate = hasPermission(PERMISSION_CODE.MILKRUN_SHOP_UPDATE);
const canDeactivate = hasPermission(
  PERMISSION_CODE.MILKRUN_SHOP_DEACTIVATE,
);
```

Frontend permission chỉ phục vụ UX. Backend `requirePermission()` vẫn là security boundary.

## 8. Permission cho route và menu frontend

Route guard nên dùng permission read:

```tsx
{
  path: 'milkrun/shops',
  element: guarded(
    [PERMISSION_CODE.MILKRUN_SHOP_READ],
    <MilkrunShopsPage />,
  ),
}
```

Menu config:

```ts
{
  path: 'milkrun/shops',
  label: 'Shop',
  permission: PERMISSION_CODE.MILKRUN_SHOP_READ,
}
```

Các nút Create, Edit và Deactivate kiểm tra permission riêng trong page.

## 9. Gán permission cho custom Role

Hệ thống đã có API:

```http
GET /permissions?page=1&pageSize=100
GET /roles/:id/permissions
PUT /roles/:id/permissions
```

Trong UI:

```text
Administration
  -> Roles
  -> chọn Role
  -> Permissions
  -> chọn permission
  -> Lưu permissions
```

Payload API:

```json
{
  "permission_ids": [
    "permission-uuid-1",
    "permission-uuid-2"
  ]
}
```

`PUT /roles/:id/permissions` thay thế toàn bộ permission của Role. Payload phải chứa cả permission cũ muốn giữ và permission mới muốn thêm.

Không hard-code UUID. UI phải lấy ID từ `GET /permissions`.

## 10. Gán Role cho User

API hiện có:

```http
GET /users/:id/roles
PUT /users/:id/roles
```

Payload:

```json
{
  "role_ids": [
    "role-uuid-operator"
  ]
}
```

Endpoint này cũng thay thế toàn bộ Role của User. User phải còn ít nhất một Role.

Effective permission là hợp của permission từ tất cả Role hợp lệ của User.

## 11. Refresh permission sau khi gán

Backend resolve permission ở mỗi authenticated request nên quyền mới có hiệu lực ngay ở backend.

Frontend giữ permissions trong `AuthContext`. Sau khi thay Role hoặc permission:

- Đăng xuất rồi đăng nhập lại; hoặc
- Gọi lại `/auth/me` và cập nhật AuthContext.

Nếu backend cho phép nhưng frontend vẫn ẩn nút, kiểm tra response `/auth/me`:

```json
{
  "permissions": [
    "milkrun.shop.read",
    "milkrun.shop.create"
  ],
  "isSystemAdmin": false
}
```

## 12. Chạy migration

Từ thư mục `server`:

```powershell
cd E:\VF\server
npx.cmd supabase migration list --linked
npx.cmd supabase db push
```

Sau khi push, kiểm tra migration history và dữ liệu permission trước khi deploy code sử dụng permission mới.

## 13. Checklist khi thêm permission mới

- [ ] Permission đã được xác nhận trong PermissionsCatalog hoặc tài liệu nghiệp vụ.
- [ ] Migration mới insert `public.permissions` và replay-safe.
- [ ] System ADMIN được map permission mới.
- [ ] Backend constant đã được cập nhật.
- [ ] Frontend constant đã được cập nhật.
- [ ] Backend route dùng đúng `requirePermission()`.
- [ ] Không còn role-name authorization cho chức năng mới.
- [ ] Route/menu/action frontend dùng đúng permission.
- [ ] Permission đã được gán cho custom Role phù hợp.
- [ ] Role đã được gán cho User phù hợp.
- [ ] User không có permission nhận HTTP 403.
- [ ] User có permission thực hiện thành công.
- [ ] Custom Role hoạt động mà không cần tên Role đặc biệt.
- [ ] System ADMIN hoạt động.
- [ ] `/auth/me` trả effective permissions đúng.
- [ ] Backend và frontend build thành công.

## 14. Các lỗi thường gặp

### Permission có trong database nhưng backend vẫn trả 403

Kiểm tra:

1. Code đã có trong `server/src/domain/permission-codes.ts` chưa.
2. Permission có `is_active = true` và `is_deleted = false` không.
3. Role có active và chưa deleted không.
4. Mapping `role_permissions` có active và chưa deleted không.
5. Mapping `user_roles` có active và chưa deleted không.
6. User có active, verified và chưa deleted không.

### Backend cho phép nhưng frontend vẫn ẩn action

Kiểm tra:

1. Constant frontend có đúng code không.
2. `/auth/me` có trả permission mới không.
3. AuthContext đã refresh sau khi thay permission chưa.
4. Page có đang hard-code chế độ read-only không.

### Custom Role không sử dụng được API

Không thêm `requireSystemAdmin` vào route nếu chức năng được phép cấp cho custom Role. Chỉ dùng:

```ts
verifyToken,
requirePermission(PERMISSION_CODE.<PERMISSION>)
```

### ADMIN thấy trang nhưng không có nút CRUD

Kiểm tra page có thực sự gọi `hasPermission()` và render form/action hay không. System-admin bypass không tự tạo giao diện CRUD cho một page đang được code cố định chỉ đọc.

## 15. Permission CRUD Loại chuyến và Trạng thái chuyến

Migration `20260821143648_add_trip_type_status_permissions.sql` thêm tám code:

```text
milkrun.trip_type.read
milkrun.trip_type.create
milkrun.trip_type.update
milkrun.trip_type.deactivate
milkrun.trip_status.read
milkrun.trip_status.create
milkrun.trip_status.update
milkrun.trip_status.deactivate
```

Backend route dùng từng permission đúng action; không dùng lại `milkrun.trip.create`.
System ADMIN được middleware bypass chính xác bằng role code `ADMIN` và `is_system=true`.
Custom Role phải được gán permission trong trang Roles hoặc qua API replace permission.

Lưu ý: replace permission là thay toàn bộ danh sách. Khi gọi API phải gửi cả permission cũ cần giữ và permission mới, không chỉ gửi tám ID ở trên.

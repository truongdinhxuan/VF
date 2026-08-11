-- Dynamic RBAC foundation from Milkrun-Codex-Spec-RBAC-First.xlsx.
--
-- Scope:
--   * shared/public RBAC tables only;
--   * preserve users.role_id for backward compatibility;
--   * no Milkrun domain tables;
--   * no Supply table rename/drop in this migration.

begin;

create extension if not exists pgcrypto;

-- ADMIN is the only system role. Existing Supply roles remain normal role
-- templates and are intentionally preserved.
insert into public.roles (
  id,
  code,
  name,
  description,
  is_system,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  'ADMIN',
  'Administrator',
  'System administrator',
  true,
  true,
  false,
  now(),
  now()
)
on conflict (code) do update
set
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

update public.roles
set
  is_system = (code = 'ADMIN'),
  updated_at = now()
where is_system is distinct from (code = 'ADMIN');

-- Role names are business identifiers in the Admin workflow. Abort with a
-- clear error instead of deleting or merging existing data automatically.
do $$
declare
  v_duplicate_name text;
begin
  select name
  into v_duplicate_name
  from public.roles
  group by name
  having count(*) > 1
  limit 1;

  if v_duplicate_name is not null then
    raise exception 'Cannot add roles.name unique index: duplicate name %',
      v_duplicate_name;
  end if;
end
$$;

create unique index if not exists roles_name_key on public.roles(name);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module text not null,
  description text,
  is_system boolean not null default true,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_code_key unique (code)
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null,
  permission_id uuid not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_permissions_role_id_fkey
    foreign key (role_id) references public.roles(id)
    on delete restrict on update cascade,
  constraint role_permissions_permission_id_fkey
    foreign key (permission_id) references public.permissions(id)
    on delete restrict on update cascade,
  constraint role_permissions_role_permission_key
    unique (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_user_id_fkey
    foreign key (user_id) references public.users(id)
    on delete restrict on update cascade,
  constraint user_roles_role_id_fkey
    foreign key (role_id) references public.roles(id)
    on delete restrict on update cascade,
  constraint user_roles_user_role_key unique (user_id, role_id)
);

create index role_permissions_role_id_idx
  on public.role_permissions(role_id);
create index role_permissions_permission_id_idx
  on public.role_permissions(permission_id);
create index user_roles_user_id_idx on public.user_roles(user_id);
create index user_roles_role_id_idx on public.user_roles(role_id);

drop trigger if exists permissions_set_updated_at on public.permissions;
create trigger permissions_set_updated_at
before update on public.permissions
for each row execute function public.set_updated_at();

drop trigger if exists role_permissions_set_updated_at
  on public.role_permissions;
create trigger role_permissions_set_updated_at
before update on public.role_permissions
for each row execute function public.set_updated_at();

drop trigger if exists user_roles_set_updated_at on public.user_roles;
create trigger user_roles_set_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

-- Permission catalog is owned by Developer/System. Codes are stable and all
-- lookups use code rather than UUID or translated display name.
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
  ('admin.user.read', 'Xem người dùng', 'Admin', 'Guard GET users/user detail', true, true, false),
  ('admin.user.create', 'Tạo người dùng', 'Admin', 'Guard POST user', true, true, false),
  ('admin.user.update', 'Sửa người dùng', 'Admin', 'Guard PUT/PATCH user', true, true, false),
  ('admin.role.read', 'Xem role', 'Admin', 'Guard GET roles', true, true, false),
  ('admin.role.create', 'Tạo role', 'Admin', 'Guard POST role', true, true, false),
  ('admin.role.update', 'Sửa role', 'Admin', 'Guard PUT/PATCH role', true, true, false),
  ('admin.role.assign_permission', 'Gán quyền cho role', 'Admin', 'Guard role permission mapping', true, true, false),
  ('admin.user.assign_role', 'Gán role cho user', 'Admin', 'Guard user role mapping', true, true, false),
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
  ('milkrun.dashboard.read', 'Xem dashboard Milkrun', 'Milkrun', 'Guard Milkrun dashboard', true, true, false),
  ('supply.stock.read', 'Xem tồn vật tư', 'Supply', 'Guard Supply stock read', true, true, false),
  ('supply.stock.adjust', 'Điều chỉnh tồn vật tư', 'Supply', 'Guard Supply stock adjustment', true, true, false),
  ('supply.order.create', 'Tạo order vật tư', 'Supply', 'Guard Supply order create', true, true, false),
  ('supply.order.approve', 'Duyệt order vật tư', 'Supply', 'Guard Supply order approval', true, true, false),
  ('supply.dashboard.read', 'Xem dashboard vật tư', 'Supply', 'Guard Supply dashboard', true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

-- Seed the closest representation possible from the workbook catalog while
-- preserving current Supply role behavior. Missing capabilities (master-data
-- CRUD, Provider CRUD and issue-specific authorization) are intentionally not
-- invented here and must be resolved in the permission catalog before Phase 2.
with seed(role_code, permission_code) as (
  values
    ('DATA_PACKING', 'supply.order.create'),
    ('DATA_PACKING', 'supply.dashboard.read'),
    ('DATA_MATERIAL', 'supply.stock.read'),
    ('DATA_MATERIAL', 'supply.stock.adjust'),
    ('DATA_MATERIAL', 'supply.order.approve'),
    ('DATA_MATERIAL', 'supply.dashboard.read'),
    ('MATERIAL_LEADER', 'supply.stock.read'),
    ('MATERIAL_LEADER', 'supply.stock.adjust'),
    ('MATERIAL_LEADER', 'supply.order.approve'),
    ('MATERIAL_LEADER', 'supply.dashboard.read'),
    ('MATERIAL_CONTROL', 'admin.user.read'),
    ('MATERIAL_CONTROL', 'supply.stock.read'),
    ('MATERIAL_CONTROL', 'supply.stock.adjust'),
    ('MATERIAL_CONTROL', 'supply.order.approve'),
    ('MATERIAL_CONTROL', 'supply.dashboard.read')
)
insert into public.role_permissions (
  role_id,
  permission_id,
  is_active,
  is_deleted
)
select r.id, p.id, true, false
from seed
join public.roles r on r.code = seed.role_code
join public.permissions p on p.code = seed.permission_code
on conflict (role_id, permission_id) do update
set
  is_active = true,
  is_deleted = false,
  updated_at = now();

-- ADMIN receives the entire system catalog. Phase 2 will additionally keep
-- the documented ADMIN bypass so adding a new permission cannot lock ADMIN out.
insert into public.role_permissions (
  role_id,
  permission_id,
  is_active,
  is_deleted
)
select r.id, p.id, true, false
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'
  and p.is_system = true
on conflict (role_id, permission_id) do update
set
  is_active = true,
  is_deleted = false,
  updated_at = now();

-- One-time, non-destructive migration from the legacy single-role column.
-- users.role_id remains in place until backend and frontend have switched.
insert into public.user_roles (
  user_id,
  role_id,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
select
  u.id,
  u.role_id,
  u.is_active and not u.is_deleted,
  u.is_deleted,
  u.created_at,
  u.updated_at
from public.users u
where u.role_id is not null
on conflict (user_id, role_id) do update
set
  is_active = excluded.is_active,
  is_deleted = excluded.is_deleted,
  updated_at = excluded.updated_at;

do $$
declare
  v_expected bigint;
  v_actual bigint;
begin
  select count(*)
  into v_expected
  from public.users
  where role_id is not null;

  select count(*)
  into v_actual
  from public.users u
  join public.user_roles ur
    on ur.user_id = u.id
   and ur.role_id = u.role_id
  where u.role_id is not null;

  if v_actual <> v_expected then
    raise exception
      'users.role_id backfill verification failed: expected %, found %',
      v_expected,
      v_actual;
  end if;
end
$$;

-- Keep legacy writes consistent during the staged cut-over. This is one-way:
-- user_roles becomes authoritative in Phase 2, while users.role_id is not
-- removed or reverse-synced because a multi-role user has no single value.
create or replace function public.sync_legacy_user_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.role_id is distinct from new.role_id
     and old.role_id is not null then
    update public.user_roles
    set
      is_active = false,
      is_deleted = true,
      updated_at = now()
    where user_id = old.id
      and role_id = old.role_id;
  end if;

  if new.role_id is not null then
    insert into public.user_roles (
      user_id,
      role_id,
      is_active,
      is_deleted
    )
    values (
      new.id,
      new.role_id,
      new.is_active and not new.is_deleted,
      new.is_deleted
    )
    on conflict (user_id, role_id) do update
    set
      is_active = excluded.is_active,
      is_deleted = excluded.is_deleted,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists users_sync_legacy_user_role on public.users;
create trigger users_sync_legacy_user_role
after insert or update of role_id, is_active, is_deleted on public.users
for each row execute function public.sync_legacy_user_role();

-- Protect the only system role at the database boundary. Other legacy roles
-- are normal editable templates after this migration.
create or replace function public.protect_admin_system_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.code = 'ADMIN' then
    raise exception 'ADMIN system role cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.code = 'ADMIN' and (
    new.code is distinct from 'ADMIN'
    or new.is_system is distinct from true
    or new.is_active is distinct from true
    or new.is_deleted is distinct from false
  ) then
    raise exception 'ADMIN system role code and active state are protected';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists roles_protect_admin_system_role on public.roles;
create trigger roles_protect_admin_system_role
before update or delete on public.roles
for each row execute function public.protect_admin_system_role();

-- Prevent the legacy user path from disabling/removing the final usable ADMIN.
create or replace function public.protect_last_legacy_admin_user()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_is_admin boolean;
  v_new_is_admin boolean := false;
  v_other_admin_exists boolean;
begin
  select exists (
    select 1
    from public.roles r
    where r.id = old.role_id
      and r.code = 'ADMIN'
      and r.is_active = true
      and r.is_deleted = false
  ) and old.is_active and old.is_verified and not old.is_deleted
  into v_old_is_admin;

  if not v_old_is_admin then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    select exists (
      select 1
      from public.roles r
      where r.id = new.role_id
        and r.code = 'ADMIN'
        and r.is_active = true
        and r.is_deleted = false
    ) and new.is_active and new.is_verified and not new.is_deleted
    into v_new_is_admin;

    if v_new_is_admin then
      return new;
    end if;
  end if;

  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id <> old.id
      and u.is_active = true
      and u.is_verified = true
      and u.is_deleted = false
      and r.code = 'ADMIN'
      and r.is_active = true
      and r.is_deleted = false
  )
  into v_other_admin_exists;

  if not v_other_admin_exists then
    raise exception 'The final active verified ADMIN user cannot be removed or disabled';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists users_protect_last_legacy_admin on public.users;
create trigger users_protect_last_legacy_admin
before update of role_id, is_active, is_verified, is_deleted or delete
on public.users
for each row execute function public.protect_last_legacy_admin_user();

-- The same lockout guard protects the new N-N mapping path.
create or replace function public.protect_last_admin_user_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_is_effective_admin boolean;
  v_new_keeps_admin boolean := false;
  v_other_admin_exists boolean;
begin
  select exists (
    select 1
    from public.roles r
    join public.users u on u.id = old.user_id
    where r.id = old.role_id
      and r.code = 'ADMIN'
      and r.is_active = true
      and r.is_deleted = false
      and u.is_active = true
      and u.is_verified = true
      and u.is_deleted = false
  ) and old.is_active and not old.is_deleted
  into v_old_is_effective_admin;

  if not v_old_is_effective_admin then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    select exists (
      select 1
      from public.roles r
      join public.users u on u.id = new.user_id
      where r.id = new.role_id
        and r.code = 'ADMIN'
        and r.is_active = true
        and r.is_deleted = false
        and u.is_active = true
        and u.is_verified = true
        and u.is_deleted = false
    ) and new.is_active and not new.is_deleted
    into v_new_keeps_admin;

    if v_new_keeps_admin then
      return new;
    end if;
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.users u on u.id = ur.user_id
    where ur.id <> old.id
      and ur.is_active = true
      and ur.is_deleted = false
      and r.code = 'ADMIN'
      and r.is_active = true
      and r.is_deleted = false
      and u.is_active = true
      and u.is_verified = true
      and u.is_deleted = false
  )
  into v_other_admin_exists;

  if not v_other_admin_exists then
    raise exception 'The final active ADMIN user-role mapping cannot be removed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists user_roles_protect_last_admin
  on public.user_roles;
create trigger user_roles_protect_last_admin
before update or delete on public.user_roles
for each row execute function public.protect_last_admin_user_role();

-- New RBAC tables are server-only. Fastify uses service_role, which bypasses
-- RLS; browser roles receive no direct table privileges or policies.
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

revoke all on table public.permissions
  from public, anon, authenticated;
revoke all on table public.role_permissions
  from public, anon, authenticated;
revoke all on table public.user_roles
  from public, anon, authenticated;

grant select, insert, update, delete on table public.permissions
  to service_role;
grant select, insert, update, delete on table public.role_permissions
  to service_role;
grant select, insert, update, delete on table public.user_roles
  to service_role;

commit;

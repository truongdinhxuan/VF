-- Phase 3: complete Supply permission catalog and make database RPC
-- authorization use the same dynamic RBAC model as Fastify.
begin;

insert into public.permissions (
  code, name, module, description, is_system, is_active, is_deleted
)
values
  ('supply.catalog.read', 'Xem danh mục vật tư', 'Supply', 'Guard GET Supply catalog/master data', true, true, false),
  ('supply.catalog.create', 'Tạo danh mục vật tư', 'Supply', 'Guard POST Supply catalog/master data', true, true, false),
  ('supply.catalog.update', 'Sửa danh mục vật tư', 'Supply', 'Guard PATCH Supply catalog/master data', true, true, false),
  ('supply.catalog.delete', 'Xóa mềm danh mục vật tư', 'Supply', 'Guard soft delete/deactivate Supply catalog', true, true, false),
  ('supply.order.issue', 'Cấp hàng theo Order', 'Supply', 'Guard issue_order', true, true, false)
on conflict (code) do update
set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  is_system = true,
  is_active = true,
  is_deleted = false,
  updated_at = now();

-- Preserve the Supply access which existed before the semantic permission
-- split. ADMIN additionally receives every system permission.
with seed(role_code, permission_code) as (
  values
    ('DATA_PACKING', 'supply.catalog.read'),
    ('DATA_MATERIAL', 'supply.catalog.read'),
    ('DATA_MATERIAL', 'supply.catalog.create'),
    ('DATA_MATERIAL', 'supply.catalog.update'),
    ('DATA_MATERIAL', 'supply.catalog.delete'),
    ('DATA_MATERIAL', 'supply.order.issue'),
    ('MATERIAL_LEADER', 'supply.catalog.read'),
    ('MATERIAL_LEADER', 'supply.catalog.create'),
    ('MATERIAL_LEADER', 'supply.catalog.update'),
    ('MATERIAL_LEADER', 'supply.catalog.delete'),
    ('MATERIAL_LEADER', 'supply.order.issue'),
    ('MATERIAL_CONTROL', 'supply.catalog.read'),
    ('MATERIAL_CONTROL', 'supply.catalog.create'),
    ('MATERIAL_CONTROL', 'supply.catalog.update'),
    ('MATERIAL_CONTROL', 'supply.catalog.delete'),
    ('MATERIAL_CONTROL', 'supply.order.issue')
)
insert into public.role_permissions (role_id, permission_id, is_active, is_deleted)
select r.id, p.id, true, false
from seed
join public.roles r on r.code = seed.role_code
join public.permissions p on p.code = seed.permission_code
on conflict (role_id, permission_id) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.role_permissions (role_id, permission_id, is_active, is_deleted)
select r.id, p.id, true, false
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'
  and r.is_system = true
  and p.is_system = true
on conflict (role_id, permission_id) do update
set is_active = true, is_deleted = false, updated_at = now();

create or replace function public.has_permission(
  p_user_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.users u
      join public.user_roles ur on ur.user_id = u.id
      join public.roles r on r.id = ur.role_id
      where u.id = p_user_id
        and u.is_active = true
        and u.is_verified = true
        and u.is_deleted = false
        and ur.is_active = true
        and ur.is_deleted = false
        and r.code = 'ADMIN'
        and r.is_system = true
        and r.is_active = true
        and r.is_deleted = false
    )
    or exists (
      select 1
      from public.users u
      join public.user_roles ur on ur.user_id = u.id
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where u.id = p_user_id
        and u.is_active = true
        and u.is_verified = true
        and u.is_deleted = false
        and ur.is_active = true
        and ur.is_deleted = false
        and r.is_active = true
        and r.is_deleted = false
        and rp.is_active = true
        and rp.is_deleted = false
        and p.is_active = true
        and p.is_deleted = false
        and p.code = p_permission_code
    );
$$;

revoke all on function public.has_permission(uuid, text)
  from public, anon, authenticated;
grant execute on function public.has_permission(uuid, text) to service_role;

-- Atomic role-permission replacement. Permission rows are system-owned; this
-- function only changes mappings and cannot create or mutate a permission.
create or replace function public.replace_role_permissions(
  p_role_id uuid,
  p_permission_ids uuid[],
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested_count integer;
  v_valid_count integer;
begin
  if not public.has_permission(p_actor_id, 'admin.role.assign_permission') then
    raise exception 'Actor does not have admin.role.assign_permission';
  end if;

  select coalesce(array_agg(distinct value), array[]::uuid[])
  into p_permission_ids
  from unnest(coalesce(p_permission_ids, array[]::uuid[])) value;

  if not exists (
    select 1 from public.roles
    where id = p_role_id and is_active = true and is_deleted = false
  ) then
    raise exception 'Role not found or inactive';
  end if;

  select count(distinct value), count(distinct p.id)
  into v_requested_count, v_valid_count
  from unnest(coalesce(p_permission_ids, array[]::uuid[])) value
  left join public.permissions p
    on p.id = value and p.is_active = true and p.is_deleted = false;

  if v_requested_count <> v_valid_count then
    raise exception 'One or more permissions are invalid or inactive';
  end if;

  update public.role_permissions
  set is_active = false, is_deleted = true, updated_at = now()
  where role_id = p_role_id
    and permission_id <> all(coalesce(p_permission_ids, array[]::uuid[]));

  insert into public.role_permissions (role_id, permission_id, is_active, is_deleted)
  select p_role_id, value, true, false
  from unnest(coalesce(p_permission_ids, array[]::uuid[])) value
  on conflict (role_id, permission_id) do update
  set is_active = true, is_deleted = false, updated_at = now();
end;
$$;

revoke all on function public.replace_role_permissions(uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.replace_role_permissions(uuid, uuid[], uuid)
  to service_role;

create or replace function public.replace_user_roles(
  p_user_id uuid,
  p_role_ids uuid[],
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested_count integer;
  v_valid_count integer;
  v_primary_role_id uuid;
  v_legacy_role_id uuid;
begin
  if not public.has_permission(p_actor_id, 'admin.user.assign_role') then
    raise exception 'Actor does not have admin.user.assign_role';
  end if;
  select coalesce(array_agg(distinct value), array[]::uuid[])
  into p_role_ids
  from unnest(coalesce(p_role_ids, array[]::uuid[])) value;
  if cardinality(coalesce(p_role_ids, array[]::uuid[])) = 0 then
    raise exception 'At least one role is required';
  end if;
  select role_id into v_legacy_role_id
  from public.users
  where id = p_user_id and is_deleted = false
  for update;
  if not found then
    raise exception 'User not found';
  end if;

  select count(distinct value), count(distinct r.id)
  into v_requested_count, v_valid_count
  from unnest(p_role_ids) value
  left join public.roles r
    on r.id = value and r.is_active = true and r.is_deleted = false;

  select case
    when v_legacy_role_id = any(p_role_ids) then v_legacy_role_id
    else min(value::text)::uuid
  end
  into v_primary_role_id
  from unnest(p_role_ids) value;

  if v_requested_count <> v_valid_count then
    raise exception 'One or more roles are invalid or inactive';
  end if;

  -- Compatibility projection first; the legacy sync trigger may alter the old
  -- primary mapping. The authoritative set is restored immediately below.
  update public.users set role_id = v_primary_role_id where id = p_user_id;

  update public.user_roles
  set is_active = false, is_deleted = true, updated_at = now()
  where user_id = p_user_id
    and role_id <> all(p_role_ids);

  insert into public.user_roles (user_id, role_id, is_active, is_deleted)
  select p_user_id, value, true, false
  from unnest(p_role_ids) value
  on conflict (user_id, role_id) do update
  set is_active = true, is_deleted = false, updated_at = now();

end;
$$;

revoke all on function public.replace_user_roles(uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.replace_user_roles(uuid, uuid[], uuid)
  to service_role;

create or replace function public.create_internal_user_with_roles(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_vinfast_id integer,
  p_phone_number text,
  p_avatar_url text,
  p_role_ids uuid[],
  p_area_id uuid,
  p_managed_by_user_id uuid,
  p_password_hash text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_primary_role_id uuid;
begin
  if not public.has_permission(p_actor_id, 'admin.user.create')
     or not public.has_permission(p_actor_id, 'admin.user.assign_role') then
    raise exception 'Actor cannot create users and assign roles';
  end if;
  if cardinality(coalesce(p_role_ids, array[]::uuid[])) = 0 then
    raise exception 'At least one role is required';
  end if;

  select min(value::text)::uuid into v_primary_role_id from unnest(p_role_ids) value;
  v_user_id := public.create_internal_user(
    p_email, p_first_name, p_last_name, p_vinfast_id, p_phone_number,
    p_avatar_url, v_primary_role_id, p_area_id, p_managed_by_user_id,
    p_password_hash
  );
  perform public.replace_user_roles(v_user_id, p_role_ids, p_actor_id);
  return v_user_id;
end;
$$;

revoke all on function public.create_internal_user_with_roles(
  text, text, text, integer, text, text, uuid[], uuid, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.create_internal_user_with_roles(
  text, text, text, integer, text, text, uuid[], uuid, uuid, text, uuid
) to service_role;

-- Replace only the legacy authorization blocks in the latest installed
-- function definitions. Historical migrations remain immutable and all stock
-- and order statements in the bodies are preserved byte-for-byte.
do $$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.review_order(uuid,uuid,text,jsonb,text,text)'::regprocedure)
  into v_definition;
  v_updated := replace(v_definition, $old$
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
$old$, $new$
  if not public.has_permission(p_actor_id, 'supply.order.approve') then
    raise exception 'Actor does not have supply.order.approve';
  end if;
$new$);
  if v_updated = v_definition then raise exception 'review_order authorization block not found'; end if;
  execute v_updated;

  select pg_get_functiondef('public.issue_order(uuid,uuid,jsonb,uuid,uuid)'::regprocedure)
  into v_definition;
  v_updated := replace(v_definition, $old$
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
$old$, $new$
  if not public.has_permission(p_actor_id, 'supply.order.issue') then
    raise exception 'Actor does not have supply.order.issue';
  end if;
$new$);
  if v_updated = v_definition then raise exception 'issue_order authorization block not found'; end if;
  execute v_updated;

  select pg_get_functiondef('public.apply_stock_adjustment_v3(uuid,uuid,uuid,uuid,uuid,numeric,uuid,text,text,uuid)'::regprocedure)
  into v_definition;
  v_updated := replace(v_definition, $old$
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
$old$, $new$
  if not public.has_permission(p_created_by, 'supply.stock.adjust') then
    raise exception 'Actor does not have supply.stock.adjust';
  end if;
$new$);
  if v_updated = v_definition then raise exception 'apply_stock_adjustment_v3 authorization block not found'; end if;
  execute v_updated;
end;
$$;

-- Migration-time verification uses a PL/pgSQL exception subtransaction so
-- the synthetic custom operator is always rolled back and leaves no test data.
do $$
declare
  v_role_id uuid := gen_random_uuid();
  v_area_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_permission_id uuid;
  v_definition text;
begin
  insert into public.roles (id, code, name, description, is_system, is_active, is_deleted)
  values (v_role_id, 'CUSTOM_SUPPLY_OPERATOR_PHASE3_TEST', 'Custom Supply Operator test', 'Migration verification only', false, true, false);
  insert into public.areas (id, code, name, description, is_active, is_deleted)
  values (v_area_id, 'RBAC_PHASE3_TEST', 'RBAC Phase 3 test', 'Migration verification only', true, false);
  insert into public.users (
    id, vinfast_id, email, first_name, last_name, role_id, area_id,
    is_active, is_verified, is_deleted
  ) values (
    v_user_id, -2147483000, 'rbac-phase3-test@example.invalid', 'RBAC', 'Test',
    v_role_id, v_area_id, true, true, false
  );

  select id into v_permission_id from public.permissions where code = 'supply.order.issue';
  insert into public.role_permissions (role_id, permission_id, is_active, is_deleted)
  values (v_role_id, v_permission_id, true, false);
  if not public.has_permission(v_user_id, 'supply.order.issue') then
    raise exception 'Custom role permission resolution failed';
  end if;
  update public.role_permissions
  set is_active = false, is_deleted = true
  where role_id = v_role_id and permission_id = v_permission_id;
  if public.has_permission(v_user_id, 'supply.order.issue') then
    raise exception 'Removed custom role permission still resolved';
  end if;

  foreach v_definition in array array[
    pg_get_functiondef('public.review_order(uuid,uuid,text,jsonb,text,text)'::regprocedure),
    pg_get_functiondef('public.issue_order(uuid,uuid,jsonb,uuid,uuid)'::regprocedure),
    pg_get_functiondef('public.apply_stock_adjustment_v3(uuid,uuid,uuid,uuid,uuid,numeric,uuid,text,text,uuid)'::regprocedure)
  ] loop
    if position('public.has_permission' in v_definition) = 0 then
      raise exception 'RPC permission guard verification failed';
    end if;
  end loop;

  raise exception using message = '__RBAC_PHASE3_TEST_ROLLBACK__';
exception
  when raise_exception then
    if sqlerrm <> '__RBAC_PHASE3_TEST_ROLLBACK__' then
      raise;
    end if;
end;
$$;

commit;

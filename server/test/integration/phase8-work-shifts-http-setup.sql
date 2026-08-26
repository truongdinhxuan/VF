\set ON_ERROR_STOP on

insert into public.roles(code, name, description, is_system, is_active, is_deleted)
values
  ('PHASE8_HTTP_MANAGER', 'Phase 8 HTTP manager', 'LOCAL TEST ONLY', false, true, false),
  ('PHASE8_HTTP_READER', 'Phase 8 HTTP reader', 'LOCAL TEST ONLY', false, true, false)
on conflict (code) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.role_permissions(role_id, permission_id, is_active, is_deleted)
select role_record.id, permission_record.id, true, false
from public.roles role_record
join public.permissions permission_record on (
  (role_record.code = 'PHASE8_HTTP_MANAGER'
    and permission_record.code in ('admin.user.read', 'admin.user.update'))
  or (role_record.code = 'PHASE8_HTTP_READER'
    and permission_record.code = 'admin.user.read')
)
on conflict (role_id, permission_id) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.users(
  id, vinfast_id, email, role_id, area_id, is_active, is_verified,
  is_deleted, first_name, last_name
)
select fixture.id, fixture.vinfast_id, fixture.email, role_record.id, area.id,
  true, true, false, 'Phase8', fixture.last_name
from (
  values
    ('68000000-0000-4000-8000-000000000011'::uuid, 968000011, 'phase8-http-manager@local.test', 'PHASE8_HTTP_MANAGER', 'Manager'),
    ('68000000-0000-4000-8000-000000000012'::uuid, 968000012, 'phase8-http-reader@local.test', 'PHASE8_HTTP_READER', 'Reader'),
    ('68000000-0000-4000-8000-000000000013'::uuid, 968000013, 'phase8-http-target@local.test', 'DATA_PACKING', 'Target')
) fixture(id, vinfast_id, email, role_code, last_name)
join public.roles role_record on role_record.code = fixture.role_code
cross join public.areas area
where area.code = 'EDC_LOGISTICS'
on conflict (id) do update
set role_id = excluded.role_id,
    is_active = true,
    is_verified = true,
    is_deleted = false,
    updated_at = now();

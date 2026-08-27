\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

delete from public.notification_recipients
where notification_id in (
  select id from public.notifications
  where created_by::text like '69400000-0000-4000-8000-%'
);
delete from public.notifications
where created_by::text like '69400000-0000-4000-8000-%';
delete from public.order_revisions
where order_id in (
  select id from public.orders
  where requested_by = '69400000-0000-4000-8000-000000000001'::uuid
);
delete from public.order_items
where order_id in (
  select id from public.orders
  where requested_by = '69400000-0000-4000-8000-000000000001'::uuid
);
delete from public.orders
where requested_by = '69400000-0000-4000-8000-000000000001'::uuid;
delete from public.supply_shift_order_sheets sheet
where sheet.leader_id = '69400000-0000-4000-8000-000000000003'::uuid
  and not exists (
    select 1 from public.orders order_row
    where order_row.shift_order_sheet_id = sheet.id
  );
delete from public.user_work_shift_assignments
where user_id = '69400000-0000-4000-8000-000000000001'::uuid;
delete from public.user_roles where user_id::text like '69400000-0000-4000-8000-%';
delete from public.role_permissions
where role_id in (select id from public.roles where code like 'P11_%');

commit;

insert into public.areas(code, name, is_active, is_deleted)
values
  ('VTDG', 'Vật tư đóng gói', true, false),
  ('EDC_LOGISTICS', 'EDC Logistics', true, false)
on conflict (code) do update set is_active = true, is_deleted = false;

insert into public.roles(code, name, description, is_system, is_active, is_deleted)
values
  ('P11_CREATE', 'Phase 11 create', 'LOCAL TEST ONLY', false, true, false),
  ('P11_APPROVE', 'Phase 11 approve', 'LOCAL TEST ONLY', false, true, false),
  ('P11_NONE', 'Phase 11 no permission', 'LOCAL TEST ONLY', false, true, false)
on conflict (code) do update set is_active = true, is_deleted = false;

insert into public.role_permissions(role_id, permission_id, is_active, is_deleted)
select role_record.id, permission_record.id, true, false
from public.roles role_record
join public.permissions permission_record on (
  (role_record.code = 'P11_CREATE' and permission_record.code = 'supply.order.create')
  or (role_record.code = 'P11_APPROVE' and permission_record.code in (
    'supply.order.approve', 'supply.stock.adjust'
  ))
)
on conflict (role_id, permission_id) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.users(
  id, vinfast_id, email, role_id, area_id, managed_by_user_id, is_active, is_verified,
  is_deleted, first_name, last_name
)
select fixture.id, fixture.vinfast_id, fixture.email, role_record.id, area.id,
  fixture.managed_by_user_id,
  fixture.is_active, true, false, 'Phase11', fixture.last_name
from (
  values
    ('69400000-0000-4000-8000-000000000001'::uuid, 969400001, 'p11-actor@local.test', 'P11_CREATE', 'Actor', 'EDC_LOGISTICS', true, '69400000-0000-4000-8000-000000000003'::uuid),
    ('69400000-0000-4000-8000-000000000002'::uuid, 969400002, 'p11-peer@local.test', 'P11_CREATE', 'Peer', 'EDC_LOGISTICS', true, '69400000-0000-4000-8000-000000000003'::uuid),
    ('69400000-0000-4000-8000-000000000003'::uuid, 969400003, 'p11-manager@local.test', 'P11_APPROVE', 'Manager', 'EDC_LOGISTICS', true, null::uuid),
    ('69400000-0000-4000-8000-000000000004'::uuid, 969400004, 'p11-outsider@local.test', 'P11_CREATE', 'Outsider', 'VTDG', true, null::uuid),
    ('69400000-0000-4000-8000-000000000005'::uuid, 969400005, 'p11-none@local.test', 'P11_NONE', 'NoPermission', 'EDC_LOGISTICS', true, null::uuid),
    ('69400000-0000-4000-8000-000000000006'::uuid, 969400006, 'p11-inactive@local.test', 'P11_CREATE', 'Inactive', 'EDC_LOGISTICS', false, null::uuid)
) fixture(id, vinfast_id, email, role_code, last_name, area_code, is_active, managed_by_user_id)
join public.roles role_record on role_record.code = fixture.role_code
join public.areas area on area.code = fixture.area_code
on conflict (id) do update
set role_id = excluded.role_id, area_id = excluded.area_id,
    managed_by_user_id = excluded.managed_by_user_id,
    is_active = excluded.is_active, is_verified = true, is_deleted = false,
    updated_at = now();

insert into public.user_roles(user_id, role_id, is_active, is_deleted)
select user_record.id, user_record.role_id, true, false
from public.users user_record
where user_record.id::text like '69400000-0000-4000-8000-%'
on conflict (user_id, role_id) do update set is_active = true, is_deleted = false;

insert into public.user_work_shift_assignments(
  user_id, work_shift_id, effective_from, assigned_by, is_active, is_deleted
)
select '69400000-0000-4000-8000-000000000001'::uuid,
  shift.id, now() - interval '90 days',
  '69400000-0000-4000-8000-000000000003'::uuid, true, false
from public.work_shifts shift
where shift.code = 'S1';

insert into public.supply_categories(code, name, description, is_active, is_deleted)
values ('P11_NORMAL', 'Phase 11 normal', 'LOCAL TEST ONLY', true, false)
on conflict (code) do update set is_active = true, is_deleted = false;

insert into public.providers(code, name, description, is_active, is_deleted)
values ('P11_PROVIDER', 'Phase 11 Provider', 'LOCAL TEST ONLY', true, false)
on conflict (code) do update set is_active = true, is_deleted = false;

insert into public.supplies(
  id, code, short_text, description, category_id, unit_id, is_active, is_deleted
)
select '69400000-0000-4000-8000-000000000020'::uuid,
  'P11_SUPPLY', 'Phase 11 Supply', 'LOCAL TEST ONLY', category.id, unit_record.id,
  true, false
from public.supply_categories category
join public.units unit_record on unit_record.code = 'SET'
where category.code = 'P11_NORMAL'
on conflict (id) do update
set category_id = excluded.category_id, unit_id = excluded.unit_id,
    is_active = true, is_deleted = false, updated_at = now();

insert into public.supply_providers(supply_id, provider_id, is_active, is_deleted)
select supply.id, provider.id, true, false
from public.supplies supply
join public.providers provider on provider.code = 'P11_PROVIDER'
where supply.id = '69400000-0000-4000-8000-000000000020'::uuid
on conflict (supply_id, provider_id) do update set is_active = true, is_deleted = false;

insert into public.storage_locations(
  id, code, area_id, name, description, is_active, is_deleted
)
select '69400000-0000-4000-8000-000000000021'::uuid,
  'P11_LOCATION', area.id, 'Phase 11 Location', 'LOCAL TEST ONLY', true, false
from public.areas area where area.code = 'VTDG'
on conflict (id) do update
set area_id = excluded.area_id, is_active = true, is_deleted = false, updated_at = now();

insert into public.stock_balances(
  id, supply_id, provider_id, area_id, storage_location_id,
  quantity, is_active, is_deleted
)
select '69400000-0000-4000-8000-000000000022'::uuid,
  supply.id, provider.id, area.id, location.id, 10, true, false
from public.supplies supply
join public.providers provider on provider.code = 'P11_PROVIDER'
join public.areas area on area.code = 'VTDG'
join public.storage_locations location
  on location.id = '69400000-0000-4000-8000-000000000021'::uuid
where supply.id = '69400000-0000-4000-8000-000000000020'::uuid
on conflict (id) do update
set quantity = 10, is_active = true, is_deleted = false, updated_at = now();

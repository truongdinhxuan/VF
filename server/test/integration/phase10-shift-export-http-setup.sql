\set ON_ERROR_STOP on

delete from public.order_items
where order_id in (
  select id from public.orders where code like 'P10-EXPORT-%'
);
delete from public.stock_balances
where supply_id in (select id from public.supplies where code like 'P10_EXPORT_%');
delete from public.storage_locations where code = 'P10_EXPORT_LOCATION';
delete from public.supply_providers
where supply_id in (select id from public.supplies where code like 'P10_EXPORT_%');
delete from public.supplies where code like 'P10_EXPORT_%';
delete from public.providers where code in ('P10_PROVIDER_A', 'P10_PROVIDER_B');
delete from public.units where code = 'P10_UNIT';
delete from public.supply_categories where code = 'P10_NORMAL';

insert into public.supply_categories(code, name, description, is_active, is_deleted)
values
  ('P10_NORMAL', 'Phase 10 normal', 'LOCAL TEST ONLY', true, false),
  ('KIEN_SAT_TC', 'Kiện sắt tiêu chuẩn', 'Stack category', true, false),
  ('KIEN_SAT_SPECIAL', 'Kiện sắt special', 'Normal category', true, false)
on conflict (code) do update set is_active = true, is_deleted = false;

insert into public.units(code, name, symbol, is_active, is_deleted)
values ('P10_UNIT', 'Đơn vị Phase 10', 'SET', true, false)
on conflict (code) do update
set name = excluded.name,
    symbol = excluded.symbol,
    is_active = true,
    is_deleted = false;

insert into public.providers(code, name, description, is_active, is_deleted)
values
  ('P10_PROVIDER_A', 'Nhà cung cấp A', 'LOCAL TEST ONLY', true, false),
  ('P10_PROVIDER_B', 'Nhà cung cấp B', 'LOCAL TEST ONLY', true, false)
on conflict (code) do update set name = excluded.name, is_active = true, is_deleted = false;

insert into public.supply_shift_order_sheets(
  id, area_id, work_shift_id, work_date, leader_id, is_active, is_deleted
)
select fixture.id, area.id, shift.id, date '2026-08-26',
  '69200000-0000-4000-8000-000000000001'::uuid, true, false
from (
  values
    ('69320000-0000-4000-8000-000000000001'::uuid, 'S3'),
    ('69320000-0000-4000-8000-000000000002'::uuid, 'S1')
) fixture(id, shift_code)
join public.areas area on area.code = 'EDC_LOGISTICS'
join public.work_shifts shift on shift.code = fixture.shift_code
on conflict (id) do update
set area_id = excluded.area_id,
    work_shift_id = excluded.work_shift_id,
    work_date = excluded.work_date,
    leader_id = excluded.leader_id,
    is_active = true,
    is_deleted = false;

insert into public.supplies(
  code, short_text, description, category_id, unit_id, is_active, is_deleted
)
select fixture.code, fixture.short_text, fixture.description,
  category.id, unit_record.id, true, false
from (
  values
    ('P10_EXPORT_NORMAL', 'Normal', 'Mã thường Phase 10', 'P10_NORMAL'),
    ('P10_EXPORT_STACK', 'Stack', 'Kiện sắt tiêu chuẩn Phase 10', 'KIEN_SAT_TC'),
    ('P10_EXPORT_SPECIAL', 'Special', 'Kiện sắt special Phase 10', 'KIEN_SAT_SPECIAL')
) fixture(code, short_text, description, category_code)
join public.supply_categories category on category.code = fixture.category_code
join public.units unit_record on unit_record.code = 'P10_UNIT';

insert into public.supply_providers(supply_id, provider_id, is_active, is_deleted)
select supply.id, provider.id, true, false
from public.supplies supply
cross join public.providers provider
where supply.code like 'P10_EXPORT_%'
  and provider.code in ('P10_PROVIDER_A', 'P10_PROVIDER_B');

insert into public.orders(
  id, code, from_area_id, to_area_id, requested_by, status_id,
  shift_order_sheet_id, note, submitted_at, issued_at,
  is_active, is_deleted
)
select fixture.id, fixture.code, source_area.id, target_area.id,
  '69200000-0000-4000-8000-000000000002'::uuid,
  status.id, fixture.sheet_id, fixture.note,
  fixture.submitted_at, fixture.issued_at, true, false
from (
  values
    ('69300000-0000-4000-8000-000000000001'::uuid, 'P10-EXPORT-NORMAL', 'PENDING',
      '69320000-0000-4000-8000-000000000001'::uuid, 'Ghi chú Order thường',
      '2026-08-26T23:00:00Z'::timestamptz, null::timestamptz),
    ('69300000-0000-4000-8000-000000000002'::uuid, 'P10-EXPORT-SPECIAL', 'REJECTED',
      '69320000-0000-4000-8000-000000000001'::uuid, null,
      '2026-08-26T19:15:00Z'::timestamptz, null::timestamptz),
    ('69300000-0000-4000-8000-000000000003'::uuid, 'P10-EXPORT-STACK', 'ISSUED',
      '69320000-0000-4000-8000-000000000001'::uuid, null,
      '2026-08-27T00:30:00Z'::timestamptz, '2026-08-27T01:30:00Z'::timestamptz),
    ('69300000-0000-4000-8000-000000000004'::uuid, 'P10-EXPORT-PARTIAL', 'ISSUED',
      '69320000-0000-4000-8000-000000000001'::uuid, null,
      '2026-08-27T01:00:00Z'::timestamptz, '2026-08-27T01:15:00Z'::timestamptz),
    ('69300000-0000-4000-8000-000000000005'::uuid, 'P10-EXPORT-OTHER-SHEET', 'PENDING',
      '69320000-0000-4000-8000-000000000002'::uuid, null,
      '2026-08-27T02:00:00Z'::timestamptz, null::timestamptz)
) fixture(id, code, status_code, sheet_id, note, submitted_at, issued_at)
join public.areas source_area on source_area.code = 'VTDG'
join public.areas target_area on target_area.code = 'EDC_LOGISTICS'
join public.order_statuses status on status.code = fixture.status_code
on conflict (id) do update
set code = excluded.code,
    from_area_id = excluded.from_area_id,
    to_area_id = excluded.to_area_id,
    requested_by = excluded.requested_by,
    status_id = excluded.status_id,
    shift_order_sheet_id = excluded.shift_order_sheet_id,
    note = excluded.note,
    submitted_at = excluded.submitted_at,
    issued_at = excluded.issued_at,
    is_active = true,
    is_deleted = false;

insert into public.order_items(
  id, order_id, supply_id, provider_id, unit_id,
  quantity_requested, quantity_approved, quantity_issued,
  set_per_qty, requested_stack_quantity, requested_total_set_quantity,
  note, is_active, is_deleted, created_at
)
select fixture.id, order_record.id, supply.id, provider.id, unit_record.id,
  fixture.quantity_requested, fixture.quantity_approved, fixture.quantity_issued,
  fixture.set_per_qty, fixture.requested_stack_quantity,
  case when fixture.set_per_qty is null then null
    else fixture.set_per_qty * fixture.requested_stack_quantity end,
  fixture.note, true, false, fixture.created_at
from (
  values
    ('69310000-0000-4000-8000-000000000001'::uuid, 'P10-EXPORT-NORMAL', 'P10_EXPORT_NORMAL', 'P10_PROVIDER_A',
      50::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::text, '2026-08-26T23:00:01Z'::timestamptz),
    ('69310000-0000-4000-8000-000000000002'::uuid, 'P10-EXPORT-SPECIAL', 'P10_EXPORT_SPECIAL', 'P10_PROVIDER_A',
      12::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 'Ghi chú item special', '2026-08-27T00:00:01Z'::timestamptz),
    ('69310000-0000-4000-8000-000000000003'::uuid, 'P10-EXPORT-STACK', 'P10_EXPORT_STACK', 'P10_PROVIDER_A',
      33::numeric, 33::numeric, 33::numeric, 11::numeric, 3::numeric, 'Ba chồng 11', '2026-08-27T00:30:01Z'::timestamptz),
    ('69310000-0000-4000-8000-000000000004'::uuid, 'P10-EXPORT-STACK', 'P10_EXPORT_STACK', 'P10_PROVIDER_B',
      16::numeric, 0::numeric, 0::numeric, 8::numeric, 2::numeric, null::text, '2026-08-27T00:30:02Z'::timestamptz),
    ('69310000-0000-4000-8000-000000000005'::uuid, 'P10-EXPORT-PARTIAL', 'P10_EXPORT_NORMAL', 'P10_PROVIDER_A',
      50::numeric, 20::numeric, 20::numeric, null::numeric, null::numeric, null::text, '2026-08-27T01:00:01Z'::timestamptz),
    ('69310000-0000-4000-8000-000000000006'::uuid, 'P10-EXPORT-OTHER-SHEET', 'P10_EXPORT_NORMAL', 'P10_PROVIDER_A',
      99::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::text, '2026-08-27T02:00:01Z'::timestamptz)
) fixture(id, order_code, supply_code, provider_code, quantity_requested,
  quantity_approved, quantity_issued, set_per_qty, requested_stack_quantity,
  note, created_at)
join public.orders order_record on order_record.code = fixture.order_code
join public.supplies supply on supply.code = fixture.supply_code
join public.providers provider on provider.code = fixture.provider_code
join public.units unit_record on unit_record.code = 'P10_UNIT';

insert into public.storage_locations(code, area_id, name, description, is_active, is_deleted)
select 'P10_EXPORT_LOCATION', area.id, 'Kho Phase 10', 'LOCAL TEST ONLY', true, false
from public.areas area
where area.code = 'EDC_LOGISTICS'
on conflict (area_id, code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    is_deleted = false;

insert into public.stock_balances(
  id, supply_id, provider_id, area_id, storage_location_id,
  quantity, set_per_qty, stack_quantity, total_set_quantity,
  is_active, is_deleted
)
select '69330000-0000-4000-8000-000000000001'::uuid,
  supply.id, provider.id, area.id, location.id,
  123::numeric, null::numeric, null::numeric, null::numeric,
  true, false
from public.supplies supply
join public.providers provider on provider.code = 'P10_PROVIDER_A'
join public.areas area on area.code = 'EDC_LOGISTICS'
join public.storage_locations location
  on location.area_id = area.id and location.code = 'P10_EXPORT_LOCATION'
where supply.code = 'P10_EXPORT_NORMAL'
on conflict (id) do update
set supply_id = excluded.supply_id,
    provider_id = excluded.provider_id,
    area_id = excluded.area_id,
    storage_location_id = excluded.storage_location_id,
    quantity = excluded.quantity,
    set_per_qty = null,
    stack_quantity = null,
    total_set_quantity = null,
    is_active = true,
    is_deleted = false;

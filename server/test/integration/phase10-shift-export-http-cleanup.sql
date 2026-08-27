\set ON_ERROR_STOP on

delete from public.order_items
where order_id in (
  select id from public.orders where code like 'P10-EXPORT-%'
);
update public.orders
set is_active = false,
    is_deleted = true,
    updated_at = now()
where code like 'P10-EXPORT-%';
update public.supply_shift_order_sheets
set is_active = false,
    is_deleted = true,
    updated_at = now()
where id in (
  '69320000-0000-4000-8000-000000000001',
  '69320000-0000-4000-8000-000000000002'
);
delete from public.stock_balances
where supply_id in (select id from public.supplies where code like 'P10_EXPORT_%');
delete from public.supply_providers
where supply_id in (select id from public.supplies where code like 'P10_EXPORT_%');
delete from public.supplies where code like 'P10_EXPORT_%';
delete from public.providers where code in ('P10_PROVIDER_A', 'P10_PROVIDER_B');
delete from public.units where code = 'P10_UNIT';
delete from public.supply_categories where code = 'P10_NORMAL';
delete from public.storage_locations where code = 'P10_EXPORT_LOCATION';

-- Phase 1 backend foundation.
-- Keep the deployed schema intact while enforcing the selected five-role
-- configuration and the workbook's unique/relationship contracts.

begin;

insert into public.roles (role_name)
values
  ('data Đóng gói'),
  ('data Vật tư'),
  ('Tổ trưởng vật tư'),
  ('Material Control'),
  ('Admin')
on conflict (role_name) do nothing;

do $$
declare
  actual_values text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
    into actual_values
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'role_name';

  if actual_values <> array[
    'data Đóng gói',
    'data Vật tư',
    'Tổ trưởng vật tư',
    'Material Control',
    'Admin'
  ]::text[] then
    raise exception 'public.role_name does not match the configured five roles';
  end if;
end
$$;

create unique index if not exists roles_role_name_key
  on public.roles(role_name);
create unique index if not exists positions_position_name_key
  on public.positions(position_name);
create unique index if not exists areas_code_key
  on public.areas(code);
create unique index if not exists supply_categories_code_key
  on public.supply_categories(code);
create unique index if not exists units_code_key
  on public.units(code);
create unique index if not exists supplies_code_key
  on public.supplies(code);
create unique index if not exists storage_locations_area_code_key
  on public.storage_locations(area_id, code);
create unique index if not exists stock_balances_supply_area_location_key
  on public.stock_balances(supply_id, area_id, storage_location_id);

create index if not exists stock_balances_supply_id_idx
  on public.stock_balances(supply_id);
create index if not exists stock_balances_area_id_idx
  on public.stock_balances(area_id);
create index if not exists stock_balances_storage_location_id_idx
  on public.stock_balances(storage_location_id);

-- The composite foreign keys enforce Business Rule R-017 for all future
-- balance and transaction writes. Validation intentionally fails without
-- deleting data if a pre-existing location/area mismatch is present.
create unique index if not exists storage_locations_id_area_id_key
  on public.storage_locations(id, area_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_balances'::regclass
      and conname = 'stock_balances_location_area_fkey'
  ) then
    alter table public.stock_balances
      add constraint stock_balances_location_area_fkey
      foreign key (storage_location_id, area_id)
      references public.storage_locations(id, area_id)
      on delete restrict on update restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_transactions'::regclass
      and conname = 'stock_transactions_location_area_fkey'
  ) then
    alter table public.stock_transactions
      add constraint stock_transactions_location_area_fkey
      foreign key (storage_location_id, area_id)
      references public.storage_locations(id, area_id)
      on delete restrict on update restrict
      not valid;
  end if;
end
$$;

alter table public.stock_balances
  validate constraint stock_balances_location_area_fkey;
alter table public.stock_transactions
  validate constraint stock_transactions_location_area_fkey;

commit;

-- LOCAL TEST ONLY.
-- This fixture supplies the legacy business rows required by the Phase 1
-- cut-over migration. It is intentionally not referenced by supabase/seed.sql.

do $phase4_bootstrap$
begin

insert into public.supply_categories (
  code,
  name,
  description,
  is_active,
  is_deleted
)
values
  ('KIEN_SAT', 'Kiện sắt legacy', 'Local migration fixture', true, false),
  ('KIEN_SAT_TC', 'Kiện sắt tiêu chuẩn', 'Local migration fixture', true, false),
  ('KIEN_SAT_SPECIAL', 'Kiện sắt đặc biệt', 'Local migration fixture', true, false)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    is_deleted = false;

insert into public.units (
  code,
  symbol,
  name,
  is_active,
  is_deleted
)
values ('SET', 'SET', 'Bộ', true, false)
on conflict (code) do update
set symbol = excluded.symbol,
    name = excluded.name,
    is_active = true,
    is_deleted = false;

insert into public.supplies (
  code,
  short_text,
  description,
  category_id,
  unit_id,
  is_active,
  is_deleted
)
select
  fixture.code,
  fixture.code || ' local fixture',
  'Local migration fixture',
  category.id,
  unit_record.id,
  true,
  false
from (
  values ('71000860'), ('71000861'), ('71000862'), ('71000863')
) as fixture(code)
cross join lateral (
  select id
  from public.supply_categories
  where code = 'KIEN_SAT'
) category
cross join lateral (
  select id
  from public.units
  where code = 'SET'
) unit_record
on conflict (code) do update
set short_text = excluded.short_text,
    description = excluded.description,
    category_id = excluded.category_id,
    unit_id = excluded.unit_id,
    is_active = true,
    is_deleted = false;

end
$phase4_bootstrap$;

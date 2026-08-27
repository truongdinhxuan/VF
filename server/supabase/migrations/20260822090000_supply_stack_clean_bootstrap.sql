-- Phase 12 clean-chain repair.
--
-- The already-applied 20260822131844 migration validates and migrates four
-- workbook-approved Supply codes, but it previously assumed their legacy
-- master data existed outside migration history. Seed only that declared
-- prerequisite here so a blank local database can replay the full chain.
-- Existing installations are left unchanged.

begin;

insert into public.supply_categories (
  code,
  name,
  description,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
values (
  'KIEN_SAT',
  'Kiện sắt legacy',
  'Danh mục nguồn dùng để migrate an toàn sang KIEN_SAT_TC/KIEN_SAT_SPECIAL.',
  true,
  false,
  now(),
  now()
)
on conflict (code) do nothing;

insert into public.units (
  code,
  symbol,
  name,
  description,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
values (
  'SET',
  'SET',
  'SET',
  'Đơn vị SET dùng bởi bốn mã Supply KIEN_SAT_TC đã được workbook chốt.',
  true,
  false,
  now(),
  now()
)
on conflict (code) do nothing;

with prerequisite as (
  select
    (select id from public.supply_categories where code = 'KIEN_SAT') as category_id,
    (select id from public.units where code = 'SET') as unit_id
)
insert into public.supplies (
  code,
  short_text,
  description,
  category_id,
  unit_id,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
select
  required.code,
  required.code,
  null,
  prerequisite.category_id,
  prerequisite.unit_id,
  true,
  false,
  now(),
  now()
from prerequisite
cross join (
  values ('71000860'), ('71000861'), ('71000862'), ('71000863')
) as required(code)
on conflict (code) do nothing;

commit;

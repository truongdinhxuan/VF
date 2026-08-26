begin;

-- Supply Stack-Based Inventory, Phase 1 only.
-- The runtime Supply domain remains in public. No stack workflow is implemented here.

do $$
begin
  if to_regclass('public.supplies') is null
    or to_regclass('public.supply_categories') is null
    or to_regclass('public.stock_balances') is null
    or to_regclass('public.order_items') is null
    or to_regclass('public.orders') is null
    or to_regclass('public.users') is null
  then
    raise exception 'Supply stack prerequisites are missing';
  end if;
end
$$;

-- Keep codes as master data, not database enum values.
insert into public.supply_categories (
  code,
  name,
  description,
  is_active,
  is_deleted,
  created_at,
  updated_at
)
values
  (
    'KIEN_SAT_TC',
    'Kiện sắt tiêu chuẩn',
    'Kiện sắt tiêu chuẩn quản lý tồn theo số chồng và số SET trên chồng.',
    true,
    false,
    now(),
    now()
  ),
  (
    'KIEN_SAT_SPECIAL',
    'Kiện sắt đặc biệt',
    'Kiện sắt đặc biệt tiếp tục sử dụng quantity flow thông thường.',
    true,
    false,
    now(),
    now()
  )
on conflict (code) do update
set name = excluded.name,
    is_active = true,
    is_deleted = false,
    updated_at = now();

do $$
declare
  v_legacy_category_id uuid;
  v_standard_category_id uuid;
  v_special_category_id uuid;
  v_missing_codes text;
  v_wrong_source_codes text;
  v_unexpected_standard_codes text;
begin
  select id into v_legacy_category_id
  from public.supply_categories
  where code = 'KIEN_SAT';

  select id into v_standard_category_id
  from public.supply_categories
  where code = 'KIEN_SAT_TC';

  select id into v_special_category_id
  from public.supply_categories
  where code = 'KIEN_SAT_SPECIAL';

  if v_legacy_category_id is null
    or v_standard_category_id is null
    or v_special_category_id is null
  then
    raise exception 'Required KIEN_SAT category records are missing';
  end if;

  select string_agg(required.code, ', ' order by required.code)
  into v_missing_codes
  from (
    values ('71000860'), ('71000861'), ('71000862'), ('71000863')
  ) as required(code)
  left join public.supplies s on s.code = required.code
  where s.id is null;

  if v_missing_codes is not null then
    raise exception 'Required KIEN_SAT_TC Supply codes are missing: %', v_missing_codes;
  end if;

  -- Guard against silently overriding a business reassignment made before this migration.
  select string_agg(s.code, ', ' order by s.code)
  into v_wrong_source_codes
  from public.supplies s
  where s.code in ('71000860', '71000861', '71000862', '71000863')
    and s.category_id not in (v_legacy_category_id, v_standard_category_id);

  if v_wrong_source_codes is not null then
    raise exception 'Target Supply codes are no longer KIEN_SAT: %', v_wrong_source_codes;
  end if;

  update public.supplies
  set category_id = v_standard_category_id
  where code in ('71000860', '71000861', '71000862', '71000863')
    and category_id = v_legacy_category_id;

  update public.supplies
  set category_id = v_special_category_id
  where category_id = v_legacy_category_id;

  select string_agg(s.code, ', ' order by s.code)
  into v_unexpected_standard_codes
  from public.supplies s
  where s.category_id = v_standard_category_id
    and s.code not in ('71000860', '71000861', '71000862', '71000863');

  if v_unexpected_standard_codes is not null then
    raise exception 'Unexpected Supply codes mapped to KIEN_SAT_TC: %', v_unexpected_standard_codes;
  end if;

  if (
    select count(*)
    from public.supplies
    where category_id = v_standard_category_id
      and code in ('71000860', '71000861', '71000862', '71000863')
  ) <> 4 then
    raise exception 'KIEN_SAT_TC must contain exactly the four approved Supply codes';
  end if;
end
$$;

alter table public.stock_balances
  add column set_per_qty numeric,
  add column stack_quantity numeric,
  add column total_set_quantity numeric;

alter table public.stock_balances
  add constraint stock_balances_stack_fields_consistent check (
    (
      set_per_qty is null
      and stack_quantity is null
      and total_set_quantity is null
    )
    or
    (
      set_per_qty is not null
      and stack_quantity is not null
      and total_set_quantity is not null
      and set_per_qty > 0
      and stack_quantity >= 0
      and total_set_quantity >= 0
      and total_set_quantity = stack_quantity * set_per_qty
      and quantity = total_set_quantity
    )
  );

alter table public.stock_balances
  drop constraint if exists stock_balances_supply_provider_area_location_key;

drop index if exists public.stock_balances_supply_provider_area_location_key;

create unique index stock_balances_normal_identity_key
  on public.stock_balances (
    supply_id,
    provider_id,
    area_id,
    storage_location_id
  )
  where set_per_qty is null and is_deleted = false;

create unique index stock_balances_stack_identity_key
  on public.stock_balances (
    supply_id,
    provider_id,
    area_id,
    storage_location_id,
    set_per_qty
  )
  where set_per_qty is not null and is_deleted = false;

create index stock_balances_stack_lookup_idx
  on public.stock_balances (
    supply_id,
    provider_id,
    area_id,
    set_per_qty,
    stack_quantity desc
  )
  where set_per_qty is not null and is_deleted = false;

-- Preserve the existing normal-stock adjustment flow after replacing its unique
-- constraint with a partial unique index. This is a mechanical dependency patch:
-- the function still adjusts only the normal (set_per_qty IS NULL) balance.
do $$
declare
  v_signature regprocedure :=
    'public.apply_stock_adjustment_v3(uuid,uuid,uuid,uuid,uuid,numeric,uuid,text,text,uuid)'::regprocedure;
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef(v_signature) into v_definition;

  v_updated := replace(
    v_definition,
    E'on conflict (supply_id, provider_id, area_id, storage_location_id)\n    do update set is_active = true, is_deleted = false;',
    E'on conflict (supply_id, provider_id, area_id, storage_location_id)\n    where set_per_qty is null and is_deleted = false\n    do update set is_active = true, is_deleted = false;'
  );

  v_updated := replace(
    v_updated,
    E'    and storage_location_id = p_storage_location_id\n    and is_deleted = false\n  for update;',
    E'    and storage_location_id = p_storage_location_id\n    and set_per_qty is null\n    and is_deleted = false\n  for update;'
  );

  if v_updated = v_definition then
    raise exception 'apply_stock_adjustment_v3 compatibility patch did not match its current definition';
  end if;

  if position(
    E'on conflict (supply_id, provider_id, area_id, storage_location_id)\n    where set_per_qty is null and is_deleted = false'
    in v_updated
  ) = 0 or position(E'    and set_per_qty is null\n    and is_deleted = false\n  for update;' in v_updated) = 0 then
    raise exception 'apply_stock_adjustment_v3 compatibility patch is incomplete';
  end if;

  execute v_updated;
end
$$;

alter table public.order_items
  add column set_per_qty numeric,
  add column requested_stack_quantity numeric,
  add column requested_total_set_quantity numeric;

alter table public.order_items
  add constraint order_items_stack_request_consistent check (
    (
      set_per_qty is null
      and requested_stack_quantity is null
      and requested_total_set_quantity is null
    )
    or
    (
      set_per_qty is not null
      and requested_stack_quantity is not null
      and requested_total_set_quantity is not null
      and set_per_qty > 0
      and requested_stack_quantity > 0
      and requested_total_set_quantity >= 0
      and requested_total_set_quantity = requested_stack_quantity * set_per_qty
      and quantity_requested = requested_total_set_quantity
    )
  );

create table public.order_item_allocations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null,
  stock_balance_id uuid not null,
  expected_stack_quantity numeric not null,
  actual_stack_quantity numeric,
  status text,
  discrepancy_reason text,
  allocated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_item_allocations_order_item_fkey
    foreign key (order_item_id) references public.order_items(id)
    on delete restrict on update cascade,
  constraint order_item_allocations_stock_balance_fkey
    foreign key (stock_balance_id) references public.stock_balances(id)
    on delete restrict on update cascade,
  constraint order_item_allocations_expected_positive
    check (expected_stack_quantity > 0),
  constraint order_item_allocations_actual_nonnegative
    check (actual_stack_quantity is null or actual_stack_quantity >= 0)
);

create index order_item_allocations_order_item_id_idx
  on public.order_item_allocations(order_item_id);
create index order_item_allocations_stock_balance_id_idx
  on public.order_item_allocations(stock_balance_id);

create table public.inventory_discrepancies (
  id uuid primary key default gen_random_uuid(),
  stock_balance_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  allocation_id uuid not null,
  expected_stack_quantity numeric not null,
  actual_stack_quantity numeric not null,
  difference_stack_quantity numeric not null,
  reason text,
  status text not null default 'OPEN',
  reported_by uuid not null,
  reported_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_discrepancies_stock_balance_fkey
    foreign key (stock_balance_id) references public.stock_balances(id)
    on delete restrict on update cascade,
  constraint inventory_discrepancies_order_fkey
    foreign key (order_id) references public.orders(id)
    on delete restrict on update cascade,
  constraint inventory_discrepancies_order_item_fkey
    foreign key (order_item_id) references public.order_items(id)
    on delete restrict on update cascade,
  constraint inventory_discrepancies_allocation_fkey
    foreign key (allocation_id) references public.order_item_allocations(id)
    on delete restrict on update cascade,
  constraint inventory_discrepancies_reported_by_fkey
    foreign key (reported_by) references public.users(id)
    on delete restrict on update cascade,
  constraint inventory_discrepancies_resolved_by_fkey
    foreign key (resolved_by) references public.users(id)
    on delete restrict on update cascade,
  constraint inventory_discrepancies_expected_nonnegative
    check (expected_stack_quantity >= 0),
  constraint inventory_discrepancies_actual_nonnegative
    check (actual_stack_quantity >= 0),
  constraint inventory_discrepancies_status_valid
    check (status in ('OPEN', 'RESOLVED')),
  constraint inventory_discrepancies_resolution_valid check (
    status <> 'RESOLVED'
    or (
      resolved_by is not null
      and resolved_at is not null
      and nullif(btrim(resolution_note), '') is not null
    )
  )
);

create index inventory_discrepancies_stock_balance_id_idx
  on public.inventory_discrepancies(stock_balance_id);
create index inventory_discrepancies_order_id_idx
  on public.inventory_discrepancies(order_id);
create index inventory_discrepancies_order_item_id_idx
  on public.inventory_discrepancies(order_item_id);
create index inventory_discrepancies_allocation_id_idx
  on public.inventory_discrepancies(allocation_id);
create index inventory_discrepancies_open_stock_balance_idx
  on public.inventory_discrepancies(stock_balance_id)
  where status = 'OPEN' and is_deleted = false;

create trigger order_item_allocations_set_updated_at
before update on public.order_item_allocations
for each row execute function public.set_updated_at();

create trigger inventory_discrepancies_set_updated_at
before update on public.inventory_discrepancies
for each row execute function public.set_updated_at();

alter table public.order_item_allocations enable row level security;
alter table public.inventory_discrepancies enable row level security;

revoke all on table public.order_item_allocations
from public, anon, authenticated;
revoke all on table public.inventory_discrepancies
from public, anon, authenticated;

grant select, insert, update, delete on table public.order_item_allocations
to service_role;
grant select, insert, update, delete on table public.inventory_discrepancies
to service_role;

comment on column public.stock_balances.quantity is
  'Normal quantity, or the mirrored total SET quantity for stack-mode balances.';
comment on column public.stock_balances.set_per_qty is
  'Dynamic number of SET per stack. NULL for normal and legacy balances.';
comment on column public.stock_balances.stack_quantity is
  'Aggregate stack count. NULL for normal and legacy balances.';
comment on column public.stock_balances.total_set_quantity is
  'stack_quantity * set_per_qty and mirrored by quantity for stack-mode balances.';
comment on column public.order_item_allocations.status is
  'Intentionally nullable in Phase 1; allocation lifecycle codes require business approval.';
comment on table public.inventory_discrepancies is
  'Relational stack inventory discrepancy records. Warning state is derived from OPEN rows.';

commit;

-- Phase 9: Supply zero-stock submit guard and shift-order-sheet grouping.
-- Business timestamps are stored as timestamptz and resolved in
-- Asia/Ho_Chi_Minh. Historical orders remain ungrouped.

create table public.supply_shift_order_sheets (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null,
  work_shift_id uuid not null,
  work_date date not null,
  leader_id uuid not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_shift_order_sheets_area_id_fkey
    foreign key (area_id) references public.areas(id)
    on update cascade on delete restrict,
  constraint supply_shift_order_sheets_work_shift_id_fkey
    foreign key (work_shift_id) references public.work_shifts(id)
    on update cascade on delete restrict,
  constraint supply_shift_order_sheets_leader_id_fkey
    foreign key (leader_id) references public.users(id)
    on update cascade on delete restrict,
  constraint supply_shift_order_sheets_active_not_deleted check (
    not (is_active and is_deleted)
  )
);

create unique index supply_shift_order_sheets_business_key
  on public.supply_shift_order_sheets(area_id, work_shift_id, work_date)
  where is_deleted = false;

create index supply_shift_order_sheets_work_date_shift_idx
  on public.supply_shift_order_sheets(work_date desc, work_shift_id)
  where is_deleted = false;

create index supply_shift_order_sheets_leader_work_date_idx
  on public.supply_shift_order_sheets(leader_id, work_date desc)
  where is_deleted = false;

drop trigger if exists supply_shift_order_sheets_set_updated_at
  on public.supply_shift_order_sheets;
create trigger supply_shift_order_sheets_set_updated_at
before update on public.supply_shift_order_sheets
for each row execute function public.set_updated_at();

alter table public.orders
  add column if not exists shift_order_sheet_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_shift_order_sheet_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_shift_order_sheet_id_fkey
      foreign key (shift_order_sheet_id)
      references public.supply_shift_order_sheets(id)
      on update cascade on delete restrict;
  end if;
end;
$$;

create index if not exists orders_shift_order_sheet_id_idx
  on public.orders(shift_order_sheet_id)
  where shift_order_sheet_id is not null;

create or replace function public.resolve_user_work_shift_instance(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns table (
  assignment_id uuid,
  work_shift_id uuid,
  work_shift_code text,
  work_shift_name text,
  work_date date,
  shift_start_at timestamptz,
  shift_end_at timestamptz,
  is_overtime boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assignment public.user_work_shift_assignments%rowtype;
  v_shift public.work_shifts%rowtype;
  v_local_at timestamp without time zone;
  v_work_date date;
  v_start_local timestamp without time zone;
  v_end_local timestamp without time zone;
begin
  if p_at is null then
    raise exception using message = 'WORK_SHIFT_TIMESTAMP_INVALID';
  end if;

  select assignment.*
  into v_assignment
  from public.user_work_shift_assignments assignment
  where assignment.user_id = p_user_id
    and assignment.is_deleted = false
    and assignment.effective_from <= p_at
    and (
      assignment.effective_to is null
      or assignment.effective_to > p_at
    )
  order by assignment.effective_from desc, assignment.id
  limit 1;

  if not found then
    raise exception using message = 'WORK_SHIFT_ASSIGNMENT_NOT_FOUND';
  end if;

  select shift.*
  into v_shift
  from public.work_shifts shift
  where shift.id = v_assignment.work_shift_id
    and shift.is_active = true
    and shift.is_deleted = false;

  if not found then
    raise exception using message = 'WORK_SHIFT_NOT_AVAILABLE';
  end if;

  v_local_at := p_at at time zone 'Asia/Ho_Chi_Minh';
  v_work_date := v_local_at::date;

  -- The authoritative instance is the most recent start of the assigned shift.
  -- This also keeps overtime after nominal end on the same shift instance.
  if v_local_at::time < v_shift.start_time then
    v_work_date := v_work_date - 1;
  end if;

  v_start_local := v_work_date + v_shift.start_time;
  v_end_local := (
    v_work_date
    + case when v_shift.crosses_midnight then 1 else 0 end
  ) + v_shift.end_time;

  return query
  select
    v_assignment.id,
    v_shift.id,
    v_shift.code,
    v_shift.name,
    v_work_date,
    v_start_local at time zone 'Asia/Ho_Chi_Minh',
    v_end_local at time zone 'Asia/Ho_Chi_Minh',
    p_at < (v_start_local at time zone 'Asia/Ho_Chi_Minh')
      or p_at >= (v_end_local at time zone 'Asia/Ho_Chi_Minh');
end;
$$;

create or replace function public.submit_order_to_pending(
  p_order_id uuid,
  p_actor_id uuid,
  p_shift_order_sheet_id uuid default null,
  p_submitted_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_status_code text;
  v_pending_status_id uuid;
  v_requester public.users%rowtype;
  v_leader_id uuid;
  v_shift record;
  v_sheet public.supply_shift_order_sheets%rowtype;
  v_item record;
  v_available numeric;
  v_inventory_mode text;
begin
  if p_submitted_at is null then
    raise exception using message = 'ORDER_SUBMITTED_AT_INVALID';
  end if;

  if not public.has_permission(p_actor_id, 'supply.order.create') then
    raise exception using message = 'ORDER_SUBMIT_FORBIDDEN';
  end if;

  select order_row.*
  into v_order
  from public.orders order_row
  where order_row.id = p_order_id
    and order_row.is_deleted = false
  for update of order_row;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.requested_by <> p_actor_id then
    raise exception using message = 'ORDER_SUBMIT_FORBIDDEN';
  end if;

  select status.code
  into v_status_code
  from public.order_statuses status
  where status.id = v_order.status_id
    and status.is_active = true
    and status.is_deleted = false;

  if v_status_code is distinct from 'DRAFT' then
    raise exception using message = 'ORDER_NOT_DRAFT';
  end if;

  select requester.*
  into v_requester
  from public.users requester
  where requester.id = v_order.requested_by
    and requester.is_active = true
    and requester.is_verified = true
    and requester.is_deleted = false;

  if not found or v_requester.area_id is distinct from v_order.to_area_id then
    raise exception using message = 'ORDER_REQUESTER_CONTEXT_INVALID';
  end if;

  v_leader_id := v_requester.managed_by_user_id;

  -- A leader without a manager may represent their own group only when the
  -- current hierarchy proves that they actively manage at least one user.
  if v_leader_id is null and exists (
    select 1
    from public.users member
    where member.managed_by_user_id = v_requester.id
      and member.is_active = true
      and member.is_deleted = false
  ) then
    v_leader_id := v_requester.id;
  end if;

  if v_leader_id is null or not exists (
    select 1
    from public.users leader
    where leader.id = v_leader_id
      and leader.is_active = true
      and leader.is_verified = true
      and leader.is_deleted = false
  ) then
    raise exception using message = 'ORDER_SHIFT_LEADER_NOT_FOUND';
  end if;

  select *
  into v_shift
  from public.resolve_user_work_shift_instance(v_order.requested_by, p_submitted_at);

  if not found then
    raise exception using message = 'WORK_SHIFT_ASSIGNMENT_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.order_items item
    where item.order_id = v_order.id
      and item.is_active = true
      and item.is_deleted = false
  ) then
    raise exception using message = 'ORDER_ITEMS_REQUIRED';
  end if;

  for v_item in
    select
      item.id,
      item.supply_id,
      item.provider_id,
      item.set_per_qty,
      supply.code as supply_code,
      provider.code as provider_code,
      category.code as category_code
    from public.order_items item
    join public.supplies supply
      on supply.id = item.supply_id
     and supply.is_active = true
     and supply.is_deleted = false
    join public.supply_categories category
      on category.id = supply.category_id
     and category.is_active = true
     and category.is_deleted = false
    join public.providers provider
      on provider.id = item.provider_id
     and provider.is_active = true
     and provider.is_deleted = false
    where item.order_id = v_order.id
      and item.is_active = true
      and item.is_deleted = false
    order by item.id
  loop
    if v_item.category_code = 'KIEN_SAT_TC' then
      v_inventory_mode := 'STACK';
      select coalesce(sum(balance.stack_quantity), 0)
      into v_available
      from public.stock_balances balance
      join public.storage_locations location
        on location.id = balance.storage_location_id
       and location.area_id = balance.area_id
       and location.is_active = true
       and location.is_deleted = false
      where balance.supply_id = v_item.supply_id
        and balance.provider_id = v_item.provider_id
        and balance.area_id = v_order.from_area_id
        and balance.set_per_qty = v_item.set_per_qty
        and balance.is_active = true
        and balance.is_deleted = false;
    else
      v_inventory_mode := 'NORMAL';
      select coalesce(sum(balance.quantity), 0)
      into v_available
      from public.stock_balances balance
      join public.storage_locations location
        on location.id = balance.storage_location_id
       and location.area_id = balance.area_id
       and location.is_active = true
       and location.is_deleted = false
      where balance.supply_id = v_item.supply_id
        and balance.provider_id = v_item.provider_id
        and balance.area_id = v_order.from_area_id
        and balance.set_per_qty is null
        and balance.is_active = true
        and balance.is_deleted = false;
    end if;

    if coalesce(v_available, 0) <= 0 then
      raise exception using
        message = 'ORDER_ITEM_ZERO_STOCK',
        detail = jsonb_build_object(
          'order_item_id', v_item.id,
          'supply_code', v_item.supply_code,
          'provider_code', v_item.provider_code,
          'set_per_qty', v_item.set_per_qty,
          'available_quantity', coalesce(v_available, 0),
          'inventory_mode', v_inventory_mode
        )::text;
    end if;
  end loop;

  if p_shift_order_sheet_id is not null then
    select sheet.*
    into v_sheet
    from public.supply_shift_order_sheets sheet
    where sheet.id = p_shift_order_sheet_id
      and sheet.is_active = true
      and sheet.is_deleted = false
    for update of sheet;

    if not found
       or v_sheet.area_id <> v_order.to_area_id
       or v_sheet.work_shift_id <> v_shift.work_shift_id
       or v_sheet.work_date <> v_shift.work_date
       or v_sheet.leader_id <> v_leader_id then
      raise exception using message = 'ORDER_SHIFT_SHEET_CONTEXT_INVALID';
    end if;
  else
    insert into public.supply_shift_order_sheets(
      area_id,
      work_shift_id,
      work_date,
      leader_id,
      is_active,
      is_deleted
    )
    values (
      v_order.to_area_id,
      v_shift.work_shift_id,
      v_shift.work_date,
      v_leader_id,
      true,
      false
    )
    on conflict (area_id, work_shift_id, work_date)
      where is_deleted = false
    do nothing
    returning * into v_sheet;

    if v_sheet.id is null then
      select sheet.*
      into v_sheet
      from public.supply_shift_order_sheets sheet
      where sheet.area_id = v_order.to_area_id
        and sheet.work_shift_id = v_shift.work_shift_id
        and sheet.work_date = v_shift.work_date
        and sheet.is_deleted = false
      for update of sheet;
    end if;

    if v_sheet.id is null or not v_sheet.is_active then
      raise exception using message = 'SHIFT_ORDER_SHEET_NOT_AVAILABLE';
    end if;

    if v_sheet.leader_id <> v_leader_id then
      raise exception using message = 'SHIFT_ORDER_SHEET_LEADER_CONFLICT';
    end if;
  end if;

  select status.id
  into v_pending_status_id
  from public.order_statuses status
  where status.code = 'PENDING'
    and status.is_active = true
    and status.is_deleted = false;

  if v_pending_status_id is null then
    raise exception using message = 'ORDER_STATUS_NOT_FOUND';
  end if;

  update public.orders
  set status_id = v_pending_status_id,
      submitted_at = p_submitted_at,
      shift_order_sheet_id = v_sheet.id,
      updated_at = now()
  where id = v_order.id;

  return v_sheet.id;
end;
$$;

alter table public.supply_shift_order_sheets enable row level security;

revoke all on table public.supply_shift_order_sheets
  from public, anon, authenticated, service_role;
grant select on table public.supply_shift_order_sheets to service_role;

revoke all on function public.resolve_user_work_shift_instance(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.resolve_user_work_shift_instance(uuid, timestamptz)
  to service_role;

revoke all on function public.submit_order_to_pending(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.submit_order_to_pending(uuid, uuid, uuid, timestamptz)
  to service_role;

comment on table public.supply_shift_order_sheets is
  'Persistent Supply Order grouping by Area, assigned WorkShift and business work date.';
comment on function public.resolve_user_work_shift_instance(uuid, timestamptz) is
  'Resolves temporal assignment and shift instance in Asia/Ho_Chi_Minh.';
comment on function public.submit_order_to_pending(uuid, uuid, uuid, timestamptz) is
  'Atomically checks zero stock, gets/creates the shift sheet, links the Order and submits it.';

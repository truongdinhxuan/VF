-- Phase 8: shared work-shift master data and temporal user assignment history.
-- These tables remain in public because Supply and Milkrun will share them.

create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  crosses_midnight boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_shifts_code_key unique (code),
  constraint work_shifts_code_not_blank check (btrim(code) <> ''),
  constraint work_shifts_name_not_blank check (btrim(name) <> ''),
  constraint work_shifts_active_not_deleted check (not (is_active and is_deleted))
);

create table public.user_work_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  work_shift_id uuid not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  assigned_by uuid not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_work_shift_assignments_user_id_fkey
    foreign key (user_id) references public.users(id)
    on update cascade on delete restrict,
  constraint user_work_shift_assignments_work_shift_id_fkey
    foreign key (work_shift_id) references public.work_shifts(id)
    on update cascade on delete restrict,
  constraint user_work_shift_assignments_assigned_by_fkey
    foreign key (assigned_by) references public.users(id)
    on update cascade on delete restrict,
  constraint user_work_shift_assignments_interval_valid check (
    effective_to is null or effective_to > effective_from
  ),
  constraint user_work_shift_assignments_lifecycle_valid check (
    (is_active and not is_deleted and effective_to is null)
    or (not is_active and effective_to is not null)
  )
);

create index user_work_shift_assignments_user_effective_idx
  on public.user_work_shift_assignments(user_id, effective_from desc);

create index user_work_shift_assignments_work_shift_id_idx
  on public.user_work_shift_assignments(work_shift_id);

create unique index user_work_shift_assignments_one_active_idx
  on public.user_work_shift_assignments(user_id)
  where is_active = true and is_deleted = false;

drop trigger if exists work_shifts_set_updated_at on public.work_shifts;
create trigger work_shifts_set_updated_at
before update on public.work_shifts
for each row execute function public.set_updated_at();

drop trigger if exists user_work_shift_assignments_set_updated_at
  on public.user_work_shift_assignments;
create trigger user_work_shift_assignments_set_updated_at
before update on public.user_work_shift_assignments
for each row execute function public.set_updated_at();

insert into public.work_shifts(
  code,
  name,
  start_time,
  end_time,
  crosses_midnight,
  is_system,
  is_active,
  is_deleted
)
values
  ('S1', 'Ca 1', time '06:00', time '14:00', false, true, true, false),
  ('S2', 'Ca 2', time '14:00', time '22:00', false, true, true, false),
  ('S3', 'Ca 3', time '22:00', time '06:00', true, true, true, false),
  ('S6', 'Ca 6', time '06:00', time '18:00', false, true, true, false),
  ('S7', 'Ca 7', time '18:00', time '06:00', true, true, true, false),
  ('HC', 'Hành chính', time '08:00', time '17:00', false, true, true, false)
on conflict (code) do update
set name = excluded.name,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    crosses_midnight = excluded.crosses_midnight,
    is_system = true,
    is_active = true,
    is_deleted = false,
    updated_at = now();

create or replace function public.assign_user_work_shift(
  p_user_id uuid,
  p_work_shift_id uuid,
  p_effective_from timestamptz,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.user_work_shift_assignments%rowtype;
  v_assignment_id uuid;
begin
  if not public.has_permission(p_actor_id, 'admin.user.update') then
    raise exception using message = 'WORK_SHIFT_ASSIGNMENT_FORBIDDEN';
  end if;

  if p_effective_from is null or p_effective_from > now() then
    raise exception using message = 'WORK_SHIFT_EFFECTIVE_FROM_INVALID';
  end if;

  perform 1
  from public.users u
  where u.id = p_user_id
    and u.is_active = true
    and u.is_deleted = false
  for update of u;

  if not found then
    raise exception using message = 'WORK_SHIFT_USER_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.work_shifts ws
    where ws.id = p_work_shift_id
      and ws.is_active = true
      and ws.is_deleted = false
  ) then
    raise exception using message = 'WORK_SHIFT_NOT_AVAILABLE';
  end if;

  select assignment.*
  into v_current
  from public.user_work_shift_assignments assignment
  where assignment.user_id = p_user_id
    and assignment.is_active = true
    and assignment.is_deleted = false
  for update of assignment;

  if found and v_current.work_shift_id = p_work_shift_id then
    return v_current.id;
  end if;

  if found and p_effective_from <= v_current.effective_from then
    raise exception using message = 'WORK_SHIFT_EFFECTIVE_FROM_INVALID';
  end if;

  if found then
    update public.user_work_shift_assignments
    set effective_to = p_effective_from,
        is_active = false,
        updated_at = now()
    where id = v_current.id;
  end if;

  insert into public.user_work_shift_assignments(
    user_id,
    work_shift_id,
    effective_from,
    assigned_by,
    is_active,
    is_deleted
  )
  values (
    p_user_id,
    p_work_shift_id,
    p_effective_from,
    p_actor_id,
    true,
    false
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

alter table public.work_shifts enable row level security;
alter table public.user_work_shift_assignments enable row level security;

revoke all on table public.work_shifts from public, anon, authenticated;
revoke all on table public.user_work_shift_assignments from public, anon, authenticated;
revoke all on table public.work_shifts from service_role;
revoke all on table public.user_work_shift_assignments from service_role;
grant select on table public.work_shifts to service_role;
grant select on table public.user_work_shift_assignments to service_role;

revoke all on function public.assign_user_work_shift(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_user_work_shift(uuid, uuid, timestamptz, uuid)
  to service_role;

comment on table public.work_shifts is
  'Shared work-shift master data for Supply and Milkrun.';
comment on table public.user_work_shift_assignments is
  'Temporal [effective_from, effective_to) user work-shift assignment history.';
comment on function public.assign_user_work_shift(uuid, uuid, timestamptz, uuid) is
  'Atomically closes the current assignment and creates one new active assignment.';

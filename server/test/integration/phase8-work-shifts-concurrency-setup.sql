\set ON_ERROR_STOP on

delete from public.user_work_shift_assignments
where user_id = '68000000-0000-4000-8000-000000000008';

insert into public.roles(code, name, description, is_system, is_active, is_deleted)
values (
  'PHASE8_ASSIGNER',
  'Phase 8 assignment test actor',
  'LOCAL TEST ONLY',
  false,
  true,
  false
)
on conflict (code) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.role_permissions(role_id, permission_id, is_active, is_deleted)
select role_record.id, permission_record.id, true, false
from public.roles role_record
join public.permissions permission_record
  on permission_record.code = 'admin.user.update'
where role_record.code = 'PHASE8_ASSIGNER'
on conflict (role_id, permission_id) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.users(
  id, vinfast_id, email, role_id, area_id, is_active, is_verified,
  is_deleted, first_name, last_name
)
select
  '68000000-0000-4000-8000-000000000008',
  968000008,
  'phase8-concurrency@local.test',
  role_record.id,
  area.id,
  true,
  true,
  false,
  'Phase8',
  'Concurrency'
from public.roles role_record
cross join public.areas area
where role_record.code = 'DATA_PACKING'
  and area.code = 'EDC_LOGISTICS'
on conflict (id) do update
set is_active = true, is_deleted = false, updated_at = now();

insert into public.users(
  id, vinfast_id, email, role_id, area_id, is_active, is_verified,
  is_deleted, first_name, last_name
)
select
  '68000000-0000-4000-8000-000000000009',
  968000009,
  'phase8-assigner@local.test',
  role_record.id,
  area.id,
  true,
  true,
  false,
  'Phase8',
  'Assigner'
from public.roles role_record
cross join public.areas area
where role_record.code = 'PHASE8_ASSIGNER'
  and area.code = 'EDC_LOGISTICS'
on conflict (id) do update
set role_id = excluded.role_id,
    is_active = true,
    is_verified = true,
    is_deleted = false,
    updated_at = now();

create or replace function public.phase8_test_assignment_delay()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id = '68000000-0000-4000-8000-000000000008'::uuid then
    perform pg_sleep(1);
  end if;
  return new;
end;
$$;

drop trigger if exists phase8_test_assignment_delay
  on public.user_work_shift_assignments;
create trigger phase8_test_assignment_delay
before insert on public.user_work_shift_assignments
for each row execute function public.phase8_test_assignment_delay();

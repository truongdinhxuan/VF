\set ON_ERROR_STOP on

do $$
declare
  v_active integer;
  v_invalid integer;
begin
  select count(*) into v_active
  from public.user_work_shift_assignments
  where user_id = '68000000-0000-4000-8000-000000000008'
    and is_active and not is_deleted and effective_to is null;

  select count(*) into v_invalid
  from public.user_work_shift_assignments
  where user_id = '68000000-0000-4000-8000-000000000008'
    and (
      (is_active and effective_to is not null)
      or (not is_active and effective_to is null)
      or (effective_to is not null and effective_to <= effective_from)
    );

  if v_active <> 1 or v_invalid <> 0 then
    raise exception 'P8-019 invalid concurrent result: active %, invalid %', v_active, v_invalid;
  end if;
end;
$$;

drop trigger if exists phase8_test_assignment_delay
  on public.user_work_shift_assignments;
drop function if exists public.phase8_test_assignment_delay();
delete from public.user_work_shift_assignments
where user_id = '68000000-0000-4000-8000-000000000008';
delete from public.user_roles
where user_id in (
  '68000000-0000-4000-8000-000000000008',
  '68000000-0000-4000-8000-000000000009'
);
delete from public.user_credentials
where user_id in (
  '68000000-0000-4000-8000-000000000008',
  '68000000-0000-4000-8000-000000000009'
);
delete from public.users
where id in (
  '68000000-0000-4000-8000-000000000008',
  '68000000-0000-4000-8000-000000000009'
);
delete from public.role_permissions
where role_id = (select id from public.roles where code = 'PHASE8_ASSIGNER');
delete from public.roles where code = 'PHASE8_ASSIGNER';

select 'phase8-work-shifts-concurrency: PASS' as result;

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_actor uuid := '44000000-0000-4000-8000-000000000003';
  v_unauthorized_actor uuid := '67000000-0000-4000-8000-000000000009';
  v_user uuid := '67000000-0000-4000-8000-000000000009';
  v_s1 uuid;
  v_s2 uuid;
  v_s3 uuid;
  v_hc uuid;
  v_first uuid;
  v_same uuid;
  v_second uuid;
  v_count integer;
  v_admin_role uuid;
  v_packing_role uuid;
  v_area uuid;
begin
  select id into strict v_admin_role from public.roles where code = 'ADMIN';
  select id into strict v_packing_role from public.roles where code = 'DATA_PACKING';
  select id into strict v_area from public.areas where code = 'EDC_LOGISTICS';

  insert into public.users(
    id, vinfast_id, email, role_id, area_id, is_active, is_verified,
    is_deleted, first_name, last_name
  ) values
    (v_actor, 948000001, 'phase8-admin@local.test', v_admin_role, v_area,
      true, true, false, 'Phase8', 'Admin'),
    (v_user, 948000002, 'phase8-user@local.test', v_packing_role, v_area,
      true, true, false, 'Phase8', 'User');

  if (
    select jsonb_agg(jsonb_build_object(
      'code', code,
      'start', start_time,
      'end', end_time,
      'crosses', crosses_midnight
    ) order by code)
    from public.work_shifts
    where is_active and not is_deleted and is_system
  ) is distinct from jsonb_build_array(
    jsonb_build_object('code', 'HC', 'start', time '08:00', 'end', time '17:00', 'crosses', false),
    jsonb_build_object('code', 'S1', 'start', time '06:00', 'end', time '14:00', 'crosses', false),
    jsonb_build_object('code', 'S2', 'start', time '14:00', 'end', time '22:00', 'crosses', false),
    jsonb_build_object('code', 'S3', 'start', time '22:00', 'end', time '06:00', 'crosses', true),
    jsonb_build_object('code', 'S6', 'start', time '06:00', 'end', time '18:00', 'crosses', false),
    jsonb_build_object('code', 'S7', 'start', time '18:00', 'end', time '06:00', 'crosses', true)
  ) then
    raise exception 'P8-001 exact system shift seed failed';
  end if;

  select id into strict v_s1 from public.work_shifts where code = 'S1';
  select id into strict v_s2 from public.work_shifts where code = 'S2';
  select id into strict v_s3 from public.work_shifts where code = 'S3';
  select id into strict v_hc from public.work_shifts where code = 'HC';

  v_first := public.assign_user_work_shift(v_user, v_s1, '2026-08-01 00:00:00+00', v_actor);
  v_same := public.assign_user_work_shift(v_user, v_s1, '2026-08-02 00:00:00+00', v_actor);
  if v_same <> v_first then
    raise exception 'same-shift assignment was not idempotent';
  end if;

  v_second := public.assign_user_work_shift(v_user, v_s2, '2026-08-15 00:00:00+00', v_actor);
  if v_second = v_first then
    raise exception 'shift change did not create a new history row';
  end if;

  if not exists (
    select 1 from public.user_work_shift_assignments
    where id = v_first and work_shift_id = v_s1 and not is_active
      and effective_to = '2026-08-15 00:00:00+00'
  ) or not exists (
    select 1 from public.user_work_shift_assignments
    where id = v_second and work_shift_id = v_s2 and is_active and effective_to is null
  ) then
    raise exception 'P8-004 S1 to S2 history state failed';
  end if;

  select count(*) into v_count
  from public.user_work_shift_assignments
  where user_id = v_user
    and '2026-08-15 00:00:00+00' >= effective_from
    and (effective_to is null or '2026-08-15 00:00:00+00' < effective_to);
  if v_count <> 1 then
    raise exception 'P8-011 half-open boundary matched % rows', v_count;
  end if;

  begin
    insert into public.user_work_shift_assignments(
      user_id, work_shift_id, effective_from, assigned_by
    ) values (v_user, v_s3, '2026-08-16 00:00:00+00', v_actor);
    raise exception 'one-active partial unique index did not reject duplicate';
  exception when unique_violation then
    null;
  end;

  update public.work_shifts set is_active = false where id = v_hc;
  begin
    perform public.assign_user_work_shift(v_user, v_hc, '2026-08-16 00:00:00+00', v_actor);
    raise exception 'inactive shift assignment unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%WORK_SHIFT_NOT_AVAILABLE%' then raise; end if;
  end;

  begin
    perform public.assign_user_work_shift(v_user, v_s3, '2026-08-16 00:00:00+00', v_unauthorized_actor);
    raise exception 'unauthorized assignment unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%WORK_SHIFT_ASSIGNMENT_FORBIDDEN%' then raise; end if;
  end;

  execute $trigger$
    create function pg_temp.reject_s3_assignment()
    returns trigger language plpgsql as $body$
    begin
      if exists (
        select 1 from public.work_shifts
        where id = new.work_shift_id and code = 'S3'
      ) then
        raise exception 'FORCED_ASSIGNMENT_INSERT_FAILURE';
      end if;
      return new;
    end
    $body$
  $trigger$;
  create trigger phase8_force_insert_failure
    before insert on public.user_work_shift_assignments
    for each row execute function pg_temp.reject_s3_assignment();

  begin
    perform public.assign_user_work_shift(v_user, v_s3, '2026-08-16 00:00:00+00', v_actor);
    raise exception 'forced assignment failure unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%FORCED_ASSIGNMENT_INSERT_FAILURE%' then raise; end if;
  end;

  if not exists (
    select 1 from public.user_work_shift_assignments
    where id = v_second and is_active and effective_to is null
  ) then
    raise exception 'P8-018 RPC did not roll back closed current assignment';
  end if;

  drop trigger phase8_force_insert_failure on public.user_work_shift_assignments;

  if to_regclass('public.supply_shift_order_sheets') is not null then
    raise exception 'P8-022 Phase 9 table exists unexpectedly';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'shift_order_sheet_id'
  ) then
    raise exception 'P8-022 Phase 9 orders column exists unexpectedly';
  end if;
end;
$$;

rollback;

select 'phase8-work-shifts-integration: PASS' as result;

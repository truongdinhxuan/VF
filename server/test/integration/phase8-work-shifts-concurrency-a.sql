\set ON_ERROR_STOP on

do $$
declare
  v_shift uuid;
begin
  select id into strict v_shift from public.work_shifts where code = 'S1';
  begin
    perform public.assign_user_work_shift(
      '68000000-0000-4000-8000-000000000008',
      v_shift,
      '2026-08-01 00:00:00+00',
      '68000000-0000-4000-8000-000000000009'
    );
  exception when others then
    if sqlerrm not like '%WORK_SHIFT_EFFECTIVE_FROM_INVALID%' then raise; end if;
  end;
end;
$$;

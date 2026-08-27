\set ON_ERROR_STOP on
do $$
declare
  v_sheet_count integer;
  v_linked_count integer;
begin
  select count(distinct shift_order_sheet_id), count(*)
  into v_sheet_count, v_linked_count
  from public.orders
  where id in (
    '69100000-0000-4000-8000-000000000021',
    '69100000-0000-4000-8000-000000000022'
  ) and shift_order_sheet_id is not null;
  if v_sheet_count <> 1 or v_linked_count <> 2 then
    raise exception 'P9-006 concurrency failed: sheets %, linked %',
      v_sheet_count, v_linked_count;
  end if;
end;
$$;
select 'phase9-shift-sheet-concurrency: PASS' as result;


do $p6_shared_b$
declare v_error text;
begin
  perform pg_sleep(1);
  begin
    perform public.issue_order(
      '66000000-0000-4000-8000-000000000024',
      '66000000-0000-4000-8000-000000000003', '[]'::jsonb, null, null
    );
  exception when others then v_error := sqlerrm;
  end;
  if v_error <> 'STACK_ISSUE_STOCK_CONFLICT' then
    raise exception 'T-027 expected STACK_ISSUE_STOCK_CONFLICT, got %', v_error;
  end if;
end
$p6_shared_b$;

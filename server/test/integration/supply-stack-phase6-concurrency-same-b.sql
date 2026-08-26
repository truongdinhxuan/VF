do $p6_same_b$
declare v_error text;
begin
  perform pg_sleep(1);
  begin
    perform public.issue_order(
      '66000000-0000-4000-8000-000000000013',
      '66000000-0000-4000-8000-000000000003', '[]'::jsonb, null, null
    );
  exception when others then v_error := sqlerrm;
  end;
  if v_error <> 'ORDER_ALREADY_ISSUED' then
    raise exception 'T-026 expected ORDER_ALREADY_ISSUED, got %', v_error;
  end if;
end
$p6_same_b$;

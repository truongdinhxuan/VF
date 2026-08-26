do $p6_adjust_b$
declare v_supply uuid; v_type uuid;
begin
  perform pg_sleep(1);
  select id into strict v_supply from public.supplies where code='71000860';
  select id into strict v_type from public.stock_transaction_types where code='IMPORT';
  perform public.apply_stock_adjustment_v4(
    v_supply,
    '66000000-0000-4000-8000-000000000004',
    '66000000-0000-4000-8000-000000000001',
    '66000000-0000-4000-8000-000000000031',
    v_type, 21, 1, 21, null,
    'Concurrent verified import', 'Phase 6 concurrency adjustment',
    '66000000-0000-4000-8000-000000000003'
  );
end
$p6_adjust_b$;

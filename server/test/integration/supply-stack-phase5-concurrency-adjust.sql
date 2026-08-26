-- Session B: starts after Session A owns the StockBalance row lock. IMPORT is
-- the only manual stack operation supported by Phase 2 and must apply to the
-- post-correction balance, never overwrite it.
do $p5_concurrency_adjust$
declare
  v_supply uuid;
  v_type uuid;
begin
  perform pg_sleep(1);
  select id into strict v_supply from public.supplies where code = '71000860';
  select id into strict v_type
  from public.stock_transaction_types where code = 'IMPORT';
  perform public.apply_stock_adjustment_v4(
    v_supply,
    '55000000-0000-4000-8000-000000000004',
    '55000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000005',
    v_type,
    25,
    1,
    25,
    null,
    'Concurrent verified import',
    'Phase 5 concurrency test',
    '55000000-0000-4000-8000-000000000003'
  );
end
$p5_concurrency_adjust$;

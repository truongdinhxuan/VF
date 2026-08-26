-- Session B: same StockBalance; must wait for Session A row lock, then update.
do $p4_concurrency_adjust$
declare
  v_supply uuid; v_type uuid;
begin
  -- Give Session A time to acquire the authoritative balance row lock first.
  perform pg_sleep(1);
  select id into strict v_supply from public.supplies where code='71000860';
  select id into strict v_type from public.stock_transaction_types where code='IMPORT';
  perform public.apply_stock_adjustment_v4(
    v_supply,
    '44000000-0000-4000-8000-000000000004',
    '44000000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000005',
    v_type,
    30,
    1,
    30,
    null,
    'Phase 4 concurrency verification',
    'Allocation vs adjustment lock test',
    '44000000-0000-4000-8000-000000000003'
  );
end
$p4_concurrency_adjust$;

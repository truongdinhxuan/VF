do $p4_lock_adjust$
declare v_supply uuid; v_type uuid;
begin
  perform pg_sleep(1);
  select id into strict v_supply from public.supplies where code='71000860';
  select id into strict v_type from public.stock_transaction_types where code='IMPORT';
  perform public.apply_stock_adjustment_v4(
    v_supply,'44000000-0000-4000-8000-000000000004',
    '44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000009',
    v_type,31,1,31,null,'Phase 4 lock observation','Lock observation',
    '44000000-0000-4000-8000-000000000003'
  );
end
$p4_lock_adjust$;

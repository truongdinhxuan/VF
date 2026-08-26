do $p5_concurrency_verify$
declare
  v_stack numeric;
  v_quantity numeric;
  v_corrections bigint;
  v_imports bigint;
begin
  select stack_quantity, quantity
  into strict v_stack, v_quantity
  from public.stock_balances
  where id = '55000000-0000-4000-8000-000000000006';

  select count(*) into v_corrections
  from public.stock_transactions tx
  join public.stock_transaction_types tt on tt.id = tx.transaction_type_id
  where tx.inventory_discrepancy_id is not null
    and tt.code = 'DISCREPANCY_CORRECTION'
    and tx.order_id = '55000000-0000-4000-8000-000000000007';

  select count(*) into v_imports
  from public.stock_transactions tx
  join public.stock_transaction_types tt on tt.id = tx.transaction_type_id
  where tx.storage_location_id = '55000000-0000-4000-8000-000000000005'
    and tt.code = 'IMPORT';

  -- 10 stacks - 2 discrepancy correction + 1 concurrent IMPORT = 9.
  if v_stack <> 9 or v_quantity <> 225
     or v_corrections <> 1 or v_imports <> 1 then
    raise exception 'T-016 concurrency mismatch: stack %, quantity %, corrections %, imports %',
      v_stack, v_quantity, v_corrections, v_imports;
  end if;
  if v_stack < 0 or v_quantity < 0 then
    raise exception 'T-016 produced negative stock';
  end if;
  raise notice 'PASS T-016 row locking: no lost update, negative stock or duplicate ledger';
end
$p5_concurrency_verify$;

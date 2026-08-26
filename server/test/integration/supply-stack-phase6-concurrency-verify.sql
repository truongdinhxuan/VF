do $p6_concurrency_verify$
declare
  v_issue_type uuid;
  v_import_type uuid;
begin
  select id into strict v_issue_type from public.stock_transaction_types where code='ISSUE';
  select id into strict v_import_type from public.stock_transaction_types where code='IMPORT';

  if (select stack_quantity from public.stock_balances where id='66000000-0000-4000-8000-000000000012') <> 4
     or (select count(*) from public.stock_transactions where order_id='66000000-0000-4000-8000-000000000013' and transaction_type_id=v_issue_type) <> 1 then
    raise exception 'T-026 duplicate same-Order issue mismatch';
  end if;
  if (select stack_quantity from public.stock_balances where id='66000000-0000-4000-8000-000000000022') <> 2
     or (select count(*) from public.stock_transactions where order_id in ('66000000-0000-4000-8000-000000000023','66000000-0000-4000-8000-000000000024') and transaction_type_id=v_issue_type) <> 1 then
    raise exception 'T-027 shared-balance conflict mismatch';
  end if;
  if (select stack_quantity from public.stock_balances where id='66000000-0000-4000-8000-000000000032') <> 5
     or (select count(*) from public.stock_transactions where storage_location_id='66000000-0000-4000-8000-000000000031' and transaction_type_id in (v_issue_type,v_import_type)) <> 2 then
    raise exception 'T-028 issue/adjustment serialization mismatch';
  end if;
  if (select stack_quantity from public.stock_balances where id='66000000-0000-4000-8000-000000000042') <> 2
     or (select count(*) from public.stock_transactions where order_id='66000000-0000-4000-8000-000000000043' and transaction_type_id=v_issue_type) <> 1 then
    raise exception 'T-029 confirm/issue serialization mismatch';
  end if;
  raise notice 'PASS T-026 duplicate same-Order issue serialization';
  raise notice 'PASS T-027 two Orders sharing one balance serialize without overdraw';
  raise notice 'PASS T-028 issue and manual adjustment serialize without lost update';
  raise notice 'PASS T-029 allocation confirmation and issue serialize safely';
end
$p6_concurrency_verify$;

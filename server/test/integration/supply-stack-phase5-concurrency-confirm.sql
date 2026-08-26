-- Session A: confirm first, then retain the transaction locks long enough for
-- Session B to prove it waits and reads the committed canonical balance.
do $p5_concurrency_confirm$
begin
  perform public.confirm_stack_allocation_actual(
    '55000000-0000-4000-8000-000000000009',
    1,
    '55000000-0000-4000-8000-000000000003',
    'Phase 5 concurrency correction'
  );
  perform pg_sleep(5);
end
$p5_concurrency_confirm$;

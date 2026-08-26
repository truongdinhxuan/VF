-- Session A: allocation locks the balance; sleep keeps that lock until commit.
do $p4_concurrency_allocate$
begin
  perform public.allocate_stack_order(
    '44000000-0000-4000-8000-000000000007',
    '44000000-0000-4000-8000-000000000003'
  );
  perform pg_sleep(5);
end
$p4_concurrency_allocate$;

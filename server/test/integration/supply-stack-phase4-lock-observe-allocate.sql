do $p4_lock_allocate$
begin
  perform public.allocate_stack_order(
    '44000000-0000-4000-8000-000000000011',
    '44000000-0000-4000-8000-000000000003'
  );
  perform pg_sleep(8);
end
$p4_lock_allocate$;

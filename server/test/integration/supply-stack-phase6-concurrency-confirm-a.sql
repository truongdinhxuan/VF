begin;
select public.confirm_stack_allocation_actual(
  '66000000-0000-4000-8000-000000000045', 3,
  '66000000-0000-4000-8000-000000000003', null
);
select pg_sleep(5);
commit;

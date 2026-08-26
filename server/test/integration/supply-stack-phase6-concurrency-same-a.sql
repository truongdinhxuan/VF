begin;
select public.issue_order(
  '66000000-0000-4000-8000-000000000013',
  '66000000-0000-4000-8000-000000000003', '[]'::jsonb, null, null
);
select pg_sleep(5);
commit;

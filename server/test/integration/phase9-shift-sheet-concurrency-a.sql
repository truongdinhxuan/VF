\set ON_ERROR_STOP on
select public.submit_order_to_pending(
  '69100000-0000-4000-8000-000000000021',
  '69100000-0000-4000-8000-000000000002',
  null,
  '2026-09-01T02:00:00Z'
);


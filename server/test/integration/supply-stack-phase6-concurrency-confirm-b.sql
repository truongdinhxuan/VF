do $p6_confirm_b$
begin
  perform pg_sleep(1);
  perform public.issue_order(
    '66000000-0000-4000-8000-000000000043',
    '66000000-0000-4000-8000-000000000003', '[]'::jsonb, null, null
  );
end
$p6_confirm_b$;

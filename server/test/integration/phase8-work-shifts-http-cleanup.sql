\set ON_ERROR_STOP on

delete from public.user_work_shift_assignments
where user_id = '68000000-0000-4000-8000-000000000013';
delete from public.user_roles
where user_id in (
  '68000000-0000-4000-8000-000000000011',
  '68000000-0000-4000-8000-000000000012',
  '68000000-0000-4000-8000-000000000013'
);
delete from public.user_credentials
where user_id in (
  '68000000-0000-4000-8000-000000000011',
  '68000000-0000-4000-8000-000000000012',
  '68000000-0000-4000-8000-000000000013'
);
delete from public.users
where id in (
  '68000000-0000-4000-8000-000000000011',
  '68000000-0000-4000-8000-000000000012',
  '68000000-0000-4000-8000-000000000013'
);
delete from public.role_permissions
where role_id in (
  select id from public.roles
  where code in ('PHASE8_HTTP_MANAGER', 'PHASE8_HTTP_READER')
);
delete from public.roles
where code in ('PHASE8_HTTP_MANAGER', 'PHASE8_HTTP_READER');

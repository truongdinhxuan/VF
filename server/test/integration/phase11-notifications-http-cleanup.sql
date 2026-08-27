\set ON_ERROR_STOP on

begin;
set local session_replication_role = replica;

delete from public.notification_recipients
where notification_id in (
  select id from public.notifications
  where created_by::text like '69400000-0000-4000-8000-%'
);
delete from public.notifications
where created_by::text like '69400000-0000-4000-8000-%';
delete from public.order_revisions
where order_id in (
  select id from public.orders
  where requested_by = '69400000-0000-4000-8000-000000000001'::uuid
);
delete from public.order_items
where order_id in (
  select id from public.orders
  where requested_by = '69400000-0000-4000-8000-000000000001'::uuid
);
delete from public.orders
where requested_by = '69400000-0000-4000-8000-000000000001'::uuid;
delete from public.supply_shift_order_sheets sheet
where sheet.leader_id = '69400000-0000-4000-8000-000000000003'::uuid
  and not exists (
    select 1 from public.orders order_row
    where order_row.shift_order_sheet_id = sheet.id
  );
delete from public.user_work_shift_assignments
where user_id = '69400000-0000-4000-8000-000000000001'::uuid;
delete from public.user_roles where user_id::text like '69400000-0000-4000-8000-%';
update public.users
set is_active = false, is_deleted = true, updated_at = now()
where id::text like '69400000-0000-4000-8000-%';
delete from public.role_permissions
where role_id in (select id from public.roles where code like 'P11_%');
update public.roles
set is_active = false, is_deleted = true, updated_at = now()
where code like 'P11_%';

commit;

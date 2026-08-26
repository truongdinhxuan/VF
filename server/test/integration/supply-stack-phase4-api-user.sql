-- LOCAL/DISPOSABLE DATABASE ONLY. User without allocation permission.
do $p4_api_user$
declare v_admin uuid;
begin
  select id into strict v_admin from public.roles where code='ADMIN' and is_system;
  insert into public.users(id,vinfast_id,email,role_id,area_id,first_name,last_name,is_active,is_verified,is_deleted)
    values('44000000-0000-4000-8000-000000000019',940000004,'p4cc_api_outsider@local.test',v_admin,
      '44000000-0000-4000-8000-000000000001','P4','API Outsider',true,true,false);
  delete from public.user_roles where user_id='44000000-0000-4000-8000-000000000019';
end
$p4_api_user$;

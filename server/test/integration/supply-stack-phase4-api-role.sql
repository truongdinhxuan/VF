-- LOCAL/DISPOSABLE DATABASE ONLY. Valid custom role with no allocation permission.
do $p4_api_role$
begin
  insert into public.roles(id,code,name,is_system)
    values('44000000-0000-4000-8000-000000000020','P4CC_VIEWER','P4 API viewer',false);
  update public.users
    set role_id='44000000-0000-4000-8000-000000000020'
    where id='44000000-0000-4000-8000-000000000019';
  insert into public.user_roles(user_id,role_id)
    values('44000000-0000-4000-8000-000000000019','44000000-0000-4000-8000-000000000020')
    on conflict(user_id,role_id) do update set is_active=true,is_deleted=false;
end
$p4_api_role$;

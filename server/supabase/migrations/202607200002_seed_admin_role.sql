insert into public.roles (role_name)
values ('Admin')
on conflict (role_name) do nothing;

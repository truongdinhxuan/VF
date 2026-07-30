begin;

create table if not exists public.user_credentials (
  user_id uuid primary key
    references public.users(id) on delete cascade on update cascade,
  password_hash text not null
    check (length(password_hash) > 0),
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_credentials_set_updated_at
  on public.user_credentials;
create trigger user_credentials_set_updated_at
before update on public.user_credentials
for each row execute function public.set_updated_at();

alter table public.user_credentials enable row level security;

revoke all on table public.user_credentials from public, anon, authenticated;
grant select, insert, update, delete
  on table public.user_credentials to service_role;

create or replace function public.create_internal_user(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_vinfast_id integer,
  p_phone_number text,
  p_avatar_url text,
  p_role_id uuid,
  p_area_id uuid,
  p_managed_by_user_id uuid,
  p_password_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    vinfast_id,
    phone_number,
    avatar_url,
    role_id,
    area_id,
    managed_by_user_id,
    is_verified,
    is_active,
    is_deleted
  )
  values (
    v_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_vinfast_id,
    p_phone_number,
    p_avatar_url,
    p_role_id,
    p_area_id,
    p_managed_by_user_id,
    false,
    true,
    false
  );

  insert into public.user_credentials (user_id, password_hash)
  values (v_user_id, p_password_hash);

  return v_user_id;
end;
$$;

revoke all on function public.create_internal_user(
  text,
  text,
  text,
  integer,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.create_internal_user(
  text,
  text,
  text,
  integer,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text
) to service_role;

commit;

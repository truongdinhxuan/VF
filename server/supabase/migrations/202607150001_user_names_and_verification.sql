-- Replace users.full_name with split name fields and require account approval.
-- Existing active accounts are treated as already approved unless a legacy
-- isverified value exists, in which case that value is preserved.

begin;

alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists last_name text;
alter table public.users add column if not exists is_verified boolean;

update public.users as u
set
  last_name = coalesce(
    nullif(btrim(u.last_name), ''),
    nullif(split_part(btrim(u.full_name), ' ', 1), '')
  ),
  first_name = coalesce(
    nullif(btrim(u.first_name), ''),
    nullif(
      case
        when position(' ' in btrim(u.full_name)) > 0 then
          btrim(substring(btrim(u.full_name) from position(' ' in btrim(u.full_name)) + 1))
        else btrim(u.full_name)
      end,
      ''
    )
  )
where u.first_name is null
   or nullif(btrim(u.first_name), '') is null
   or u.last_name is null
   or nullif(btrim(u.last_name), '') is null;

update public.users as u
set is_verified = case
  when to_jsonb(u) ? 'isverified' then
    lower(coalesce(to_jsonb(u) ->> 'isverified', 'false')) = 'true'
  else coalesce(u.is_active, false)
end
where u.is_verified is null;

do $$
begin
  if exists (
    select 1
    from public.users
    where first_name is null
       or nullif(btrim(first_name), '') is null
       or last_name is null
       or nullif(btrim(last_name), '') is null
  ) then
    raise exception 'Cannot remove users.full_name: first_name/last_name mapping is incomplete';
  end if;
end
$$;

alter table public.users alter column first_name set not null;
alter table public.users alter column last_name set not null;
alter table public.users alter column is_verified set default false;
alter table public.users alter column is_verified set not null;

alter table public.users drop constraint if exists users_full_name_required;
alter table public.users drop column if exists full_name;
alter table public.users drop column if exists isverified;

comment on column public.users.first_name is 'Given name';
comment on column public.users.last_name is 'Family name';
comment on column public.users.is_verified is 'Approved for access to internal data';

commit;

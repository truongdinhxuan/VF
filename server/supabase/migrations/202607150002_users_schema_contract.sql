-- Enforce and verify the current public.users schema after the name and
-- account-verification refactor.

begin;

alter table public.users alter column is_active set default true;
alter table public.users alter column is_active set not null;
alter table public.users alter column is_verified set default false;
alter table public.users alter column is_verified set not null;
alter table public.users alter column first_name set not null;
alter table public.users alter column last_name set not null;

do $$
declare
  missing_columns text;
  unexpected_columns text;
begin
  with expected(column_name) as (
    values
      ('id'),
      ('vinfast_id'),
      ('email'),
      ('phone_number'),
      ('avatar_url'),
      ('role_id'),
      ('position_id'),
      ('area_id'),
      ('managed_by_user_id'),
      ('is_active'),
      ('is_verified'),
      ('created_at'),
      ('updated_at'),
      ('first_name'),
      ('last_name')
  )
  select string_agg(e.column_name, ', ' order by e.column_name)
    into missing_columns
  from expected e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'users'
   and c.column_name = e.column_name
  where c.column_name is null;

  with expected(column_name) as (
    values
      ('id'),
      ('vinfast_id'),
      ('email'),
      ('phone_number'),
      ('avatar_url'),
      ('role_id'),
      ('position_id'),
      ('area_id'),
      ('managed_by_user_id'),
      ('is_active'),
      ('is_verified'),
      ('created_at'),
      ('updated_at'),
      ('first_name'),
      ('last_name')
  )
  select string_agg(c.column_name, ', ' order by c.column_name)
    into unexpected_columns
  from information_schema.columns c
  left join expected e on e.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and e.column_name is null;

  if missing_columns is not null then
    raise exception 'public.users is missing columns: %', missing_columns;
  end if;

  if unexpected_columns is not null then
    raise exception 'public.users has unexpected columns: %', unexpected_columns;
  end if;
end
$$;

commit;

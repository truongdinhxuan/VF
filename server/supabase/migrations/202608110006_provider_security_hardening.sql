-- Final Provider security hardening.
--
-- The application authenticates with its own Fastify JWT and performs all
-- database access through the service-role client. Supabase anon/authenticated
-- roles must therefore never read or mutate Provider-scoped inventory tables
-- directly; authorization remains in Fastify permission middleware.

begin;

alter table public.providers enable row level security;
alter table public.supply_providers enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_transactions enable row level security;
alter table public.order_items enable row level security;

revoke all on table public.providers
from public, anon, authenticated;
revoke all on table public.supply_providers
from public, anon, authenticated;
revoke all on table public.stock_balances
from public, anon, authenticated;
revoke all on table public.stock_transactions
from public, anon, authenticated;
revoke all on table public.order_items
from public, anon, authenticated;

grant all on table public.providers to service_role;
grant all on table public.supply_providers to service_role;
grant all on table public.stock_balances to service_role;
grant all on table public.stock_transactions to service_role;
grant all on table public.order_items to service_role;

-- Protect the system fallback Provider at the database boundary as well as in
-- ProvidersService. Name and description remain editable, but its stable code
-- and usable lifecycle state cannot be changed, and the row cannot be deleted.
create or replace function public.protect_unknown_provider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.code <> 'UNKNOW' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Provider UNKNOW cannot be deleted';
  end if;

  if new.code is distinct from old.code then
    raise exception 'Provider UNKNOW code cannot be changed';
  end if;

  if new.is_active is distinct from true
     or new.is_deleted is distinct from false then
    raise exception 'Provider UNKNOW cannot be deactivated';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_unknown_provider()
from public, anon, authenticated;
grant execute on function public.protect_unknown_provider()
to service_role;

drop trigger if exists providers_protect_unknown on public.providers;
create trigger providers_protect_unknown
before update or delete on public.providers
for each row execute function public.protect_unknown_provider();

-- Fail rather than commit a partially hardened or inconsistent Provider
-- schema. These checks do not rewrite business data.
do $$
declare
  v_unknown_count bigint;
begin
  select count(*) into v_unknown_count
  from public.providers
  where code = 'UNKNOW'
    and is_active = true
    and is_deleted = false;

  if v_unknown_count <> 1 then
    raise exception 'Expected exactly one active Provider UNKNOW, found %',
      v_unknown_count;
  end if;

  if exists (
    select 1
    from public.supplies s
    where not exists (
      select 1
      from public.supply_providers sp
      where sp.supply_id = s.id
        and sp.is_active = true
        and sp.is_deleted = false
    )
  ) then
    raise exception 'At least one Supply has no active Provider relation';
  end if;

  if exists (select 1 from public.stock_balances where provider_id is null)
     or exists (select 1 from public.stock_transactions where provider_id is null)
     or exists (select 1 from public.order_items where provider_id is null) then
    raise exception 'Provider backfill is incomplete';
  end if;
end
$$;

commit;

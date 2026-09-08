-- AUTH Phase 1: short-lived access tokens backed by revocable, rotating
-- refresh sessions. Raw refresh tokens never enter PostgreSQL.

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  user_agent text,
  ip_address text,
  rotation_counter bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_sessions_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint auth_sessions_refresh_token_hash_key unique (refresh_token_hash),
  constraint auth_sessions_rotation_counter_check check (rotation_counter >= 0),
  constraint auth_sessions_expiry_check check (expires_at > created_at)
);

create index auth_sessions_active_user_idx
  on public.auth_sessions(user_id, expires_at desc)
  where revoked_at is null;

create index auth_sessions_expiry_idx
  on public.auth_sessions(expires_at);

create trigger set_auth_sessions_updated_at
before update on public.auth_sessions
for each row execute function public.set_updated_at();

alter table public.auth_sessions enable row level security;

revoke all on table public.auth_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_sessions to service_role;

-- Compare-and-swap rotation makes concurrent reuse of the same refresh token
-- deterministic: only one caller can replace the stored hash.
create or replace function public.rotate_auth_session(
  p_session_id uuid,
  p_old_refresh_token_hash text,
  p_new_refresh_token_hash text,
  p_used_at timestamptz
)
returns table (
  session_id uuid,
  user_id uuid,
  expires_at timestamptz,
  rotation_counter bigint
)
language sql
security invoker
set search_path = public
as $$
  update public.auth_sessions as session
  set refresh_token_hash = p_new_refresh_token_hash,
      last_used_at = p_used_at,
      rotation_counter = session.rotation_counter + 1
  from public.users as app_user
  where session.id = p_session_id
    and session.user_id = app_user.id
    and session.refresh_token_hash = p_old_refresh_token_hash
    and session.revoked_at is null
    and session.expires_at > p_used_at
    and app_user.is_active = true
    and app_user.is_verified = true
    and app_user.is_deleted = false
  returning
    session.id,
    session.user_id,
    session.expires_at,
    session.rotation_counter;
$$;

revoke all on function public.rotate_auth_session(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.rotate_auth_session(uuid, text, text, timestamptz)
  to service_role;

comment on table public.auth_sessions is
  'Backend-only refresh sessions. refresh_token_hash stores SHA-256 only; raw tokens live in HttpOnly cookies.';
comment on function public.rotate_auth_session(uuid, text, text, timestamptz) is
  'Atomically rotates one active refresh token and rejects replay/concurrent reuse.';

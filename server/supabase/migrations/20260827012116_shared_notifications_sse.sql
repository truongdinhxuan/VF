-- Phase 11: shared persistent notifications for the backend-authenticated SSE
-- transport. Browser roles never access these tables directly; Fastify owns
-- authentication, recipient scope, reads and mark-read mutations.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  type text not null,
  title text not null,
  message text not null,
  entity_type text not null,
  entity_id uuid not null,
  area_id uuid references public.areas(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  event_key text not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_domain_not_blank check (btrim(domain) <> ''),
  constraint notifications_type_not_blank check (btrim(type) <> ''),
  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint notifications_event_key_not_blank check (btrim(event_key) <> ''),
  constraint notifications_event_key_key unique (event_key)
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null
    references public.notifications(id) on delete restrict,
  user_id uuid not null
    references public.users(id) on delete restrict,
  is_read boolean not null default false,
  read_at timestamptz,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_recipients_notification_user_key
    unique (notification_id, user_id),
  constraint notification_recipients_read_state_check check (
    (is_read = false and read_at is null)
    or (is_read = true and read_at is not null)
  )
);

create index if not exists notifications_created_at_idx
  on public.notifications(created_at desc, id desc);
create index if not exists notifications_domain_created_at_idx
  on public.notifications(domain, created_at desc, id desc);
create index if not exists notifications_entity_idx
  on public.notifications(entity_type, entity_id);

create index if not exists notification_recipients_user_created_idx
  on public.notification_recipients(user_id, created_at desc, id desc)
  where is_deleted = false;
create index if not exists notification_recipients_user_unread_idx
  on public.notification_recipients(user_id, created_at desc, id desc)
  where is_deleted = false and is_active = true and is_read = false;
create index if not exists notification_recipients_notification_idx
  on public.notification_recipients(notification_id);

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists notification_recipients_set_updated_at
  on public.notification_recipients;
create trigger notification_recipients_set_updated_at
before update on public.notification_recipients
for each row execute function public.set_updated_at();

create or replace function public.persist_notification_with_recipients(
  p_domain text,
  p_type text,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid,
  p_area_id uuid,
  p_created_by uuid,
  p_event_key text,
  p_recipient_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  if nullif(btrim(p_domain), '') is null
     or nullif(btrim(p_type), '') is null
     or nullif(btrim(p_title), '') is null
     or nullif(btrim(p_entity_type), '') is null
     or nullif(btrim(p_event_key), '') is null then
    raise exception using message = 'NOTIFICATION_REQUIRED_FIELD_MISSING';
  end if;

  insert into public.notifications (
    domain,
    type,
    title,
    message,
    entity_type,
    entity_id,
    area_id,
    created_by,
    event_key
  )
  values (
    btrim(p_domain),
    btrim(p_type),
    btrim(p_title),
    coalesce(p_message, ''),
    btrim(p_entity_type),
    p_entity_id,
    p_area_id,
    p_created_by,
    btrim(p_event_key)
  )
  on conflict (event_key) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    select notification.id
    into v_notification_id
    from public.notifications notification
    where notification.event_key = btrim(p_event_key);
  end if;

  insert into public.notification_recipients (
    notification_id,
    user_id
  )
  select
    v_notification_id,
    recipient.user_id
  from (
    select distinct unnest(coalesce(p_recipient_ids, array[]::uuid[])) as user_id
  ) recipient
  join public.users app_user
    on app_user.id = recipient.user_id
   and app_user.is_active = true
   and app_user.is_verified = true
   and app_user.is_deleted = false
  where recipient.user_id <> p_created_by
  on conflict (notification_id, user_id) do nothing;

  return v_notification_id;
end;
$$;

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

revoke all on table public.notifications
  from public, anon, authenticated, service_role;
revoke all on table public.notification_recipients
  from public, anon, authenticated, service_role;

grant select, insert on table public.notifications to service_role;
grant select, insert, update on table public.notification_recipients
  to service_role;

revoke all on function public.persist_notification_with_recipients(
  text, text, text, text, text, uuid, uuid, uuid, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.persist_notification_with_recipients(
  text, text, text, text, text, uuid, uuid, uuid, text, uuid[]
) to service_role;

comment on table public.notifications is
  'Immutable shared notification content. Per-user read state lives in notification_recipients.';
comment on table public.notification_recipients is
  'Recipient-specific persistent unread/read state. Browser access is through authenticated Fastify APIs.';
comment on function public.persist_notification_with_recipients(
  text, text, text, text, text, uuid, uuid, uuid, text, uuid[]
) is
  'Atomically persists one idempotent notification master row and unique active recipient rows.';

commit;

-- Atomic Supply creation/update together with its Provider relationships.
-- Depends on 202608050001_provider_foundation.sql.

begin;

create or replace function public.create_supply_with_providers(
  p_code text,
  p_short_text text,
  p_translation_text text,
  p_description text,
  p_category_id uuid,
  p_unit_id uuid,
  p_min_stock numeric,
  p_max_stock numeric,
  p_safety_stock numeric,
  p_image_url text,
  p_is_active boolean,
  p_provider_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supply_id uuid;
  v_provider_ids uuid[];
begin
  select array_agg(distinct candidate order by candidate)
  into v_provider_ids
  from unnest(p_provider_ids) as candidate
  where candidate is not null;

  if coalesce(cardinality(v_provider_ids), 0) = 0 then
    raise exception 'provider_ids must contain at least one Provider';
  end if;

  if (
    select count(*)
    from public.providers p
    where p.id = any(v_provider_ids)
      and p.is_active = true
      and p.is_deleted = false
  ) <> cardinality(v_provider_ids) then
    raise exception 'provider_ids contains a missing, inactive, or deleted Provider';
  end if;

  insert into public.supplies (
    code,
    short_text,
    translation_text,
    description,
    category_id,
    unit_id,
    min_stock,
    max_stock,
    safety_stock,
    image_url,
    is_active,
    is_deleted
  )
  values (
    p_code,
    p_short_text,
    p_translation_text,
    p_description,
    p_category_id,
    p_unit_id,
    coalesce(p_min_stock, 0),
    p_max_stock,
    p_safety_stock,
    p_image_url,
    coalesce(p_is_active, true),
    false
  )
  returning id into v_supply_id;

  -- Phase 2's compatibility trigger inserts UNKNOW after Supply creation.
  -- Keep it only when explicitly selected; otherwise retire that relation in
  -- this same transaction before activating the requested Providers.
  update public.supply_providers
  set is_active = false, is_deleted = true
  where supply_id = v_supply_id
    and not (provider_id = any(v_provider_ids));

  insert into public.supply_providers (
    supply_id,
    provider_id,
    is_active,
    is_deleted
  )
  select v_supply_id, provider_id, true, false
  from unnest(v_provider_ids) as provider_id
  on conflict (supply_id, provider_id) do update
  set is_active = true, is_deleted = false;

  return v_supply_id;
end;
$$;

revoke all on function public.create_supply_with_providers(
  text, text, text, text, uuid, uuid, numeric, numeric, numeric, text,
  boolean, uuid[]
)
from public, anon, authenticated;

grant execute on function public.create_supply_with_providers(
  text, text, text, text, uuid, uuid, numeric, numeric, numeric, text,
  boolean, uuid[]
)
to service_role;

create or replace function public.update_supply_with_providers(
  p_supply_id uuid,
  p_patch jsonb,
  p_provider_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_provider_ids uuid[];
begin
  if jsonb_typeof(v_patch) <> 'object' then
    raise exception 'p_patch must be a JSON object';
  end if;

  select array_agg(distinct candidate order by candidate)
  into v_provider_ids
  from unnest(p_provider_ids) as candidate
  where candidate is not null;

  if coalesce(cardinality(v_provider_ids), 0) = 0 then
    raise exception 'provider_ids must contain at least one Provider';
  end if;

  if (
    select count(*)
    from public.providers p
    where p.id = any(v_provider_ids)
      and p.is_active = true
      and p.is_deleted = false
  ) <> cardinality(v_provider_ids) then
    raise exception 'provider_ids contains a missing, inactive, or deleted Provider';
  end if;

  perform 1
  from public.supplies
  where id = p_supply_id
    and is_deleted = false
  for update;

  if not found then
    raise exception 'Supply not found';
  end if;

  update public.supplies
  set
    code = case when v_patch ? 'code' then v_patch ->> 'code' else code end,
    short_text = case
      when v_patch ? 'short_text' then v_patch ->> 'short_text'
      else short_text
    end,
    translation_text = case
      when v_patch ? 'translation_text' then v_patch ->> 'translation_text'
      else translation_text
    end,
    description = case
      when v_patch ? 'description' then v_patch ->> 'description'
      else description
    end,
    category_id = case
      when v_patch ? 'category_id' then (v_patch ->> 'category_id')::uuid
      else category_id
    end,
    unit_id = case
      when v_patch ? 'unit_id' then (v_patch ->> 'unit_id')::uuid
      else unit_id
    end,
    min_stock = case
      when v_patch ? 'min_stock' then (v_patch ->> 'min_stock')::numeric
      else min_stock
    end,
    max_stock = case
      when v_patch ? 'max_stock' then (v_patch ->> 'max_stock')::numeric
      else max_stock
    end,
    safety_stock = case
      when v_patch ? 'safety_stock' then (v_patch ->> 'safety_stock')::numeric
      else safety_stock
    end,
    image_url = case
      when v_patch ? 'image_url' then v_patch ->> 'image_url'
      else image_url
    end,
    is_active = case
      when v_patch ? 'is_active' then (v_patch ->> 'is_active')::boolean
      else is_active
    end,
    is_deleted = case
      when v_patch ? 'is_active'
        and (v_patch ->> 'is_active')::boolean = true
        then false
      else is_deleted
    end
  where id = p_supply_id;

  -- Retain historical rows and composite foreign-key targets. Relations no
  -- longer selected by the Supply are soft-deleted, never hard-deleted.
  update public.supply_providers
  set is_active = false, is_deleted = true
  where supply_id = p_supply_id
    and not (provider_id = any(v_provider_ids));

  insert into public.supply_providers (
    supply_id,
    provider_id,
    is_active,
    is_deleted
  )
  select p_supply_id, provider_id, true, false
  from unnest(v_provider_ids) as provider_id
  on conflict (supply_id, provider_id) do update
  set is_active = true, is_deleted = false;

  return p_supply_id;
end;
$$;

revoke all on function public.update_supply_with_providers(uuid, jsonb, uuid[])
from public, anon, authenticated;

grant execute on function public.update_supply_with_providers(uuid, jsonb, uuid[])
to service_role;

commit;

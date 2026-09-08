-- The Users service intentionally creates accounts through a guarded RPC, but
-- profile updates/deactivation use direct service-role UPDATE statements.
-- Grant only mutable columns: no INSERT, DELETE or legacy role_id mutation.
grant update (
  email,
  first_name,
  last_name,
  vinfast_id,
  phone_number,
  avatar_url,
  area_id,
  managed_by_user_id,
  is_active,
  is_verified,
  is_deleted
) on table public.users to service_role;

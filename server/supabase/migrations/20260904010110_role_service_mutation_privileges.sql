begin;

-- Role CRUD is implemented by Fastify RolesService using supabaseAdmin.
-- The read-grant migration already covers SELECT. New Supabase installations
-- do not implicitly grant INSERT/UPDATE for tables in public.
-- DELETE /roles/:id is a soft delete (UPDATE), so DELETE is not needed.
-- Keep browser grants, policies and permission guards unchanged.
grant insert, update on table public.roles to service_role;

commit;

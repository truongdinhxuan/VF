begin;

-- Fastify resolves every request's effective permissions through these shared
-- RBAC tables. Keep them inaccessible to browser roles, but grant the backend
-- service role the explicit SELECT privileges required by current PostgREST.
grant select on table public.users to service_role;
grant select on table public.roles to service_role;
grant select on table public.user_roles to service_role;
grant select on table public.permissions to service_role;
grant select on table public.role_permissions to service_role;

-- Phase 5 Fastify services validate the allocation and compose relational
-- Order/Stock responses through PostgREST. Mutation remains restricted to the
-- SECURITY DEFINER RPCs; these are read privileges only.
grant select on table public.orders to service_role;
grant select on table public.order_items to service_role;
grant select on table public.order_item_allocations to service_role;
grant select on table public.inventory_discrepancies to service_role;
grant select on table public.order_statuses to service_role;
grant select on table public.order_revisions to service_role;
grant select on table public.order_revision_actions to service_role;
grant select on table public.stock_balances to service_role;
grant select on table public.stock_transactions to service_role;
grant select on table public.stock_transaction_types to service_role;
grant select on table public.supplies to service_role;
grant select on table public.supply_categories to service_role;
grant select on table public.units to service_role;
grant select on table public.providers to service_role;
grant select on table public.areas to service_role;
grant select on table public.storage_locations to service_role;

comment on table public.user_roles is
  'Backend-only User-to-Role mappings. Explicit service_role SELECT is required for Fastify authorization.';
comment on table public.role_permissions is
  'Backend-only Role-to-Permission mappings. Explicit service_role SELECT is required for Fastify authorization.';

commit;

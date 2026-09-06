begin;

-- Phase 4.0.1: preserve the current Fastify-authorized Cancel implementation.
-- OrderService.cancel uses supabaseAdmin and updates only these two columns.
-- Other Order business mutations use RPCs or have separate privilege needs;
-- this migration deliberately does not grant table-wide UPDATE/INSERT/DELETE.
-- The earlier read-grants comment describes the RPC paths, not every runtime
-- Order action. Application RBAC, ownership, status validation and CAS remain
-- the security boundary for this backend-only direct update.
grant update (status_id, cancel_reason) on table public.orders to service_role;

commit;

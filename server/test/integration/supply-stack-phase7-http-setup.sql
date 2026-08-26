-- LOCAL/DISPOSABLE DATABASE ONLY.
-- The running application resolves the Order source by the business code VTDG.
-- Phase 6 concurrency fixtures use this same area under a test-only code, so
-- normalize it before exercising POST /orders through Fastify.

update public.areas
set code = 'VTDG',
    name = 'Vật tư đóng gói',
    is_active = true,
    is_deleted = false
where id = '66000000-0000-4000-8000-000000000001';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read('supabase/migrations/20260826084454_shared_work_shifts.sql');
const service = read('src/services/work-shifts.service.ts');
const routes = [
  read('src/routes/shared/work-shifts/index.ts'),
  read('src/routes/shared/user-work-shift-assignments/index.ts'),
].join('\n');

describe('Phase 8 shared work-shift foundation', () => {
  it('creates shared tables and exact idempotent system-shift seeds', () => {
    assert.match(migration, /create table public\.work_shifts/i);
    assert.match(migration, /create table public\.user_work_shift_assignments/i);
    for (const seed of [
      "('S1', 'Ca 1', time '06:00', time '14:00', false",
      "('S2', 'Ca 2', time '14:00', time '22:00', false",
      "('S3', 'Ca 3', time '22:00', time '06:00', true",
      "('S6', 'Ca 6', time '06:00', time '18:00', false",
      "('S7', 'Ca 7', time '18:00', time '06:00', true",
      "('HC', 'Hành chính', time '08:00', time '17:00', false",
    ]) assert.ok(migration.includes(seed), `${seed} must be seeded`);
    assert.match(migration, /on conflict \(code\) do update/i);
  });

  it('preserves temporal history and enforces one current assignment', () => {
    assert.match(migration, /effective_to is null or effective_to > effective_from/i);
    assert.match(
      migration,
      /create unique index user_work_shift_assignments_one_active_idx[\s\S]*where is_active = true and is_deleted = false/i,
    );
    assert.match(migration, /set effective_to = p_effective_from,[\s\S]*is_active = false/i);
    assert.match(migration, /insert into public\.user_work_shift_assignments/i);
    assert.doesNotMatch(migration, /delete from public\.user_work_shift_assignments/i);
  });

  it('uses one backend-only atomic RPC guarded by user-management permission', () => {
    assert.match(migration, /create or replace function public\.assign_user_work_shift/i);
    assert.match(migration, /public\.has_permission\(p_actor_id, 'admin\.user\.update'\)/i);
    assert.match(migration, /for update of u/i);
    assert.match(migration, /for update of assignment/i);
    assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
    assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
  });

  it('keeps API authorization permission-based and exposes no shift master mutation', () => {
    assert.match(routes, /ADMIN_USER_READ/);
    assert.match(routes, /ADMIN_USER_UPDATE/);
    assert.doesNotMatch(routes, /role\s*===|role\.includes|verifyTokenAndRole/);
    assert.doesNotMatch(routes, /fastify\.(?:post|patch|delete)\([\s\S]*work-shifts/);
  });

  it('loads relations in one query and does not infer a shift from clock time', () => {
    assert.match(service, /work_shift:work_shifts!/);
    assert.match(service, /assigned_by_user:users!/);
    assert.doesNotMatch(service, /getHours|hour\s*[<>=]|S1|S2|S3|S6|S7|HC/);
  });

  it('does not introduce Phase 9 or realtime objects', () => {
    assert.doesNotMatch(migration, /supply_shift_order_sheets|shift_order_sheet_id/i);
    assert.doesNotMatch(migration, /notification_recipients|websocket|realtime/i);
  });
});

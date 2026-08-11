import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/202608110001_dynamic_rbac_foundation.sql',
  ),
  'utf8',
);

const expectedPermissionCodes = [
  'admin.user.read',
  'admin.user.create',
  'admin.user.update',
  'admin.role.read',
  'admin.role.create',
  'admin.role.update',
  'admin.role.assign_permission',
  'admin.user.assign_role',
  'milkrun.trip.read_own',
  'milkrun.trip.read_all',
  'milkrun.trip.create',
  'milkrun.trip.start',
  'milkrun.trip.arrive',
  'milkrun.trip.complete',
  'milkrun.rack.read',
  'milkrun.rack.create',
  'milkrun.rack.update',
  'milkrun.stock.read',
  'milkrun.stock.adjust',
  'milkrun.vehicle.read',
  'milkrun.vehicle.assign',
  'milkrun.dashboard.read',
  'supply.stock.read',
  'supply.stock.adjust',
  'supply.order.create',
  'supply.order.approve',
  'supply.dashboard.read',
] as const;

describe('dynamic RBAC database migration', () => {
  it('creates the shared permission and N-N mapping tables', () => {
    assert.match(migration, /create table public\.permissions\s*\(/i);
    assert.match(migration, /create table public\.role_permissions\s*\(/i);
    assert.match(migration, /create table public\.user_roles\s*\(/i);

    assert.match(
      migration,
      /constraint permissions_code_key unique \(code\)/i,
    );
    assert.match(
      migration,
      /constraint role_permissions_role_permission_key[\s\S]*?unique \(role_id, permission_id\)/i,
    );
    assert.match(
      migration,
      /constraint user_roles_user_role_key unique \(user_id, role_id\)/i,
    );
  });

  it('uses the required foreign keys and lookup indexes', () => {
    for (const constraint of [
      'role_permissions_role_id_fkey',
      'role_permissions_permission_id_fkey',
      'user_roles_user_id_fkey',
      'user_roles_role_id_fkey',
    ]) {
      assert.match(migration, new RegExp(`constraint ${constraint}`, 'i'));
    }

    for (const index of [
      'roles_name_key',
      'role_permissions_role_id_idx',
      'role_permissions_permission_id_idx',
      'user_roles_user_id_idx',
      'user_roles_role_id_idx',
    ]) {
      assert.match(migration, new RegExp(`(?:unique )?index(?: if not exists)? ${index}`, 'i'));
    }
  });

  it('seeds exactly the permission codes from PermissionsCatalog', () => {
    for (const code of expectedPermissionCodes) {
      assert.match(migration, new RegExp(`'${code.replaceAll('.', '\\.')}'`));
    }

    const catalogBlock = migration.match(
      /insert into public\.permissions[\s\S]*?on conflict \(code\) do update/i,
    )?.[0];
    assert.ok(catalogBlock, 'permission catalog seed must exist');
    const seededCodes = [...catalogBlock.matchAll(/\('([^']+)',/g)]
      .map((match) => match[1]);
    assert.deepEqual(seededCodes, expectedPermissionCodes);
  });

  it('migrates and verifies users.role_id without dropping it', () => {
    assert.match(
      migration,
      /insert into public\.user_roles[\s\S]*?from public\.users u[\s\S]*?where u\.role_id is not null/i,
    );
    assert.match(
      migration,
      /users\.role_id backfill verification failed/i,
    );
    assert.doesNotMatch(
      migration,
      /alter table public\.users\s+drop column(?: if exists)?\s+role_id/i,
    );
    assert.match(migration, /users_sync_legacy_user_role/i);
  });

  it('protects ADMIN and prevents the last usable admin from being removed', () => {
    assert.match(migration, /protect_admin_system_role/i);
    assert.match(migration, /old\.code = 'ADMIN'/i);
    assert.match(migration, /protect_last_legacy_admin_user/i);
    assert.match(migration, /protect_last_admin_user_role/i);
    assert.match(
      migration,
      /The final active verified ADMIN user cannot be removed or disabled/i,
    );
  });

  it('keeps new RBAC tables server-only through RLS and grants', () => {
    for (const table of ['permissions', 'role_permissions', 'user_roles']) {
      assert.match(
        migration,
        new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      );
      assert.match(
        migration,
        new RegExp(`grant select, insert, update, delete on table public\\.${table}[\\s\\S]*?to service_role`, 'i'),
      );
    }
  });

  it('does not implement Milkrun, recreate positions, or rename Supply tables', () => {
    assert.doesNotMatch(migration, /create schema\s+milkrun/i);
    assert.doesNotMatch(migration, /create table\s+(?:public\.)?positions/i);
    assert.doesNotMatch(migration, /create type\s+/i);
    assert.doesNotMatch(migration, /alter table\s+public\.[a-z_]+\s+rename\s+to/i);
    assert.doesNotMatch(migration, /\b(?:drop|truncate)\s+table\b/i);
    assert.doesNotMatch(
      migration,
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    );
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const routes = read('src/routes/users/index.ts');
const service = read('src/services/users.service.ts');
const schema = read('src/schemas/users.ts');
const internalAuthMigration = read(
  'supabase/migrations/202607300001_internal_password_auth.sql',
);

describe('Phase 4 users CRUD contract', () => {
  it('registers canonical root User CRUD without a duplicate PUT route', () => {
    assert.equal((routes.match(/fastify\.get\(/g) ?? []).length, 2);
    assert.equal((routes.match(/fastify\.post\(/g) ?? []).length, 1);
    assert.equal((routes.match(/fastify\.patch\(/g) ?? []).length, 2);
    assert.equal((routes.match(/fastify\.delete\(/g) ?? []).length, 1);
    assert.doesNotMatch(routes, /fastify\.put\(/);
  });

  it('creates the profile and internal credential atomically without Supabase Auth', () => {
    assert.match(service, /\.rpc\(\s*'create_internal_user'/);
    assert.match(internalAuthMigration, /insert into public\.users/i);
    assert.match(internalAuthMigration, /insert into public\.user_credentials/i);
    assert.doesNotMatch(service, /auth\.admin|supabase\.auth/);
  });

  it('expands role and area in list/detail projections without Position', () => {
    assert.match(service, /role:roles!users_role_id_fkey/);
    assert.match(service, /area:areas!users_area_id_fkey/);
    assert.doesNotMatch(service, /position_id|positions!/);
  });

  it('validates unique email/VinFast ID and every requested foreign key', () => {
    assert.match(service, /Email đã tồn tại/);
    assert.match(service, /VinFast ID đã tồn tại/);
    assert.match(service, /assertConfiguredRole/);
    assert.match(service, /assertArea/);
    assert.match(service, /assertManager/);
  });

  it('creates managed users inactive from internal access until verified', () => {
    assert.doesNotMatch(
      schema.match(/export const createUserSchema[\s\S]*?export const updateUserSchema/)?.[0] ?? '',
      /is_verified:\s*\{ type: 'boolean' \}/,
    );
    assert.match(
      internalAuthMigration,
      /is_verified,[\s\S]*is_active,[\s\S]*is_deleted[\s\S]*false,[\s\S]*true,[\s\S]*false/i,
    );
  });

  it('deactivates the public profile instead of deleting Auth or profile data', () => {
    const deactivateBlock = service.match(/async deactivate\([\s\S]*?\n  \}/)?.[0] ?? '';
    assert.match(
      deactivateBlock,
      /update\(\{ is_active: false, is_deleted: true \}\)/,
    );
    assert.doesNotMatch(deactivateBlock, /deleteUser|\.delete\(/);
  });
});

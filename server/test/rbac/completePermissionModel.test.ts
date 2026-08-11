import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { PERMISSION_CODE } from '../../src/domain/permission-codes';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/202608110002_complete_permission_model_and_rpc_authorization.sql');

describe('Phase 3 complete permission model', () => {
  it('adds the catalog CRUD and order issue capabilities', () => {
    assert.equal(PERMISSION_CODE.SUPPLY_CATALOG_READ, 'supply.catalog.read');
    assert.equal(PERMISSION_CODE.SUPPLY_CATALOG_CREATE, 'supply.catalog.create');
    assert.equal(PERMISSION_CODE.SUPPLY_CATALOG_UPDATE, 'supply.catalog.update');
    assert.equal(PERMISSION_CODE.SUPPLY_CATALOG_DELETE, 'supply.catalog.delete');
    assert.equal(PERMISSION_CODE.SUPPLY_ORDER_ISSUE, 'supply.order.issue');
  });

  it('defines a hardened database permission resolver', () => {
    assert.match(migration, /create or replace function public\.has_permission/);
    assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/);
    assert.match(migration, /u\.is_verified = true/);
    assert.match(migration, /r\.code = 'ADMIN'[\s\S]*r\.is_system = true/);
    assert.match(migration, /p\.code = p_permission_code/);
    assert.match(migration, /revoke all on function public\.has_permission[\s\S]*from public, anon, authenticated/);
  });

  it('replaces active RPC guards with the documented permissions', () => {
    assert.match(migration, /has_permission\(p_actor_id, 'supply\.order\.approve'\)/);
    assert.match(migration, /has_permission\(p_actor_id, 'supply\.order\.issue'\)/);
    assert.match(migration, /has_permission\(p_created_by, 'supply\.stock\.adjust'\)/);
    assert.match(migration, /review_order authorization block not found/);
    assert.match(migration, /issue_order authorization block not found/);
    assert.match(migration, /apply_stock_adjustment_v3 authorization block not found/);
  });

  it('keeps mapping replacement atomic and server-only', () => {
    assert.match(migration, /create or replace function public\.replace_role_permissions/);
    assert.match(migration, /create or replace function public\.replace_user_roles/);
    assert.match(migration, /create or replace function public\.create_internal_user_with_roles/);
    assert.match(migration, /grant execute on function public\.replace_role_permissions[\s\S]*to service_role/);
    assert.match(migration, /grant execute on function public\.replace_user_roles[\s\S]*to service_role/);
  });

  it('verifies a custom role add/remove cycle without retaining test data', () => {
    assert.match(migration, /CUSTOM_SUPPLY_OPERATOR_PHASE3_TEST/);
    assert.match(migration, /if not public\.has_permission\(v_user_id, 'supply\.order\.issue'\)/);
    assert.match(migration, /if public\.has_permission\(v_user_id, 'supply\.order\.issue'\)/);
    assert.match(migration, /__RBAC_PHASE3_TEST_ROLLBACK__/);
  });

  it('uses only catalog permissions for catalog mutations', () => {
    const routes = [
      'areas', 'providers', 'supplies', 'supply-categories', 'units', 'storage-locations',
    ].map((name) => read(`src/routes/${name}/index.ts`)).join('\n');
    assert.doesNotMatch(routes, /SUPPLY_STOCK_ADJUST/);
    assert.match(routes, /SUPPLY_CATALOG_CREATE/);
    assert.match(routes, /SUPPLY_CATALOG_UPDATE/);
    assert.match(routes, /SUPPLY_CATALOG_DELETE/);
  });
});

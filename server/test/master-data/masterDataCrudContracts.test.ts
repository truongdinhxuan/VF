import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  canManageMasterData,
  canManageSystem,
} from '../../src/domain/permissions';
import {
  databaseError,
  MasterDataServiceError,
} from '../../src/services/master-data.helpers';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const routeFiles = {
  roles: read('src/routes/roles/index.ts'),
  positions: read('src/routes/positions/index.ts'),
  areas: read('src/routes/areas/index.ts'),
  categories: read('src/routes/supply-categories/index.ts'),
  units: read('src/routes/units/index.ts'),
  supplies: read('src/routes/supplies/index.ts'),
  locations: read('src/routes/storage-locations/index.ts'),
};

describe('master data CRUD contracts', () => {
  it('registers exactly one CRUD surface for every requested module', () => {
    for (const [feature, source] of Object.entries(routeFiles)) {
      assert.equal((source.match(/fastify\.get\(/g) ?? []).length, 2, `${feature} GET routes`);
      assert.equal((source.match(/fastify\.post\(/g) ?? []).length, 1, `${feature} POST route`);
      assert.equal((source.match(/fastify\.patch\(/g) ?? []).length, 1, `${feature} PATCH route`);
      assert.equal((source.match(/fastify\.delete\(/g) ?? []).length, 1, `${feature} DELETE route`);
    }
  });

  it('keeps system and catalog mutation permissions separated', () => {
    assert.equal(canManageSystem('Admin'), true);
    assert.equal(canManageSystem('data Vật tư'), false);
    assert.equal(canManageMasterData('Admin'), true);
    assert.equal(canManageMasterData('data Vật tư'), true);
    assert.equal(canManageMasterData('Tổ trưởng vật tư'), true);
    assert.equal(canManageMasterData('Material Control'), false);
  });

  it('maps unique constraint failures to a stable HTTP 409 error', () => {
    assert.throws(
      () => databaseError({ code: '23505' }, 'code đã tồn tại'),
      (error: unknown) =>
        error instanceof MasterDataServiceError
        && error.statusCode === 409
        && error.message === 'code đã tồn tại',
    );
  });

  it('soft-deletes/deactivates models that have lifecycle fields', () => {
    const areas = read('src/services/areas.service.ts');
    const categories = read('src/services/supply-categories.service.ts');
    const units = read('src/services/units.service.ts');
    const supplies = read('src/services/supplies.service.ts');
    const locations = read('src/services/storage-locations.service.ts');

    for (const source of [areas, locations]) {
      assert.match(source, /update\(\{ is_active: false \}\)/);
    }
    for (const source of [categories, units, supplies]) {
      assert.match(source, /update\(\{ is_active: false, is_deleted: true \}\)/);
    }
  });

  it('only hard-deletes Role and Position after checking user references', () => {
    const roles = read('src/services/roles.service.ts');
    const positions = read('src/services/positions.service.ts');
    assert.match(roles, /from\('users'\)[\s\S]*?\.eq\('role_id', id\)/);
    assert.match(positions, /from\('users'\)[\s\S]*?\.eq\('position_id', id\)/);
  });

  it('validates active supply foreign keys and protects used codes/locations', () => {
    const supplies = read('src/services/supplies.service.ts');
    const locations = read('src/services/storage-locations.service.ts');
    assert.match(supplies, /assertActiveReference\('supply_categories'/);
    assert.match(supplies, /assertActiveReference\('units'/);
    assert.match(supplies, /Không thể đổi code của vật tư đã có tồn kho/);
    assert.match(locations, /assertActiveArea/);
    assert.match(locations, /Không thể đổi area của vị trí đã có tồn kho/);
  });
});

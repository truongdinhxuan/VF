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
  areas: read('src/routes/areas/index.ts'),
  categories: read('src/routes/supply-categories/index.ts'),
  units: read('src/routes/units/index.ts'),
  supplies: read('src/routes/supplies/index.ts'),
  locations: read('src/routes/storage-locations/index.ts'),
};

describe('master data CRUD contracts', () => {
  it('registers exactly one CRUD surface for every requested module', () => {
    for (const [feature, source] of Object.entries(routeFiles)) {
      const expectedGetRoutes = feature === 'supplies' ? 3 : 2;
      assert.equal(
        (source.match(/fastify\.get\(/g) ?? []).length,
        expectedGetRoutes,
        `${feature} GET routes`,
      );
      assert.equal((source.match(/fastify\.post\(/g) ?? []).length, 1, `${feature} POST route`);
      assert.equal((source.match(/fastify\.patch\(/g) ?? []).length, 1, `${feature} PATCH route`);
      assert.equal((source.match(/fastify\.delete\(/g) ?? []).length, 1, `${feature} DELETE route`);
    }
  });

  it('keeps system and catalog mutation permissions separated', () => {
    assert.equal(canManageSystem('ADMIN'), true);
    assert.equal(canManageSystem('DATA_MATERIAL'), false);
    assert.equal(canManageMasterData('ADMIN'), true);
    assert.equal(canManageMasterData('DATA_MATERIAL'), true);
    assert.equal(canManageMasterData('MATERIAL_LEADER'), true);
    assert.equal(canManageMasterData('MATERIAL_CONTROL'), false);
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

    for (const source of [areas, categories, units, supplies, locations]) {
      assert.match(source, /update\(\{ is_active: false, is_deleted: true \}\)/);
    }
  });

  it('protects system roles and removes Position from the application', () => {
    const roles = read('src/services/roles.service.ts');
    assert.match(roles, /role\.is_system/);
    assert.doesNotMatch(read('src/interfaces/users.ts'), /position_id/);
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

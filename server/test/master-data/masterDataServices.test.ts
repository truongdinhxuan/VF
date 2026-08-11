import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { MasterDataServiceError } from '../../src/services/master-data.helpers';
import {
  normalizeSearchQuery,
  parseActiveFilter,
} from '../../src/services/master-data.helpers';

describe('catalog query validation', () => {
  it('defaults supplies to active and accepts an explicit boolean filter', () => {
    assert.equal(parseActiveFilter(undefined), true);
    assert.equal(parseActiveFilter('true'), true);
    assert.equal(parseActiveFilter('false'), false);
    assert.equal(parseActiveFilter(false), false);
  });

  it('rejects an invalid is_active value with HTTP 400 semantics', () => {
    assert.throws(
      () => parseActiveFilter('yes'),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 400,
    );
  });

  it('normalizes q and blocks PostgREST OR syntax characters', () => {
    assert.equal(normalizeSearchQuery(undefined), null);
    assert.equal(normalizeSearchQuery('   '), null);
    assert.equal(normalizeSearchQuery('  VT31  '), 'VT31');
    assert.throws(() => normalizeSearchQuery('code,name'));
  });
});

describe('master data read contracts', () => {
  const suppliesService = readFileSync(
    resolve(process.cwd(), 'src/services/supplies.service.ts'),
    'utf8',
  );
  const areasService = readFileSync(
    resolve(process.cwd(), 'src/services/areas.service.ts'),
    'utf8',
  );
  const storageLocationsService = readFileSync(
    resolve(process.cwd(), 'src/services/storage-locations.service.ts'),
    'utf8',
  );
  const supplyRoute = readFileSync(
    resolve(process.cwd(), 'src/routes/supplies/index.ts'),
    'utf8',
  );
  const areaRoute = readFileSync(
    resolve(process.cwd(), 'src/routes/areas/index.ts'),
    'utf8',
  );
  const storageRoute = readFileSync(
    resolve(process.cwd(), 'src/routes/storage-locations/index.ts'),
    'utf8',
  );

  it('excludes soft-deleted supplies and defaults active records', () => {
    assert.match(suppliesService, /\.eq\('is_active', isActive\)/);
    assert.match(suppliesService, /parseActiveFilter\(query\.isDeleted, false\)/);
    assert.match(suppliesService, /\.eq\('is_deleted', isDeleted\)/);
  });

  it('returns only workbook fields and limits packing supply fields', () => {
    assert.match(
      suppliesService,
      /id, code, short_text, translation_text, description,[\s\S]*category_id, unit_id, is_active, is_deleted/,
    );
    assert.match(suppliesService, /category:supply_categories/);
    assert.match(suppliesService, /unit:units/);
    assert.doesNotMatch(suppliesService, /stock_balances\(\*\)/);
    assert.doesNotMatch(suppliesService, /translator_text/);
  });

  it('scopes areas and storage locations to active records', () => {
    assert.match(areasService, /from\('areas'\)[\s\S]*?\.eq\('is_active', active\)/);
    assert.match(
      storageLocationsService,
      /from\('storage_locations'\)[\s\S]*?\.eq\('is_active', active\)/,
    );
    assert.match(storageLocationsService, /request = request\.eq\('area_id', areaId\)/);
  });

  it('protects read routes using permission codes', () => {
    assert.match(supplyRoute, /requirePermission\(/);
    assert.match(supplyRoute, /PERMISSION_CODE\.SUPPLY_CATALOG_READ/);
    assert.match(areaRoute, /requirePermission\(/);
    assert.match(storageRoute, /requirePermission\(PERMISSION_CODE\.SUPPLY_CATALOG_READ\)/);
    assert.doesNotMatch(
      [supplyRoute, areaRoute, storageRoute].join('\n'),
      /verifyTokenAndRole/,
    );
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  CatalogServiceError,
  normalizeSearchQuery,
  parseActiveFilter,
} from '../../src/services/catalog.service';

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
        error instanceof CatalogServiceError && error.statusCode === 400,
    );
  });

  it('normalizes q and blocks PostgREST OR syntax characters', () => {
    assert.equal(normalizeSearchQuery(undefined), null);
    assert.equal(normalizeSearchQuery('   '), null);
    assert.equal(normalizeSearchQuery('  VT31  '), 'VT31');
    assert.throws(() => normalizeSearchQuery('code,name'), /unsupported/);
  });
});

describe('catalog read contracts', () => {
  const serviceSource = readFileSync(
    resolve(process.cwd(), 'src/services/catalog.service.ts'),
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
    assert.match(serviceSource, /\.eq\('is_active', isActive\)/);
    assert.match(serviceSource, /\.eq\('is_deleted', false\)/);
  });

  it('returns only workbook fields and limits packing supply fields', () => {
    assert.match(
      serviceSource,
      /id, code, short_text, unit_id, is_active, is_deleted/,
    );
    assert.doesNotMatch(serviceSource, /stock_balances\(\*\)/);
  });

  it('scopes areas and storage locations to active records', () => {
    assert.match(serviceSource, /from\('areas'\)[\s\S]*?\.eq\('is_active', true\)/);
    assert.match(
      serviceSource,
      /from\('storage_locations'\)[\s\S]*?\.eq\('is_active', true\)/,
    );
    assert.match(serviceSource, /request = request\.eq\('area_id', areaId\)/);
  });

  it('protects routes using the four workbook roles', () => {
    assert.match(supplyRoute, /verifyTokenAndRole\(ROLE_NAMES\)/);
    assert.match(areaRoute, /verifyTokenAndRole\(ROLE_NAMES\)/);
    assert.match(storageRoute, /verifyTokenAndRole\(MATERIAL_ROLES\)/);
  });
});

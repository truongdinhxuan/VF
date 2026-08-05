import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
  canManageProviders,
  canViewProviders,
} from '../../src/domain/permissions';
import { PROVIDER_SORT_FIELDS } from '../../src/schemas/master-data';
import {
  DEFAULT_PROVIDER_CODE,
  normalizeProviderCode,
  ProvidersService,
} from '../../src/services/providers.service';
import { MasterDataServiceError } from '../../src/services/master-data.helpers';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

interface FakeResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface FakeWrite {
  operation: 'insert' | 'update';
  payload: unknown;
}

const fakeFastify = (results: FakeResult[]) => {
  const writes: FakeWrite[] = [];
  const db = {
    from: (_table: string) => {
      const builder = {
        select: (_columns?: string) => builder,
        eq: (_column: string, _value: unknown) => builder,
        insert: (payload: unknown) => {
          writes.push({ operation: 'insert', payload });
          return builder;
        },
        update: (payload: unknown) => {
          writes.push({ operation: 'update', payload });
          return builder;
        },
        single: async () => results.shift() ?? {
          data: null,
          error: { message: 'Missing fake result' },
        },
      };
      return builder;
    },
  };

  return {
    fastify: { supabaseAdmin: db } as unknown as FastifyInstance,
    writes,
  };
};

describe('Provider permissions and route contract', () => {
  it('allows all roles to read and excludes DATA_PACKING from mutations', () => {
    for (const role of [
      'ADMIN',
      'DATA_PACKING',
      'DATA_MATERIAL',
      'MATERIAL_LEADER',
      'MATERIAL_CONTROL',
    ] as const) {
      assert.equal(canViewProviders(role), true);
    }

    assert.equal(canManageProviders('ADMIN'), true);
    assert.equal(canManageProviders('DATA_MATERIAL'), true);
    assert.equal(canManageProviders('MATERIAL_LEADER'), true);
    assert.equal(canManageProviders('MATERIAL_CONTROL'), true);
    assert.equal(canManageProviders('DATA_PACKING'), false);
  });

  it('registers list, detail, create, update and deactivate without hard delete', () => {
    const route = read('src/routes/providers/index.ts');
    assert.equal((route.match(/fastify\.get\(/g) ?? []).length, 2);
    assert.equal((route.match(/fastify\.post\(/g) ?? []).length, 1);
    assert.equal((route.match(/fastify\.patch\(/g) ?? []).length, 2);
    assert.equal((route.match(/fastify\.delete\(/g) ?? []).length, 0);
    assert.match(route, /\/:id\/deactivate/);
    assert.match(route, /verifyTokenAndRole\(PROVIDER_VIEWER_ROLES\)/);
    assert.match(route, /verifyTokenAndRole\(PROVIDER_MANAGER_ROLES\)/);
  });
});

describe('Provider validation and persistence contract', () => {
  it('trims and uppercases Provider codes without an enum', () => {
    assert.equal(normalizeProviderCode('  abc-01  '), 'ABC-01');
    assert.equal(DEFAULT_PROVIDER_CODE, 'UNKNOW');
    assert.throws(
      () => normalizeProviderCode('   '),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 400,
    );
  });

  it('creates a normalized Provider and maps duplicate code to HTTP 409', async () => {
    const created = {
      id: 'provider-id',
      code: 'ABC',
      name: 'Nhà cung cấp ABC',
    };
    const success = fakeFastify([{ data: created, error: null }]);
    const result = await new ProvidersService(success.fastify).create({
      code: '  abc ',
      name: '  Nhà cung cấp ABC ',
      description: '  Mô tả ',
      is_active: true,
    });
    assert.equal(result, created);
    assert.deepEqual(success.writes[0], {
      operation: 'insert',
      payload: {
        code: 'ABC',
        name: 'Nhà cung cấp ABC',
        description: 'Mô tả',
        is_active: true,
        is_deleted: false,
      },
    });

    const duplicate = fakeFastify([{
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    }]);
    await assert.rejects(
      () => new ProvidersService(duplicate.fastify).create({
        code: 'ABC',
        name: 'Duplicate',
      }),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 409,
    );
  });

  it('updates normal Providers and soft-deactivates without deleting rows', async () => {
    const current = {
      id: 'provider-id',
      code: 'ABC',
      is_active: true,
      is_deleted: false,
    };
    const updated = { ...current, name: 'Tên mới' };
    const updateFake = fakeFastify([
      { data: current, error: null },
      { data: updated, error: null },
    ]);
    await new ProvidersService(updateFake.fastify).update('provider-id', {
      name: '  Tên mới ',
    });
    assert.deepEqual(updateFake.writes[0], {
      operation: 'update',
      payload: { name: 'Tên mới' },
    });

    const deactivated = { ...current, is_active: false, is_deleted: true };
    const deactivateFake = fakeFastify([
      { data: current, error: null },
      { data: deactivated, error: null },
    ]);
    await new ProvidersService(deactivateFake.fastify).deactivate('provider-id');
    assert.deepEqual(deactivateFake.writes[0], {
      operation: 'update',
      payload: { is_active: false, is_deleted: true },
    });
  });

  it('does not rename or deactivate Provider UNKNOW', async () => {
    const unknown = {
      id: 'unknown-id',
      code: DEFAULT_PROVIDER_CODE,
      is_active: true,
      is_deleted: false,
    };

    const renameFake = fakeFastify([{ data: unknown, error: null }]);
    await assert.rejects(
      () => new ProvidersService(renameFake.fastify).update('unknown-id', {
        code: 'OTHER',
      }),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 409,
    );

    const deactivateFake = fakeFastify([{ data: unknown, error: null }]);
    await assert.rejects(
      () => new ProvidersService(deactivateFake.fastify).deactivate('unknown-id'),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 409,
    );
  });
});

describe('Provider pagination contract', () => {
  it('uses the requested sort whitelist and server-side PostgREST pagination', () => {
    assert.deepEqual(PROVIDER_SORT_FIELDS, [
      'code',
      'name',
      'created_at',
      'updated_at',
      'is_active',
    ]);

    const service = read('src/services/providers.service.ts');
    assert.match(service, /select\(SELECT, \{ count: 'exact' \}\)/);
    assert.match(service, /request\.range\(/);
    assert.match(service, /code\.ilike/);
    assert.match(service, /name\.ilike/);
    assert.match(service, /description\.ilike/);
    assert.match(service, /parseActiveFilter\(query\.isActive, true\)/);
    assert.match(service, /parseActiveFilter\(query\.isDeleted, false\)/);
    assert.doesNotMatch(service, /\.slice\(/);
    assert.doesNotMatch(service, /\.delete\(/);
  });
});

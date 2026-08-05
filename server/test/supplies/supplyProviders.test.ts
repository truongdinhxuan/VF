import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { MasterDataServiceError } from '../../src/services/master-data.helpers';
import {
  normalizeProviderIds,
  normalizeSupplyProviders,
} from '../../src/services/supplies.service';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const providerA = '11111111-1111-4111-8111-111111111111';
const providerB = '22222222-2222-4222-8222-222222222222';

describe('Supply Provider validation contract', () => {
  it('requires at least one Provider, validates UUIDs, and removes duplicates', () => {
    assert.deepEqual(
      normalizeProviderIds([providerA, providerA, providerB]),
      [providerA, providerB],
    );
    assert.throws(
      () => normalizeProviderIds([]),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 400,
    );
    assert.throws(
      () => normalizeProviderIds(['not-a-uuid']),
      (error: unknown) =>
        error instanceof MasterDataServiceError && error.statusCode === 400,
    );
  });

  it('requires provider_ids in both create and update schemas', () => {
    const schema = read('src/schemas/master-data.ts');
    assert.match(schema, /provider_ids:[\s\S]*type: 'array'[\s\S]*minItems: 1[\s\S]*items: uuid/);
    assert.match(schema, /'category_id', 'unit_id', 'provider_ids'/);
    assert.match(schema, /objectBody\(supplyProperties, \['provider_ids'\]\)/);
  });

  it('validates that every requested Provider is active and not deleted', () => {
    const service = read('src/services/supplies.service.ts');
    assert.match(service, /\.from\('providers'\)[\s\S]*\.in\('id', providerIds\)/);
    assert.match(service, /\.eq\('is_active', true\)/);
    assert.match(service, /\.eq\('is_deleted', false\)/);
    assert.match(service, /activeIds\.size !== providerIds\.length/);
  });
});

describe('Atomic Supply Provider persistence contract', () => {
  const migration = read('supabase/migrations/202608050002_supply_provider_rpc.sql');
  const service = read('src/services/supplies.service.ts');

  it('uses one database RPC for create and one for update', () => {
    assert.match(service, /rpc\(\s*'create_supply_with_providers'/);
    assert.match(service, /rpc\(\s*'update_supply_with_providers'/);
  });

  it('validates Providers again inside PostgreSQL and soft-syncs relations', () => {
    assert.match(migration, /create or replace function public\.create_supply_with_providers/);
    assert.match(migration, /create or replace function public\.update_supply_with_providers/);
    assert.match(migration, /p\.is_active = true[\s\S]*p\.is_deleted = false/);
    assert.match(
      migration,
      /update public\.supply_providers[\s\S]*set is_active = false, is_deleted = true/,
    );
    assert.match(
      migration,
      /on conflict \(supply_id, provider_id\) do update[\s\S]*is_active = true, is_deleted = false/,
    );
    assert.doesNotMatch(migration, /delete from public\.supply_providers/i);
  });

  it('does not retain automatic UNKNOW unless it was explicitly selected', () => {
    assert.match(migration, /not \(provider_id = any\(v_provider_ids\)\)/);
  });
});

describe('Supply Provider read contract', () => {
  it('flattens active relationship rows to a providers array', () => {
    const provider = {
      id: providerA,
      code: 'ABC',
      name: 'Provider ABC',
      description: null,
      is_active: true,
      is_deleted: false,
      created_at: '2026-08-05T00:00:00Z',
      updated_at: '2026-08-05T00:00:00Z',
    };
    const normalized = normalizeSupplyProviders({
      id: 'supply-id',
      provider_links: [
        { is_active: true, is_deleted: false, provider },
        { is_active: false, is_deleted: true, provider: { ...provider, id: providerB } },
      ],
    });
    assert.deepEqual(normalized, { id: 'supply-id', providers: [provider] });
  });

  it('selects Provider relations without an N+1 list query', () => {
    const service = read('src/services/supplies.service.ts');
    assert.match(service, /provider_links:supply_providers/);
    assert.match(service, /provider:providers/);
    assert.match(service, /items: result\.items\.map\(normalizeSupplyProviders\)/);
  });

  it('registers GET /supplies/:id/providers for all authenticated roles', () => {
    const route = read('src/routes/supplies/index.ts');
    assert.match(route, /'\/:id\/providers'/);
    assert.match(
      route,
      /'\/:id\/providers'[\s\S]*verifyTokenAndRole\(ROLE_CODES\)/,
    );
    assert.doesNotMatch(route, /supply-providers/);
  });
});

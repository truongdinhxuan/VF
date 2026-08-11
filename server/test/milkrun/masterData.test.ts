import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '../../src/plugins/dbContext';
import '../../src/plugins/jwt';
import {
  MILKRUN_STOCK_TRANSACTION_TYPE_CODE,
  MILKRUN_TRIP_STATUS_CODE,
  MILKRUN_TRIP_TYPE_CODE,
} from '../../src/domain/milkrun-codes';
import { requireSystemAdmin } from '../../src/middleware/auth';
import { normalizeMilkrunCode } from '../../src/services/milkrun-master-data.service';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/202608110004_milkrun_master_data.sql',
);

const replyRecorder = () => {
  const state: { statusCode?: number; payload?: unknown } = {};
  const reply = {
    code(statusCode: number) {
      state.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      state.payload = payload;
      return this;
    },
  } as unknown as FastifyReply;
  return { reply, state };
};

const requestFor = (isSystemAdmin: boolean) => ({
  method: 'POST',
  user: {
    sub: 'user-id',
    id: 'user-id',
    email: 'user@example.com',
    areaId: 'area-id',
    roleIds: ['role-id'],
    permissions: [],
    isSystemAdmin,
  },
}) as unknown as FastifyRequest;

describe('Phase 6 Milkrun master-data migration', () => {
  it('creates only the seven workbook master tables without database enum', () => {
    const tables = [
      'racks',
      'shops',
      'trip_types',
      'trip_statuses',
      'vehicles',
      'stock_transaction_types',
      'adjustment_reasons',
    ];
    for (const table of tables) {
      assert.match(migration, new RegExp(`create table milkrun\\.${table} \\(`, 'i'));
    }
    assert.equal((migration.match(/create table milkrun\./gi) ?? []).length, 7);
    assert.doesNotMatch(migration, /create type\s+/i);
    assert.doesNotMatch(migration, /\b(?:order_items|orders|supplies)\b/i);
  });

  it('uses unique codes, common lifecycle fields and updated_at triggers', () => {
    for (const table of [
      'racks',
      'shops',
      'trip_types',
      'trip_statuses',
      'vehicles',
      'stock_transaction_types',
      'adjustment_reasons',
    ]) {
      assert.match(migration, new RegExp(`${table}_code_key unique \\(code\\)`, 'i'));
      assert.match(migration, new RegExp(`${table}_set_updated_at`, 'i'));
    }
    assert.match(migration, /is_active boolean not null default true/i);
    assert.match(migration, /is_deleted boolean not null default false/i);
  });

  it('enforces one current vehicle per driver through a database constraint', () => {
    assert.match(migration, /constraint vehicles_driver_id_key unique \(driver_id\)/i);
    assert.match(
      migration,
      /constraint vehicles_driver_id_fkey[\s\S]*references public\.users\(id\)/i,
    );
  });

  it('seeds only the finalized Trip status codes and required lookup codes', () => {
    assert.deepEqual(Object.values(MILKRUN_TRIP_TYPE_CODE), [
      'RECEIVE_RACK',
      'RETURN_RACK',
    ]);
    assert.deepEqual(Object.values(MILKRUN_TRIP_STATUS_CODE), [
      'REGISTERED',
      'STARTED',
      'ARRIVED',
      'COMPLETED',
      'CANCELLED',
    ]);
    assert.deepEqual(Object.values(MILKRUN_STOCK_TRANSACTION_TYPE_CODE), [
      'IN',
      'OUT',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'REVERSAL_IN',
      'REVERSAL_OUT',
    ]);
    for (const code of [
      ...Object.values(MILKRUN_TRIP_TYPE_CODE),
      ...Object.values(MILKRUN_TRIP_STATUS_CODE),
      ...Object.values(MILKRUN_STOCK_TRANSACTION_TYPE_CODE),
    ]) {
      assert.match(migration, new RegExp(`'${code}'`));
    }
  });

  it('protects system codes and keeps the schema server-only', () => {
    assert.match(migration, /create or replace function milkrun\.protect_system_lookup/i);
    assert.match(migration, /new\.code is distinct from old\.code/i);
    assert.match(migration, /alter table milkrun\.racks enable row level security/i);
    assert.match(
      migration,
      /revoke all on all tables in schema milkrun[\s\S]*from public, anon, authenticated/i,
    );
    assert.match(
      migration,
      /grant select, insert, update, delete on all tables in schema milkrun[\s\S]*to service_role/i,
    );
  });
});

describe('Phase 6 Milkrun CRUD contract', () => {
  it('normalizes business codes without an enum', () => {
    assert.equal(normalizeMilkrunCode('  rack_01  '), 'RACK_01');
  });

  it('registers list/detail/create/update/deactivate for every master resource', () => {
    const routes = [
      'racks',
      'shops',
      'trip-types',
      'trip-statuses',
      'vehicles',
      'stock-transaction-types',
      'adjustment-reasons',
    ];
    for (const route of routes) {
      const source = read(`src/routes/milkrun/${route}/index.ts`);
      assert.equal((source.match(/fastify\.get\(/g) ?? []).length, 2);
      assert.equal((source.match(/fastify\.post\(/g) ?? []).length, 1);
      assert.equal((source.match(/fastify\.patch\(/g) ?? []).length, 2);
      assert.equal((source.match(/fastify\.delete\(/g) ?? []).length, 0);
      assert.match(source, /verifyToken/);
      assert.match(source, /requirePermission/);
      assert.doesNotMatch(source, /verifyTokenAndRole|role\s*===|role\.includes/);
    }
  });

  it('uses server-side pagination and active/non-deleted defaults', () => {
    const service = read('src/services/milkrun-master-data.service.ts');
    assert.match(service, /schema\('milkrun'\)/);
    assert.match(service, /select\(this\.definition\.select, \{ count: 'exact' \}\)/);
    assert.match(service, /request\.range\(/);
    assert.match(service, /parseActiveFilter\(query\.isActive, true\)/);
    assert.match(service, /parseActiveFilter\(query\.isDeleted, false\)/);
    assert.doesNotMatch(service, /\.slice\(/);
    assert.doesNotMatch(service, /\.delete\(/);
  });

  it('guards Rack and Vehicle routes with catalog permissions', () => {
    const racks = read('src/routes/milkrun/racks/index.ts');
    assert.match(racks, /MILKRUN_RACK_READ/);
    assert.match(racks, /MILKRUN_RACK_CREATE/);
    assert.match(racks, /MILKRUN_RACK_UPDATE/);

    const vehicles = read('src/routes/milkrun/vehicles/index.ts');
    assert.match(vehicles, /MILKRUN_VEHICLE_READ/);
    assert.match(vehicles, /MILKRUN_VEHICLE_ASSIGN/);
  });

  it('allows only the resolved system ADMIN context through the fallback guard', async () => {
    const denied = replyRecorder();
    await requireSystemAdmin(requestFor(false), denied.reply);
    assert.equal(denied.state.statusCode, 403);

    const allowed = replyRecorder();
    await requireSystemAdmin(requestFor(true), allowed.reply);
    assert.equal(allowed.state.statusCode, undefined);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '../../src/plugins/dbContext';
import '../../src/plugins/jwt';
import { PERMISSION_CODE } from '../../src/domain/permission-codes';
import { requirePermission } from '../../src/middleware/auth';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/202608110007_milkrun_stock_adjustment_vehicle_assignment.sql',
);
const stockRoutes = read('src/routes/milkrun/stock-adjustments/index.ts');
const balanceRoutes = read('src/routes/milkrun/stock-balances/index.ts');
const transactionRoutes = read('src/routes/milkrun/stock-transactions/index.ts');
const vehicleRoutes = read('src/routes/milkrun/vehicles/index.ts');
const vehicleService = read('src/services/milkrun-master-data.service.ts');
const userRoutes = read('src/routes/users/index.ts');

const requestFor = (permissions: string[]) => ({
  method: 'POST',
  user: {
    sub: 'user-id',
    id: 'user-id',
    email: 'user@example.com',
    areaId: 'area-id',
    roleIds: ['role-id'],
    permissions,
    isSystemAdmin: false,
  },
}) as unknown as FastifyRequest;

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

describe('Phase 9 Milkrun manual stock adjustment', () => {
  it('creates the workbook stock models, keys and no database enum', () => {
    assert.match(migration, /create table milkrun\.stock_balances \(/i);
    assert.match(migration, /create table milkrun\.stock_transactions \(/i);
    assert.match(
      migration,
      /constraint stock_balances_rack_area_key unique \(rack_id, area_id\)/i,
    );
    assert.match(migration, /stock_balances_quantity_check check \(quantity >= 0\)/i);
    assert.doesNotMatch(migration, /create type\s+/i);
  });

  it('requires an adjustment reason and keeps transactions immutable', () => {
    assert.match(
      migration,
      /stock_transactions_external_reason_check[\s\S]*trip_id is not null or adjustment_reason_id is not null/i,
    );
    assert.match(
      migration,
      /p_adjustment_reason_id is null or not exists/i,
    );
    assert.match(migration, /stock_transactions_prevent_update/i);
    assert.match(migration, /stock_transactions_prevent_delete/i);
    assert.match(migration, /create a REVERSAL transaction/i);
  });

  it('updates the locked balance and inserts its audit row in one RPC', () => {
    assert.match(migration, /create or replace function milkrun\.apply_stock_adjustment/i);
    assert.match(migration, /for update;/i);
    assert.match(migration, /update milkrun\.stock_balances/i);
    assert.match(migration, /insert into milkrun\.stock_transactions/i);
    assert.match(migration, /public\.has_permission\(p_actor_id, 'milkrun\.stock\.adjust'\)/i);
    assert.match(
      migration,
      /'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL_IN', 'REVERSAL_OUT'/i,
    );
  });

  it('exposes only read stock routes and the guarded create-adjustment route', () => {
    assert.match(stockRoutes, /MILKRUN_STOCK_ADJUST/);
    assert.equal((stockRoutes.match(/fastify\.post\(/g) ?? []).length, 1);
    assert.equal((stockRoutes.match(/fastify\.(?:patch|delete)\(/g) ?? []).length, 0);
    assert.match(balanceRoutes, /MILKRUN_STOCK_READ/);
    assert.match(transactionRoutes, /MILKRUN_STOCK_READ/);
    assert.equal((transactionRoutes.match(/fastify\.get\(/g) ?? []).length, 1);
    assert.equal((transactionRoutes.match(/fastify\.(?:post|patch|delete)\(/g) ?? []).length, 0);
  });
});

describe('Phase 9 vehicle assignment and permission isolation', () => {
  it('keeps the one-driver-one-vehicle constraint and changes assignment atomically', () => {
    assert.match(migration, /create or replace function milkrun\.assign_vehicle_driver/i);
    assert.match(migration, /for update;/i);
    assert.match(
      migration,
      /update milkrun\.vehicles[\s\S]*set driver_id = null[\s\S]*driver_id = p_driver_id and id <> p_vehicle_id/i,
    );
    assert.match(
      migration,
      /update milkrun\.vehicles[\s\S]*set driver_id = p_driver_id[\s\S]*id = p_vehicle_id/i,
    );
    const masterMigration = read(
      'supabase/migrations/202608110004_milkrun_master_data.sql',
    );
    assert.match(masterMigration, /constraint vehicles_driver_id_key unique \(driver_id\)/i);
  });

  it('uses vehicle permissions and never grants user creation through a vehicle route', () => {
    assert.match(vehicleRoutes, /MILKRUN_VEHICLE_READ/);
    assert.match(vehicleRoutes, /MILKRUN_VEHICLE_ASSIGN/);
    assert.doesNotMatch(vehicleRoutes, /ADMIN_USER_CREATE/);
    assert.match(vehicleService, /rpc\('assign_vehicle_driver'/);
    assert.match(userRoutes, /ADMIN_USER_CREATE/);
    assert.doesNotMatch(userRoutes, /MILKRUN_VEHICLE_ASSIGN/);
  });

  it('returns 403 when the actor lacks stock.adjust or vehicle.assign', async () => {
    for (const permission of [
      PERMISSION_CODE.MILKRUN_STOCK_ADJUST,
      PERMISSION_CODE.MILKRUN_VEHICLE_ASSIGN,
    ]) {
      const denied = replyRecorder();
      await requirePermission(permission)(requestFor([]), denied.reply);
      assert.equal(denied.state.statusCode, 403);

      const allowed = replyRecorder();
      await requirePermission(permission)(requestFor([permission]), allowed.reply);
      assert.equal(allowed.state.statusCode, undefined);
    }
  });
});


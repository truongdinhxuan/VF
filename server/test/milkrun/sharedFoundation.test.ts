import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { PERMISSION_CODE } from '../../src/domain/permission-codes';
import { MILKRUN_AREA_CODE } from '../../src/services/milkrun-area.service';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const migration = read('supabase/migrations/202608110003_milkrun_shared_foundation.sql');

const milkrunPermissions = [
  PERMISSION_CODE.MILKRUN_TRIP_READ_OWN,
  PERMISSION_CODE.MILKRUN_TRIP_READ_ALL,
  PERMISSION_CODE.MILKRUN_TRIP_CREATE,
  PERMISSION_CODE.MILKRUN_TRIP_START,
  PERMISSION_CODE.MILKRUN_TRIP_ARRIVE,
  PERMISSION_CODE.MILKRUN_TRIP_COMPLETE,
  PERMISSION_CODE.MILKRUN_RACK_READ,
  PERMISSION_CODE.MILKRUN_RACK_CREATE,
  PERMISSION_CODE.MILKRUN_RACK_UPDATE,
  PERMISSION_CODE.MILKRUN_STOCK_READ,
  PERMISSION_CODE.MILKRUN_STOCK_ADJUST,
  PERMISSION_CODE.MILKRUN_VEHICLE_READ,
  PERMISSION_CODE.MILKRUN_VEHICLE_ASSIGN,
  PERMISSION_CODE.MILKRUN_DASHBOARD_READ,
] as const;

describe('Phase 5 shared Milkrun foundation', () => {
  it('keeps the TypeScript catalog aligned with all 14 Milkrun permissions', () => {
    assert.equal(new Set(milkrunPermissions).size, 14);
    for (const permission of milkrunPermissions) {
      assert.match(migration, new RegExp(permission.replaceAll('.', '\\.')));
    }
  });

  it('seeds one active shared EDC Logistics Area without a hard-coded UUID', () => {
    assert.equal(MILKRUN_AREA_CODE, 'EDC_LOGISTICS');
    assert.match(migration, /'EDC_LOGISTICS',[\s\S]*'EDC Logistics'/);
    assert.match(migration, /on conflict \(code\) do update/);
    assert.doesNotMatch(migration, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('does not create Milkrun domain tables or reuse Supply and Order models', () => {
    assert.doesNotMatch(migration, /create schema\s+milkrun/i);
    assert.doesNotMatch(migration, /create table[\s\S]*(trips|trip_items|orders|order_items|supplies)/i);
    assert.doesNotMatch(migration, /milkrun\.areas/i);
  });

  it('validates the Milkrun Area by stable code and lifecycle fields', () => {
    const service = read('src/services/milkrun-area.service.ts');
    assert.match(service, /\.eq\('code', MILKRUN_AREA_CODE\)/);
    assert.match(service, /\.eq\('is_active', true\)/);
    assert.match(service, /\.eq\('is_deleted', false\)/);
    assert.match(service, /area\.id !== areaId/);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  ORDER_STATUSES,
  ROLE_NAMES,
  STOCK_TRANSACTION_TYPES,
} from '../../src/domain/enums';
import {
  canApproveOrder,
  canIssueOrder,
  canManageSystem,
  canManageUsers,
  canMutateStock,
  canViewStock,
} from '../../src/domain/permissions';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607200003_backend_foundation.sql'),
  'utf8',
);
const databaseInterfaces = readFileSync(
  resolve(process.cwd(), 'src/interfaces/database.ts'),
  'utf8',
);
const corsPlugin = readFileSync(
  resolve(process.cwd(), 'src/plugins/cors.ts'),
  'utf8',
);

const interfaceProperties = (name: string): string[] => {
  const block = databaseInterfaces.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`),
  )?.[1];
  assert.ok(block, `${name} must exist`);
  return [...block.matchAll(/^\s+(\w+):/gm)].map((match) => match[1]);
};

describe('Phase 1 backend foundation', () => {
  it('uses the selected five roles and workbook enums', () => {
    assert.deepEqual(ROLE_NAMES, [
      'data Đóng gói',
      'data Vật tư',
      'Tổ trưởng vật tư',
      'Material Control',
      'Admin',
    ]);
    assert.deepEqual(ORDER_STATUSES, [
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'PARTIAL_ISSUED',
      'ISSUED',
      'RECEIVED',
      'COMPLETED',
      'CANCELLED',
    ]);
    assert.deepEqual(STOCK_TRANSACTION_TYPES, [
      'ISSUE',
      'RECEIVE',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'IMPORT',
      'EXPORT',
    ]);
  });

  it('keeps Material Control read/approve only and Admin system-only', () => {
    assert.equal(canViewStock('Material Control'), true);
    assert.equal(canApproveOrder('Material Control'), true);
    assert.equal(canMutateStock('Material Control'), false);
    assert.equal(canIssueOrder('Material Control'), false);
    assert.equal(canManageUsers('Material Control'), false);
    assert.equal(canManageSystem('Material Control'), false);
    assert.equal(canManageUsers('Admin'), true);
    assert.equal(canManageSystem('Admin'), true);
  });

  it('defines exact record fields for all requested foundation models', () => {
    assert.deepEqual(interfaceProperties('RoleRecord'), ['id', 'role_name']);
    assert.deepEqual(interfaceProperties('PositionRecord'), ['id', 'position_name']);
    assert.deepEqual(interfaceProperties('AreaRecord'), ['id', 'code', 'name', 'is_active']);
    assert.deepEqual(interfaceProperties('UserRecord'), [
      'id', 'vinfast_id', 'email', 'phone_number', 'avatar_url', 'role_id',
      'position_id', 'area_id', 'managed_by_user_id', 'is_active', 'is_verified',
      'created_at', 'updated_at', 'first_name', 'last_name',
    ]);
    assert.deepEqual(interfaceProperties('SupplyCategoryRecord'), [
      'id', 'code', 'description', 'is_active', 'created_at', 'updated_at',
      'is_deleted',
    ]);
    assert.deepEqual(interfaceProperties('UnitRecord'), [
      'id', 'code', 'symbol', 'is_active', 'updated_at', 'created_at',
      'is_deleted',
    ]);
    assert.deepEqual(interfaceProperties('SupplyRecord'), [
      'id', 'code', 'description', 'category_id', 'unit_id', 'min_stock',
      'max_stock', 'safety_stock', 'image_url', 'is_active', 'is_deleted',
      'created_at', 'updated_at',
    ]);
    assert.deepEqual(interfaceProperties('StorageLocationRecord'), [
      'id', 'code', 'area_id', 'name', 'is_active',
    ]);
    assert.deepEqual(interfaceProperties('StockBalanceRecord'), [
      'id', 'supply_id', 'area_id', 'storage_location_id', 'quantity',
      'created_at', 'updated_at',
    ]);
    assert.deepEqual(interfaceProperties('StockTransactionRecord'), [
      'id', 'supply_id', 'area_id', 'storage_location_id', 'order_id',
      'order_item_id', 'type', 'quantity', 'before_quantity', 'after_quantity',
      'reason', 'note', 'created_by', 'created_at',
    ]);
  });

  it('enforces all requested unique keys without deleting data', () => {
    for (const indexName of [
      'roles_role_name_key',
      'positions_position_name_key',
      'areas_code_key',
      'supply_categories_code_key',
      'units_code_key',
      'supplies_code_key',
      'storage_locations_area_code_key',
      'stock_balances_supply_area_location_key',
    ]) {
      assert.match(migration, new RegExp(`unique index if not exists ${indexName}`, 'i'));
    }
    assert.doesNotMatch(migration, /\b(?:delete|truncate)\s+from\b/i);
  });

  it('enforces location and area consistency for stock records', () => {
    assert.match(migration, /stock_balances_location_area_fkey/i);
    assert.match(migration, /stock_transactions_location_area_fkey/i);
    assert.match(migration, /validate constraint stock_balances_location_area_fkey/i);
    assert.match(migration, /validate constraint stock_transactions_location_area_fkey/i);
  });

  it('allows PATCH through CORS for existing and future API routes', () => {
    assert.match(corsPlugin, /methods:\s*\[[^\]]*'PATCH'/s);
  });
});

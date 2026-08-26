import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/20260822131844_supply_stack_foundation.sql',
);
const databaseInterfaces = read('src/interfaces/database.ts');

describe('Supply stack Phase 1 category foundation', () => {
  it('seeds master-data codes and maps only the four approved standard codes', () => {
    assert.match(migration, /'KIEN_SAT_TC'/);
    assert.match(migration, /'KIEN_SAT_SPECIAL'/);

    for (const code of ['71000860', '71000861', '71000862', '71000863']) {
      assert.match(migration, new RegExp(`'${code}'`));
    }

    assert.match(
      migration,
      /where code in \('71000860', '71000861', '71000862', '71000863'\)[\s\S]*and category_id = v_legacy_category_id/i,
    );
    assert.match(
      migration,
      /set category_id = v_special_category_id[\s\S]*where category_id = v_legacy_category_id/i,
    );
    assert.doesNotMatch(migration, /short_text\s+(?:ilike|like)/i);
    assert.doesNotMatch(migration, /description\s+(?:ilike|like)/i);
  });
});

describe('Supply stack Phase 1 StockBalance contract', () => {
  it('adds nullable stack fields with mirror consistency', () => {
    assert.match(migration, /add column set_per_qty numeric/);
    assert.match(migration, /add column stack_quantity numeric/);
    assert.match(migration, /add column total_set_quantity numeric/);
    assert.match(migration, /set_per_qty > 0/);
    assert.match(migration, /stack_quantity >= 0/);
    assert.match(
      migration,
      /total_set_quantity = stack_quantity \* set_per_qty/,
    );
    assert.match(migration, /quantity = total_set_quantity/);
  });

  it('separates normal and stack balance identities while keeping Provider', () => {
    assert.match(
      migration,
      /create unique index stock_balances_normal_identity_key[\s\S]*supply_id,[\s\S]*provider_id,[\s\S]*area_id,[\s\S]*storage_location_id[\s\S]*where set_per_qty is null and is_deleted = false/i,
    );
    assert.match(
      migration,
      /create unique index stock_balances_stack_identity_key[\s\S]*supply_id,[\s\S]*provider_id,[\s\S]*area_id,[\s\S]*storage_location_id,[\s\S]*set_per_qty[\s\S]*where set_per_qty is not null and is_deleted = false/i,
    );
  });

  it('keeps the existing normal adjustment RPC compatible with the partial index', () => {
    assert.match(
      migration,
      /on conflict \(supply_id, provider_id, area_id, storage_location_id\).*where set_per_qty is null and is_deleted = false/s,
    );
    assert.match(
      migration,
      /and set_per_qty is null.*and is_deleted = false.*for update/s,
    );
  });
});

describe('Supply stack Phase 1 relational foundation', () => {
  it('adds compatible stack request fields to OrderItem', () => {
    assert.match(migration, /add column requested_stack_quantity numeric/);
    assert.match(migration, /add column requested_total_set_quantity numeric/);
    assert.match(
      migration,
      /requested_total_set_quantity = requested_stack_quantity \* set_per_qty/,
    );
    assert.match(
      migration,
      /quantity_requested = requested_total_set_quantity/,
    );
  });

  it('creates history-safe relational allocation and discrepancy tables', () => {
    assert.match(migration, /create table public\.order_item_allocations/);
    assert.match(migration, /create table public\.inventory_discrepancies/);
    assert.match(migration, /expected_stack_quantity > 0/);
    assert.match(
      migration,
      /actual_stack_quantity is null or actual_stack_quantity >= 0/,
    );
    assert.match(migration, /status in \('OPEN', 'RESOLVED'\)/);
    assert.match(migration, /status <> 'RESOLVED'/);
    assert.match(migration, /on delete restrict on update cascade/g);
    assert.match(
      migration,
      /inventory_discrepancies_open_stock_balance_idx/,
    );
  });

  it('keeps new tables behind backend service-role authorization', () => {
    assert.match(
      migration,
      /alter table public\.order_item_allocations enable row level security/,
    );
    assert.match(
      migration,
      /alter table public\.inventory_discrepancies enable row level security/,
    );
    assert.match(migration, /from public, anon, authenticated/);
    assert.match(migration, /to service_role/);
  });

  it('updates shared database interfaces without implementing services', () => {
    for (const field of [
      'set_per_qty: number | null',
      'stack_quantity: number | null',
      'total_set_quantity: number | null',
      'requested_stack_quantity: number | null',
      'requested_total_set_quantity: number | null',
    ]) {
      assert.ok(databaseInterfaces.includes(field), `missing ${field}`);
    }

    assert.match(
      databaseInterfaces,
      /export interface OrderItemAllocationRecord/,
    );
    assert.match(
      databaseInterfaces,
      /export interface InventoryDiscrepancyRecord/,
    );
  });
});

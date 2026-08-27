import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(__dirname, '..', '..');
const migration = readFileSync(join(
  root,
  'supabase',
  'migrations',
  '20260826170000_supply_shift_order_sheets.sql',
), 'utf8');
const orderService = readFileSync(join(root, 'src', 'services', 'orders.service.ts'), 'utf8');
const sheetService = readFileSync(join(root, 'src', 'services', 'shift-order-sheets.service.ts'), 'utf8');
const sheetExporter = readFileSync(join(root, 'src', 'services', 'shift-order-sheet-exporter.ts'), 'utf8');
const sheetRoutes = readFileSync(join(root, 'src', 'routes', 'supply', 'shift-order-sheets', 'index.ts'), 'utf8');

test('Phase 9 migration uses workbook sheet identity and canonical timezone', () => {
  assert.match(migration, /create table public\.supply_shift_order_sheets/);
  assert.match(migration, /\(area_id, work_shift_id, work_date\)/);
  assert.match(migration, /where is_deleted = false/);
  assert.match(migration, /Asia\/Ho_Chi_Minh/g);
  assert.match(migration, /orders_shift_order_sheet_id_fkey/);
  assert.doesNotMatch(migration, /date\s*\(\s*created_at\s*\)/i);
});

test('Submit RPC guards zero stock without reservation or stock mutation', () => {
  assert.match(migration, /create or replace function public\.submit_order_to_pending/);
  assert.match(migration, /ORDER_ITEM_ZERO_STOCK/);
  assert.match(migration, /sum\(balance\.stack_quantity\)/);
  assert.match(migration, /balance\.set_per_qty = v_item\.set_per_qty/);
  assert.match(migration, /sum\(balance\.quantity\)/);
  const submitFunction = migration.slice(migration.indexOf('create or replace function public.submit_order_to_pending'));
  assert.doesNotMatch(submitFunction, /update public\.stock_balances/i);
  assert.doesNotMatch(submitFunction, /insert into public\.stock_transactions/i);
  assert.doesNotMatch(submitFunction, /reserved_quantity|reservation|stock hold/i);
});

test('Order service delegates submit to the atomic Phase 9 RPC', () => {
  assert.match(orderService, /rpc\('submit_order_to_pending'/);
  assert.doesNotMatch(
    orderService.slice(orderService.indexOf('async submit'), orderService.indexOf('async list')),
    /\.from\('orders'\)\s*\.update/,
  );
});

test('Shift sheet queries are paginated, scoped and relation-based', () => {
  assert.match(sheetService, /parsePagination/);
  assert.match(sheetService, /\.range\(pagination\.from, pagination\.to\)/);
  assert.match(sheetService, /orders!orders_shift_order_sheet_id_fkey/);
  assert.match(sheetService, /request = request\.eq\('area_id', actor\.areaId\)/);
});

test('Phase 10 export reuses Sheet read guard and relational historical data', () => {
  assert.match(sheetRoutes, /\/:id\/export/);
  assert.match(sheetRoutes, /preHandler:\s*readPermission/);
  assert.match(sheetService, /this\.assertReadable\(actor, row\)/g);
  assert.match(sheetService, /orders!orders_shift_order_sheet_id_fkey/);
  assert.match(sheetService, /category:supply_categories!supplies_category_id_fkey/);
  assert.match(sheetService, /provider:providers!order_items_provider_id_fkey/);
  assert.doesNotMatch(sheetService, /stock_balances/);
  assert.doesNotMatch(sheetService, /stock_transactions/);
  assert.doesNotMatch(sheetService, /\.insert\(|\.update\(|\.delete\(/);
});

test('Phase 10 exporter follows exact workbook fields and does not mutate business data', () => {
  for (const header of [
    'Mã hàng', 'Tên mã', 'Số lượng', 'Số chồng',
    'Nhà cung cấp', 'Giờ order', 'Giờ nhận hàng', 'Note',
  ]) assert.match(sheetExporter, new RegExp(header));
  assert.match(sheetExporter, /quantity_issued/);
  assert.match(sheetExporter, /quantity_requested/);
  assert.match(sheetExporter, /requested_stack_quantity/);
  assert.match(sheetExporter, /Asia\/Ho_Chi_Minh/);
  assert.match(sheetExporter, /order\.submitted_at/);
  assert.match(sheetExporter, /order\.issued_at/);
  assert.doesNotMatch(sheetExporter, /received_at|StockBalance|StockTransaction/);
});
